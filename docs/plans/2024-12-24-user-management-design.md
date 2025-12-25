# User Management Design

## Overview

Multi-church user management system allowing users to belong to multiple churches with per-church roles, invitation-based onboarding, and admin member management.

## Requirements

- Users can belong to one or more churches
- Each membership has a role: admin, editor, or operator
- Users can switch between churches (via Settings page)
- Auto-select most recently used church on login
- Admins can invite users by email (even unregistered users)
- Invitations use magic links, expire after 30 days
- Admins can manage members: change roles, remove members
- Each church must have at least one admin
- Sole member can delete their church (hard delete)

## Database Schema

### New Tables

#### `church_memberships`

Many-to-many relationship between users and churches with per-church roles.

```sql
CREATE TABLE church_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'editor', 'operator')),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, church_id)
);

CREATE INDEX idx_memberships_user ON church_memberships(user_id);
CREATE INDEX idx_memberships_church ON church_memberships(church_id);
CREATE INDEX idx_memberships_church_role ON church_memberships(church_id, role);
```

#### `invitations`

Pending invitations with magic link tokens.

```sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'editor', 'operator')),
  invited_by UUID NOT NULL REFERENCES auth.users,
  token UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invitations_church ON invitations(church_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);
```

### Changes to `users` Table

Remove church-specific columns (relationship moves to `church_memberships`):

```sql
ALTER TABLE users DROP COLUMN church_id;
ALTER TABLE users DROP COLUMN role;
```

Resulting `users` table:

```sql
-- Users (linked to auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Current Church Context

### Approach: JWT User Metadata

Store `current_church_id` in Supabase user metadata. This persists across sessions and is included in JWT automatically.

**Setting current church (client-side):**

```typescript
await supabase.auth.updateUser({
  data: { current_church_id: churchId }
});
```

**Helper functions:**

```sql
-- Get current church from JWT
CREATE OR REPLACE FUNCTION get_current_church_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'current_church_id')::UUID;
$$ LANGUAGE SQL STABLE;

-- Get current role from membership
CREATE OR REPLACE FUNCTION get_current_role()
RETURNS TEXT AS $$
  SELECT role FROM church_memberships
  WHERE user_id = auth.uid()
  AND church_id = get_current_church_id();
$$ LANGUAGE SQL STABLE;

-- Validate and set current church
CREATE OR REPLACE FUNCTION set_current_church(p_church_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_member BOOLEAN;
BEGIN
  -- Check membership
  SELECT EXISTS(
    SELECT 1 FROM church_memberships
    WHERE user_id = auth.uid() AND church_id = p_church_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'User is not a member of this church';
  END IF;

  -- Update last accessed
  UPDATE church_memberships
  SET last_accessed_at = NOW()
  WHERE user_id = auth.uid() AND church_id = p_church_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Invitation Flow

### Admin Creates Invitation

1. Admin enters email and selects role in Settings > Team
2. Validate email not already a member of this church
3. Validate no pending (non-expired) invitation exists for this email
4. Create `invitations` record with unique token
5. Send magic link email via Supabase Auth with `invite_token` param

**Magic link URL format:**

```
https://app.mobileworship.com/auth/callback?invite_token={token}
```

### Recipient Accepts Invitation

**Existing user:**

1. Supabase Auth logs them in
2. App detects `invite_token` in URL
3. Call `accept_invitation(token)` function
4. Creates `church_memberships` record
5. Sets new church as current
6. Redirect to dashboard

**New user:**

1. Supabase Auth creates account, logs them in
2. App detects `invite_token` in URL
3. Prompt for display name
4. Create `users` record
5. Call `accept_invitation(token)` function
6. Creates `church_memberships` record
7. Sets new church as current
8. Redirect to dashboard

**Accept invitation function:**

```sql
CREATE OR REPLACE FUNCTION accept_invitation(p_token UUID)
RETURNS JSON AS $$
DECLARE
  v_invitation RECORD;
  v_user_email TEXT;
  v_result JSON;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  -- Find and validate invitation
  SELECT * INTO v_invitation FROM invitations
  WHERE token = p_token
  AND email = v_user_email
  AND accepted_at IS NULL
  AND expires_at > NOW();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- Check not already a member
  IF EXISTS(
    SELECT 1 FROM church_memberships
    WHERE user_id = auth.uid() AND church_id = v_invitation.church_id
  ) THEN
    RAISE EXCEPTION 'Already a member of this church';
  END IF;

  -- Create membership
  INSERT INTO church_memberships (user_id, church_id, role)
  VALUES (auth.uid(), v_invitation.church_id, v_invitation.role);

  -- Mark invitation accepted
  UPDATE invitations SET accepted_at = NOW() WHERE id = v_invitation.id;

  -- Return church info
  SELECT json_build_object(
    'church_id', v_invitation.church_id,
    'role', v_invitation.role
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Admin Management

### Member Management

**View members:**
- List all `church_memberships` for current church joined with `users`

**Change role:**
- Validate not demoting the last admin
- Update `church_memberships.role`

**Remove member:**
- Validate not removing the last admin
- Delete `church_memberships` record
- If removed user has no other memberships, they see "join or create" screen on next login

**Protection function:**

```sql
CREATE OR REPLACE FUNCTION get_admin_count(p_church_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM church_memberships
  WHERE church_id = p_church_id AND role = 'admin';
$$ LANGUAGE SQL STABLE;
```

### Invitation Management

**View invitations:**
- Pending: `accepted_at IS NULL AND expires_at > NOW()`
- Expired: `accepted_at IS NULL AND expires_at <= NOW()`
- Accepted: `accepted_at IS NOT NULL`

**Resend invitation:**
- Update `expires_at` to NOW() + 30 days
- Trigger email send again

**Cancel invitation:**
- Delete `invitations` record

## Church Deletion

**Conditions:**
- User is admin of the church
- User is the sole member (only 1 membership exists)

**Process:**
1. Confirm by typing church name
2. Hard delete church record (cascades to all related data)
3. Redirect user to next church or onboarding

**Delete function:**

```sql
CREATE OR REPLACE FUNCTION delete_church(p_church_id UUID, p_confirmation TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_church_name TEXT;
  v_member_count INTEGER;
BEGIN
  -- Verify admin
  IF get_current_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete a church';
  END IF;

  -- Get church name and member count
  SELECT name INTO v_church_name FROM churches WHERE id = p_church_id;
  SELECT COUNT(*) INTO v_member_count FROM church_memberships WHERE church_id = p_church_id;

  -- Verify sole member
  IF v_member_count > 1 THEN
    RAISE EXCEPTION 'Cannot delete church with other members';
  END IF;

  -- Verify confirmation matches
  IF p_confirmation != v_church_name THEN
    RAISE EXCEPTION 'Confirmation does not match church name';
  END IF;

  -- Delete church (cascades to memberships, songs, events, media, etc.)
  DELETE FROM churches WHERE id = p_church_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## RLS Policies

### `church_memberships`

```sql
ALTER TABLE church_memberships ENABLE ROW LEVEL SECURITY;

-- Users can view memberships in churches they belong to
CREATE POLICY "View memberships in my churches" ON church_memberships
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM church_memberships WHERE user_id = auth.uid())
  );

-- Users can view their own memberships (for church list)
CREATE POLICY "View own memberships" ON church_memberships
  FOR SELECT USING (user_id = auth.uid());

-- Admins can manage memberships in their current church
CREATE POLICY "Admins manage memberships" ON church_memberships
  FOR ALL USING (
    church_id = get_current_church_id()
    AND get_current_role() = 'admin'
  );

-- Users can delete their own membership (leave church)
CREATE POLICY "Leave church" ON church_memberships
  FOR DELETE USING (user_id = auth.uid());
```

### `invitations`

```sql
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Admins can manage invitations for their church
CREATE POLICY "Admins manage invitations" ON invitations
  FOR ALL USING (
    church_id = get_current_church_id()
    AND get_current_role() = 'admin'
  );

-- Anyone can view invitation by token (for accepting)
CREATE POLICY "View by token" ON invitations
  FOR SELECT USING (TRUE);  -- Token lookup done in function
```

### Updated `churches` Policy

```sql
-- Drop old policies first
DROP POLICY IF EXISTS "Users can view their church" ON churches;
DROP POLICY IF EXISTS "Admins can update their church" ON churches;

-- Users can view churches they're members of
CREATE POLICY "View member churches" ON churches
  FOR SELECT USING (
    id IN (SELECT church_id FROM church_memberships WHERE user_id = auth.uid())
  );

-- Admins can update their current church
CREATE POLICY "Admins update church" ON churches
  FOR UPDATE USING (
    id = get_current_church_id()
    AND get_current_role() = 'admin'
  );

-- Sole admin can delete church
CREATE POLICY "Sole member delete" ON churches
  FOR DELETE USING (
    id = get_current_church_id()
    AND get_current_role() = 'admin'
    AND (SELECT COUNT(*) FROM church_memberships WHERE church_id = id) = 1
  );
```

### Updated Policies for Other Tables

All existing tables (songs, events, media, song_usage, displays) need policies updated:

```sql
-- Replace get_user_church_id() with get_current_church_id()
-- Replace get_user_role() with get_current_role()
```

## Signup Flow Changes

Update `create_church_and_user` function:

```sql
CREATE OR REPLACE FUNCTION create_church_and_user(
  p_user_id UUID,
  p_church_name TEXT,
  p_user_name TEXT,
  p_user_email TEXT
)
RETURNS JSON AS $$
DECLARE
  v_church_id UUID;
  v_result JSON;
BEGIN
  -- Create the church
  INSERT INTO churches (name)
  VALUES (p_church_name)
  RETURNING id INTO v_church_id;

  -- Create the user profile (without church_id)
  INSERT INTO users (id, name, email)
  VALUES (p_user_id, p_user_name, p_user_email);

  -- Create the membership
  INSERT INTO church_memberships (user_id, church_id, role)
  VALUES (p_user_id, v_church_id, 'admin');

  -- Return the created data
  SELECT json_build_object(
    'church_id', v_church_id,
    'user_id', p_user_id
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## UI Components

### Settings Page Structure

```
Settings
├── Profile
│   └── Name, email (existing)
├── Church Profile (admin only)
│   └── Church name, settings
│   └── Delete Church (sole member only)
├── Team (admin only, new)
│   ├── Members list
│   │   └── Name, Email, Role, Actions (change role, remove)
│   ├── Pending Invitations
│   │   └── Email, Role, Expires, Actions (resend, cancel)
│   └── Invite Form
│       └── Email input, role dropdown, send button
├── Switch Church (if multiple memberships, new)
│   └── List of churches with roles, click to switch
└── Billing (admin only, existing)
```

### Header

Display current church name (read-only, no dropdown). Switching done via Settings.

## Migration Strategy

### Step 1: Create New Tables (Non-breaking)

```sql
-- Create church_memberships table
-- Create invitations table
-- Create new helper functions
```

### Step 2: Backfill Data

```sql
-- Migrate existing user-church relationships
INSERT INTO church_memberships (user_id, church_id, role, last_accessed_at, created_at)
SELECT id, church_id, role, NOW(), created_at FROM users WHERE church_id IS NOT NULL;

-- Set current_church_id in user metadata via Edge Function
```

### Step 3: Deploy Updated App

Deploy new app code that uses `church_memberships` and new helper functions.

### Step 4: Cleanup

```sql
-- Drop old columns
ALTER TABLE users DROP COLUMN IF EXISTS church_id;
ALTER TABLE users DROP COLUMN IF EXISTS role;

-- Drop old helper functions
DROP FUNCTION IF EXISTS get_user_church_id();
DROP FUNCTION IF EXISTS get_user_role();

-- Drop old RLS policies and create new ones
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User logs in with no memberships | Show "join or create church" screen |
| Last admin tries to leave | Block with error message |
| Last admin tries to demote self | Block with error message |
| Invite sent to existing member | Reject with error |
| Invite sent to pending invite | Reject with error (or option to resend) |
| User clicks expired invite link | Show "invitation expired" message |
| User clicks already-used invite link | Show "already accepted" or redirect to church |

## i18n Keys

New translation keys needed:

```json
{
  "settings.team": "Team",
  "settings.team.members": "Members",
  "settings.team.invitations": "Pending Invitations",
  "settings.team.invite": "Invite Member",
  "settings.team.invite.email": "Email address",
  "settings.team.invite.role": "Role",
  "settings.team.invite.send": "Send Invitation",
  "settings.team.changeRole": "Change Role",
  "settings.team.removeMember": "Remove",
  "settings.team.resendInvite": "Resend",
  "settings.team.cancelInvite": "Cancel",
  "settings.team.lastAdmin": "Cannot remove the last admin",
  "settings.switchChurch": "Switch Church",
  "settings.deleteChurch": "Delete Church",
  "settings.deleteChurch.confirm": "Type church name to confirm",
  "settings.deleteChurch.warning": "This will permanently delete all data",
  "invite.expired": "This invitation has expired",
  "invite.accepted": "Invitation accepted",
  "invite.invalid": "Invalid invitation"
}
```
