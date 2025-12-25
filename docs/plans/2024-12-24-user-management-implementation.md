# User Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement multi-church user management with invitations, role management, and church switching.

**Architecture:** Replace single `church_id` on users with `church_memberships` junction table. Store current church in JWT user metadata. Add invitation system with magic links via Supabase Auth.

**Tech Stack:** Supabase (PostgreSQL, RLS, Auth), React, TanStack Query, react-i18next, Tailwind CSS

---

## Task 1: Database Migration - New Tables and Functions

**Files:**
- Create: `supabase/migrations/20241224150000_user_management.sql`

**Step 1: Write the migration file**

```sql
-- User Management Schema Update
-- Adds multi-church support with memberships and invitations

-- ============================================
-- PHASE 1: Create new tables (non-breaking)
-- ============================================

-- Church memberships (many-to-many users <-> churches)
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

-- Invitations table
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

-- ============================================
-- PHASE 2: New helper functions
-- ============================================

-- Get current church from JWT user metadata
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

-- Get admin count for a church
CREATE OR REPLACE FUNCTION get_admin_count(p_church_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM church_memberships
  WHERE church_id = p_church_id AND role = 'admin';
$$ LANGUAGE SQL STABLE;

-- Validate and set current church (updates last_accessed_at)
CREATE OR REPLACE FUNCTION set_current_church(p_church_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_member BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM church_memberships
    WHERE user_id = auth.uid() AND church_id = p_church_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'User is not a member of this church';
  END IF;

  UPDATE church_memberships
  SET last_accessed_at = NOW()
  WHERE user_id = auth.uid() AND church_id = p_church_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accept invitation function
CREATE OR REPLACE FUNCTION accept_invitation(p_token UUID)
RETURNS JSON AS $$
DECLARE
  v_invitation RECORD;
  v_user_email TEXT;
  v_result JSON;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_invitation FROM invitations
  WHERE token = p_token
  AND email = v_user_email
  AND accepted_at IS NULL
  AND expires_at > NOW();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  IF EXISTS(
    SELECT 1 FROM church_memberships
    WHERE user_id = auth.uid() AND church_id = v_invitation.church_id
  ) THEN
    RAISE EXCEPTION 'Already a member of this church';
  END IF;

  INSERT INTO church_memberships (user_id, church_id, role)
  VALUES (auth.uid(), v_invitation.church_id, v_invitation.role);

  UPDATE invitations SET accepted_at = NOW() WHERE id = v_invitation.id;

  SELECT json_build_object(
    'church_id', v_invitation.church_id,
    'role', v_invitation.role
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete church function (with confirmation)
CREATE OR REPLACE FUNCTION delete_church(p_church_id UUID, p_confirmation TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_church_name TEXT;
  v_member_count INTEGER;
BEGIN
  IF get_current_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete a church';
  END IF;

  SELECT name INTO v_church_name FROM churches WHERE id = p_church_id;
  SELECT COUNT(*) INTO v_member_count FROM church_memberships WHERE church_id = p_church_id;

  IF v_member_count > 1 THEN
    RAISE EXCEPTION 'Cannot delete church with other members';
  END IF;

  IF p_confirmation != v_church_name THEN
    RAISE EXCEPTION 'Confirmation does not match church name';
  END IF;

  DELETE FROM churches WHERE id = p_church_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PHASE 3: Backfill existing data
-- ============================================

INSERT INTO church_memberships (user_id, church_id, role, last_accessed_at, created_at)
SELECT id, church_id, role, NOW(), created_at
FROM users
WHERE church_id IS NOT NULL;

-- ============================================
-- PHASE 4: RLS for new tables
-- ============================================

ALTER TABLE church_memberships ENABLE ROW LEVEL SECURITY;

-- Users can view their own memberships (for church list)
CREATE POLICY "View own memberships" ON church_memberships
  FOR SELECT USING (user_id = auth.uid());

-- Users can view memberships in churches they belong to
CREATE POLICY "View memberships in my churches" ON church_memberships
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM church_memberships WHERE user_id = auth.uid())
  );

-- Admins can insert memberships in their current church
CREATE POLICY "Admins insert memberships" ON church_memberships
  FOR INSERT WITH CHECK (
    church_id = get_current_church_id()
    AND get_current_role() = 'admin'
  );

-- Admins can update memberships in their current church
CREATE POLICY "Admins update memberships" ON church_memberships
  FOR UPDATE USING (
    church_id = get_current_church_id()
    AND get_current_role() = 'admin'
  );

-- Admins can delete memberships OR users can delete their own
CREATE POLICY "Admins or self delete memberships" ON church_memberships
  FOR DELETE USING (
    user_id = auth.uid() OR
    (church_id = get_current_church_id() AND get_current_role() = 'admin')
  );

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Admins can manage invitations for their church
CREATE POLICY "Admins manage invitations" ON invitations
  FOR ALL USING (
    church_id = get_current_church_id()
    AND get_current_role() = 'admin'
  );

-- Anyone can view invitation by token (needed for accept flow)
CREATE POLICY "View invitation by token" ON invitations
  FOR SELECT USING (TRUE);

-- ============================================
-- PHASE 5: Update existing RLS policies
-- ============================================

-- Drop old church policies
DROP POLICY IF EXISTS "Users can view their church" ON churches;
DROP POLICY IF EXISTS "Admins can update their church" ON churches;

-- New church policies using memberships
CREATE POLICY "View member churches" ON churches
  FOR SELECT USING (
    id IN (SELECT church_id FROM church_memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins update church" ON churches
  FOR UPDATE USING (
    id = get_current_church_id()
    AND get_current_role() = 'admin'
  );

CREATE POLICY "Sole member delete church" ON churches
  FOR DELETE USING (
    id = get_current_church_id()
    AND get_current_role() = 'admin'
    AND (SELECT COUNT(*) FROM church_memberships WHERE church_id = id) = 1
  );

-- Drop old user policies
DROP POLICY IF EXISTS "Users can view users in their church" ON users;
DROP POLICY IF EXISTS "Admins can manage users in their church" ON users;

-- New user policies
CREATE POLICY "View users in member churches" ON users
  FOR SELECT USING (
    id IN (SELECT user_id FROM church_memberships WHERE church_id = get_current_church_id())
  );

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

-- Update songs policies
DROP POLICY IF EXISTS "Users can view songs in their church" ON songs;
DROP POLICY IF EXISTS "Editors and admins can manage songs" ON songs;

CREATE POLICY "View songs in current church" ON songs
  FOR SELECT USING (church_id = get_current_church_id());

CREATE POLICY "Editors manage songs" ON songs
  FOR ALL USING (
    church_id = get_current_church_id()
    AND get_current_role() IN ('admin', 'editor')
  );

-- Update media policies
DROP POLICY IF EXISTS "Users can view media in their church" ON media;
DROP POLICY IF EXISTS "Editors and admins can manage media" ON media;

CREATE POLICY "View media in current church" ON media
  FOR SELECT USING (church_id = get_current_church_id());

CREATE POLICY "Editors manage media" ON media
  FOR ALL USING (
    church_id = get_current_church_id()
    AND get_current_role() IN ('admin', 'editor')
  );

-- Update events policies
DROP POLICY IF EXISTS "Users can view events in their church" ON events;
DROP POLICY IF EXISTS "Editors and admins can manage events" ON events;

CREATE POLICY "View events in current church" ON events
  FOR SELECT USING (church_id = get_current_church_id());

CREATE POLICY "Editors manage events" ON events
  FOR ALL USING (
    church_id = get_current_church_id()
    AND get_current_role() IN ('admin', 'editor')
  );

-- Update song_usage policies
DROP POLICY IF EXISTS "Users can view song usage in their church" ON song_usage;
DROP POLICY IF EXISTS "Users can track song usage" ON song_usage;

CREATE POLICY "View song usage in current church" ON song_usage
  FOR SELECT USING (church_id = get_current_church_id());

CREATE POLICY "Track song usage in current church" ON song_usage
  FOR INSERT WITH CHECK (church_id = get_current_church_id());

-- Update displays policies
DROP POLICY IF EXISTS "Users can view their church displays" ON displays;
DROP POLICY IF EXISTS "Admins can manage displays" ON displays;

CREATE POLICY "View displays in current church" ON displays
  FOR SELECT USING (church_id = get_current_church_id());

CREATE POLICY "Admins manage displays" ON displays
  FOR ALL USING (
    church_id = get_current_church_id()
    AND get_current_role() = 'admin'
  );

-- Update storage policies
DROP POLICY IF EXISTS "Users can view media files from their church" ON storage.objects;
DROP POLICY IF EXISTS "Editors can upload media files" ON storage.objects;
DROP POLICY IF EXISTS "Editors can delete media files" ON storage.objects;

CREATE POLICY "View media files from current church" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'media' AND
    (storage.foldername(name))[1] = get_current_church_id()::text
  );

CREATE POLICY "Editors upload media files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'media' AND
    (storage.foldername(name))[1] = get_current_church_id()::text AND
    get_current_role() IN ('admin', 'editor')
  );

CREATE POLICY "Editors delete media files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'media' AND
    (storage.foldername(name))[1] = get_current_church_id()::text AND
    get_current_role() IN ('admin', 'editor')
  );

-- ============================================
-- PHASE 6: Update create_church_and_user function
-- ============================================

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

  -- Create the user profile (without church_id - uses memberships now)
  INSERT INTO users (id, name, email)
  VALUES (p_user_id, p_user_name, p_user_email)
  ON CONFLICT (id) DO UPDATE SET name = p_user_name;

  -- Create the membership
  INSERT INTO church_memberships (user_id, church_id, role)
  VALUES (p_user_id, v_church_id, 'admin');

  SELECT json_build_object(
    'church_id', v_church_id,
    'user_id', p_user_id
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PHASE 7: Drop old columns (cleanup)
-- ============================================

-- Keep old helper functions as aliases during transition
CREATE OR REPLACE FUNCTION get_user_church_id()
RETURNS UUID AS $$
  SELECT get_current_church_id();
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT get_current_role();
$$ LANGUAGE SQL STABLE;

-- Drop old columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS church_id;
ALTER TABLE users DROP COLUMN IF EXISTS role;

-- Grant permissions
GRANT EXECUTE ON FUNCTION set_current_church TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION delete_church TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_count TO authenticated;
```

**Step 2: Apply the migration**

Run in worktree directory:
```bash
cd /Users/markb/dev/mobileworship/.worktrees/user-management
supabase db push
```

Expected: Migration applies successfully

**Step 3: Generate updated TypeScript types**

```bash
pnpm db:types
```

Expected: `packages/shared/src/types/database.ts` updated with new tables

**Step 4: Commit**

```bash
git add supabase/migrations/20241224150000_user_management.sql packages/shared/src/types/database.ts
git commit -m "feat(db): add church_memberships and invitations tables

- Create church_memberships junction table for multi-church support
- Create invitations table with token-based magic links
- Add helper functions: get_current_church_id, get_current_role, etc
- Update all RLS policies to use new functions
- Backfill existing user-church relationships
- Update create_church_and_user for new schema"
```

---

## Task 2: Update Shared Types

**Files:**
- Modify: `packages/shared/src/types/index.ts`

**Step 1: Add new types for memberships and invitations**

Add after the existing `Role` type definition (around line 16):

```typescript
// Membership type for multi-church support
export interface ChurchMembership {
  id: string;
  userId: string;
  churchId: string;
  role: Role;
  lastAccessedAt: string;
  createdAt: string;
  // Joined data
  church?: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

// Invitation type
export interface Invitation {
  id: string;
  churchId: string;
  email: string;
  role: Role;
  invitedBy: string;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  // Joined data
  invitedByUser?: {
    name: string;
  };
}

// Invitation status helper
export type InvitationStatus = 'pending' | 'expired' | 'accepted';

export function getInvitationStatus(invitation: Invitation): InvitationStatus {
  if (invitation.acceptedAt) return 'accepted';
  if (new Date(invitation.expiresAt) < new Date()) return 'expired';
  return 'pending';
}
```

**Step 2: Verify types compile**

```bash
pnpm build --filter=@mobileworship/shared
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/shared/src/types/index.ts
git commit -m "feat(types): add ChurchMembership and Invitation types"
```

---

## Task 3: Create useMemberships Hook

**Files:**
- Create: `packages/shared/src/hooks/useMemberships.ts`
- Modify: `packages/shared/src/hooks/index.ts`

**Step 1: Create the hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from './useSupabase';
import { useAuth } from './useAuth';
import type { ChurchMembership, Role } from '../types';

export function useMemberships() {
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all memberships for current user (for church switcher)
  const myMembershipsQuery = useQuery({
    queryKey: ['memberships', 'mine'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('church_memberships')
        .select(`
          id,
          user_id,
          church_id,
          role,
          last_accessed_at,
          created_at,
          churches:church_id (id, name)
        `)
        .eq('user_id', user?.id)
        .order('last_accessed_at', { ascending: false });

      if (error) throw error;
      return data.map((m) => ({
        id: m.id,
        userId: m.user_id,
        churchId: m.church_id,
        role: m.role as Role,
        lastAccessedAt: m.last_accessed_at,
        createdAt: m.created_at,
        church: m.churches ? { id: m.churches.id, name: m.churches.name } : undefined,
      })) as ChurchMembership[];
    },
    enabled: !!user?.id,
  });

  // Fetch all members of current church (for team management)
  const churchMembersQuery = useQuery({
    queryKey: ['memberships', 'church', user?.churchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('church_memberships')
        .select(`
          id,
          user_id,
          church_id,
          role,
          last_accessed_at,
          created_at,
          users:user_id (id, name, email)
        `)
        .eq('church_id', user?.churchId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data.map((m) => ({
        id: m.id,
        userId: m.user_id,
        churchId: m.church_id,
        role: m.role as Role,
        lastAccessedAt: m.last_accessed_at,
        createdAt: m.created_at,
        user: m.users ? { id: m.users.id, name: m.users.name, email: m.users.email } : undefined,
      })) as ChurchMembership[];
    },
    enabled: !!user?.churchId,
  });

  // Change member role
  const changeRoleMutation = useMutation({
    mutationFn: async ({ membershipId, newRole }: { membershipId: string; newRole: Role }) => {
      const { error } = await supabase
        .from('church_memberships')
        .update({ role: newRole })
        .eq('id', membershipId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });

  // Remove member
  const removeMemberMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase
        .from('church_memberships')
        .delete()
        .eq('id', membershipId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });

  // Get admin count for validation
  const getAdminCount = async (churchId: string): Promise<number> => {
    const { data, error } = await supabase.rpc('get_admin_count', { p_church_id: churchId });
    if (error) throw error;
    return data;
  };

  return {
    myMemberships: myMembershipsQuery.data ?? [],
    isLoadingMyMemberships: myMembershipsQuery.isLoading,
    churchMembers: churchMembersQuery.data ?? [],
    isLoadingChurchMembers: churchMembersQuery.isLoading,
    changeRole: changeRoleMutation.mutateAsync,
    isChangingRole: changeRoleMutation.isPending,
    removeMember: removeMemberMutation.mutateAsync,
    isRemovingMember: removeMemberMutation.isPending,
    getAdminCount,
  };
}
```

**Step 2: Export from index**

Add to `packages/shared/src/hooks/index.ts`:

```typescript
export { useMemberships } from './useMemberships';
```

**Step 3: Verify build**

```bash
pnpm build --filter=@mobileworship/shared
```

Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/shared/src/hooks/useMemberships.ts packages/shared/src/hooks/index.ts
git commit -m "feat(hooks): add useMemberships hook for multi-church support"
```

---

## Task 4: Create useInvitations Hook

**Files:**
- Create: `packages/shared/src/hooks/useInvitations.ts`
- Modify: `packages/shared/src/hooks/index.ts`

**Step 1: Create the hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from './useSupabase';
import { useAuth } from './useAuth';
import type { Invitation, Role } from '../types';

export function useInvitations() {
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch invitations for current church
  const invitationsQuery = useQuery({
    queryKey: ['invitations', user?.churchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select(`
          id,
          church_id,
          email,
          role,
          invited_by,
          token,
          expires_at,
          accepted_at,
          created_at,
          users:invited_by (name)
        `)
        .eq('church_id', user?.churchId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map((inv) => ({
        id: inv.id,
        churchId: inv.church_id,
        email: inv.email,
        role: inv.role as Role,
        invitedBy: inv.invited_by,
        token: inv.token,
        expiresAt: inv.expires_at,
        acceptedAt: inv.accepted_at,
        createdAt: inv.created_at,
        invitedByUser: inv.users ? { name: inv.users.name } : undefined,
      })) as Invitation[];
    },
    enabled: !!user?.churchId,
  });

  // Create invitation
  const createInvitationMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: Role }) => {
      // Check if already a member
      const { data: existingMember } = await supabase
        .from('church_memberships')
        .select('id')
        .eq('church_id', user?.churchId)
        .eq('user_id', (
          await supabase.from('users').select('id').eq('email', email).single()
        ).data?.id)
        .single();

      if (existingMember) {
        throw new Error('User is already a member of this church');
      }

      // Check for pending invitation
      const { data: existingInvite } = await supabase
        .from('invitations')
        .select('id')
        .eq('church_id', user?.churchId)
        .eq('email', email)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (existingInvite) {
        throw new Error('An invitation is already pending for this email');
      }

      const { data, error } = await supabase
        .from('invitations')
        .insert({
          church_id: user?.churchId,
          email,
          role,
          invited_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });

  // Resend invitation (updates expires_at)
  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 30);

      const { error } = await supabase
        .from('invitations')
        .update({ expires_at: newExpiry.toISOString() })
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });

  // Cancel invitation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });

  // Accept invitation (called after login with invite token)
  const acceptInvitationMutation = useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
      if (error) throw error;
      return data as { church_id: string; role: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });

  // Get invitation by token (for display before accepting)
  const getInvitationByToken = async (token: string): Promise<Invitation | null> => {
    const { data, error } = await supabase
      .from('invitations')
      .select(`
        id,
        church_id,
        email,
        role,
        invited_by,
        token,
        expires_at,
        accepted_at,
        created_at,
        churches:church_id (name)
      `)
      .eq('token', token)
      .single();

    if (error || !data) return null;
    return {
      id: data.id,
      churchId: data.church_id,
      email: data.email,
      role: data.role as Role,
      invitedBy: data.invited_by,
      token: data.token,
      expiresAt: data.expires_at,
      acceptedAt: data.accepted_at,
      createdAt: data.created_at,
    };
  };

  return {
    invitations: invitationsQuery.data ?? [],
    isLoading: invitationsQuery.isLoading,
    createInvitation: createInvitationMutation.mutateAsync,
    isCreating: createInvitationMutation.isPending,
    resendInvitation: resendInvitationMutation.mutateAsync,
    isResending: resendInvitationMutation.isPending,
    cancelInvitation: cancelInvitationMutation.mutateAsync,
    isCanceling: cancelInvitationMutation.isPending,
    acceptInvitation: acceptInvitationMutation.mutateAsync,
    isAccepting: acceptInvitationMutation.isPending,
    getInvitationByToken,
  };
}
```

**Step 2: Export from index**

Add to `packages/shared/src/hooks/index.ts`:

```typescript
export { useInvitations } from './useInvitations';
```

**Step 3: Verify build**

```bash
pnpm build --filter=@mobileworship/shared
```

Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/shared/src/hooks/useInvitations.ts packages/shared/src/hooks/index.ts
git commit -m "feat(hooks): add useInvitations hook for invitation management"
```

---

## Task 5: Update useAuth Hook for Multi-Church

**Files:**
- Modify: `packages/shared/src/hooks/useAuth.tsx`

**Step 1: Update AuthUser interface and add new methods**

Replace the entire file content:

```typescript
import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { useSupabase } from './useSupabase';
import type { Role, Permission } from '../types';
import { hasPermission } from '../types';

interface AuthUser {
  id: string;
  email: string;
  churchId: string;
  role: Role;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, churchName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  can: (permission: Permission) => boolean;
  switchChurch: (churchId: string) => Promise<void>;
  hasMultipleChurches: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMultipleChurches, setHasMultipleChurches] = useState(false);
  const isSigningUp = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (isSigningUp.current) {
        return;
      }

      if (event === 'SIGNED_IN' && window.location.href.includes('#')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }

      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setUser(null);
        setHasMultipleChurches(false);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function fetchUserProfile(authUser: User) {
    // Get user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (userError || !userData) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    // Get memberships
    const { data: memberships } = await supabase
      .from('church_memberships')
      .select('church_id, role, last_accessed_at')
      .eq('user_id', authUser.id)
      .order('last_accessed_at', { ascending: false });

    if (!memberships || memberships.length === 0) {
      // User has no church memberships - edge case
      setUser(null);
      setIsLoading(false);
      return;
    }

    setHasMultipleChurches(memberships.length > 1);

    // Determine current church: use JWT metadata or most recent
    const currentChurchId =
      authUser.user_metadata?.current_church_id || memberships[0].church_id;

    // Find membership for current church
    const currentMembership =
      memberships.find((m) => m.church_id === currentChurchId) || memberships[0];

    // Update JWT metadata if needed
    if (authUser.user_metadata?.current_church_id !== currentMembership.church_id) {
      await supabase.auth.updateUser({
        data: { current_church_id: currentMembership.church_id },
      });
    }

    setUser({
      id: userData.id,
      email: userData.email,
      churchId: currentMembership.church_id,
      role: currentMembership.role as Role,
      name: userData.name,
    });

    setIsLoading(false);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) throw error;
  }

  async function signInWithMagicLink(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) throw error;
  }

  async function signUp(email: string, password: string, name: string, churchName: string) {
    isSigningUp.current = true;

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { current_church_id: null }, // Will be set by create_church_and_user
        },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      const { data: rpcResult, error: rpcError } = await supabase.rpc('create_church_and_user', {
        p_user_id: authData.user.id,
        p_church_name: churchName,
        p_user_name: name,
        p_user_email: email,
      });
      if (rpcError) throw rpcError;

      // Update JWT with new church ID
      await supabase.auth.updateUser({
        data: { current_church_id: rpcResult.church_id },
      });

      await fetchUserProfile(authData.user);
    } finally {
      isSigningUp.current = false;
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function resetPasswordForEmail(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }

  async function switchChurch(churchId: string) {
    // Validate membership via RPC
    const { error: validateError } = await supabase.rpc('set_current_church', {
      p_church_id: churchId,
    });
    if (validateError) throw validateError;

    // Update JWT metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: { current_church_id: churchId },
    });
    if (updateError) throw updateError;

    // Refresh user profile
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await fetchUserProfile(authUser);
    }
  }

  function can(permission: Permission): boolean {
    if (!user) return false;
    return hasPermission(user.role, permission);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signInWithGoogle,
        signInWithMagicLink,
        signUp,
        signOut,
        resetPasswordForEmail,
        updatePassword,
        can,
        switchChurch,
        hasMultipleChurches,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

**Step 2: Verify build**

```bash
pnpm build --filter=@mobileworship/shared
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/shared/src/hooks/useAuth.tsx
git commit -m "feat(auth): update useAuth for multi-church support

- Fetch memberships to determine current church and role
- Add switchChurch method to change active church
- Add hasMultipleChurches flag for UI conditionals
- Store current_church_id in JWT user metadata"
```

---

## Task 6: Add i18n Keys

**Files:**
- Modify: `apps/web/src/i18n/locales/en.json`
- Modify: `apps/web/src/i18n/locales/es.json`

**Step 1: Add English translations**

Add to `settings` section in `en.json` (after the existing `team` object around line 407):

```json
    "team": {
      "title": "Team Members",
      "members": "Members",
      "invitations": "Pending Invitations",
      "noMembers": "No team members yet",
      "noInvitations": "No pending invitations",
      "invite": "Invite Member",
      "inviteDescription": "Send an email invitation to add someone to your team",
      "email": "Email address",
      "emailPlaceholder": "name@example.com",
      "role": "Role",
      "send": "Send Invitation",
      "sending": "Sending...",
      "changeRole": "Change Role",
      "remove": "Remove",
      "resend": "Resend",
      "cancel": "Cancel Invitation",
      "expires": "Expires",
      "expired": "Expired",
      "invitedBy": "Invited by {{name}}",
      "lastAdmin": "Cannot remove the last admin",
      "lastAdminRole": "Cannot change role of the last admin",
      "confirmRemove": "Remove {{name}} from this church?",
      "inviteSent": "Invitation sent to {{email}}",
      "inviteResent": "Invitation resent",
      "inviteCanceled": "Invitation canceled",
      "memberRemoved": "Member removed",
      "roleChanged": "Role updated",
      "alreadyMember": "This user is already a member",
      "alreadyInvited": "An invitation is already pending for this email"
    },
    "switchChurch": {
      "title": "Switch Church",
      "current": "Current",
      "switch": "Switch",
      "switching": "Switching..."
    },
    "deleteChurch": {
      "title": "Delete Church",
      "warning": "This action cannot be undone. All songs, events, media, and data will be permanently deleted.",
      "confirm": "Type the church name to confirm",
      "confirmPlaceholder": "Enter church name",
      "delete": "Delete Church",
      "deleting": "Deleting...",
      "notSoleMember": "You can only delete this church when you are the only member",
      "confirmMismatch": "Church name does not match"
    }
```

Add to root level (after `settings`):

```json
  "invite": {
    "title": "You've Been Invited",
    "description": "You've been invited to join {{churchName}} as {{role}}",
    "accept": "Accept Invitation",
    "accepting": "Accepting...",
    "expired": "This invitation has expired",
    "invalid": "This invitation is invalid or has already been used",
    "accepted": "Welcome to {{churchName}}!",
    "completeProfile": "Complete Your Profile",
    "enterName": "Enter your name to complete setup"
  },
  "roles": {
    "admin": "Admin",
    "editor": "Editor",
    "operator": "Operator",
    "adminDescription": "Full access including billing and user management",
    "editorDescription": "Create and edit songs, events, and media",
    "operatorDescription": "Control presentations during services"
  },
```

**Step 2: Add Spanish translations**

Add equivalent translations to `es.json`:

```json
    "team": {
      "title": "Miembros del Equipo",
      "members": "Miembros",
      "invitations": "Invitaciones Pendientes",
      "noMembers": "No hay miembros del equipo",
      "noInvitations": "No hay invitaciones pendientes",
      "invite": "Invitar Miembro",
      "inviteDescription": "Enviar una invitacion por correo para agregar a alguien a tu equipo",
      "email": "Correo electronico",
      "emailPlaceholder": "nombre@ejemplo.com",
      "role": "Rol",
      "send": "Enviar Invitacion",
      "sending": "Enviando...",
      "changeRole": "Cambiar Rol",
      "remove": "Eliminar",
      "resend": "Reenviar",
      "cancel": "Cancelar Invitacion",
      "expires": "Expira",
      "expired": "Expirado",
      "invitedBy": "Invitado por {{name}}",
      "lastAdmin": "No se puede eliminar al ultimo administrador",
      "lastAdminRole": "No se puede cambiar el rol del ultimo administrador",
      "confirmRemove": "Eliminar a {{name}} de esta iglesia?",
      "inviteSent": "Invitacion enviada a {{email}}",
      "inviteResent": "Invitacion reenviada",
      "inviteCanceled": "Invitacion cancelada",
      "memberRemoved": "Miembro eliminado",
      "roleChanged": "Rol actualizado",
      "alreadyMember": "Este usuario ya es miembro",
      "alreadyInvited": "Ya hay una invitacion pendiente para este correo"
    },
    "switchChurch": {
      "title": "Cambiar Iglesia",
      "current": "Actual",
      "switch": "Cambiar",
      "switching": "Cambiando..."
    },
    "deleteChurch": {
      "title": "Eliminar Iglesia",
      "warning": "Esta accion no se puede deshacer. Todas las canciones, eventos, medios y datos seran eliminados permanentemente.",
      "confirm": "Escribe el nombre de la iglesia para confirmar",
      "confirmPlaceholder": "Ingresa el nombre de la iglesia",
      "delete": "Eliminar Iglesia",
      "deleting": "Eliminando...",
      "notSoleMember": "Solo puedes eliminar esta iglesia cuando eres el unico miembro",
      "confirmMismatch": "El nombre de la iglesia no coincide"
    }
```

And root level:

```json
  "invite": {
    "title": "Has Sido Invitado",
    "description": "Has sido invitado a unirte a {{churchName}} como {{role}}",
    "accept": "Aceptar Invitacion",
    "accepting": "Aceptando...",
    "expired": "Esta invitacion ha expirado",
    "invalid": "Esta invitacion es invalida o ya ha sido usada",
    "accepted": "Bienvenido a {{churchName}}!",
    "completeProfile": "Completa Tu Perfil",
    "enterName": "Ingresa tu nombre para completar la configuracion"
  },
  "roles": {
    "admin": "Administrador",
    "editor": "Editor",
    "operator": "Operador",
    "adminDescription": "Acceso completo incluyendo facturacion y gestion de usuarios",
    "editorDescription": "Crear y editar canciones, eventos y medios",
    "operatorDescription": "Controlar presentaciones durante los servicios"
  },
```

**Step 3: Verify JSON is valid**

```bash
node -e "require('./apps/web/src/i18n/locales/en.json')"
node -e "require('./apps/web/src/i18n/locales/es.json')"
```

Expected: No errors

**Step 4: Commit**

```bash
git add apps/web/src/i18n/locales/en.json apps/web/src/i18n/locales/es.json
git commit -m "feat(i18n): add translations for user management"
```

---

## Task 7: Create TeamSection Component

**Files:**
- Create: `apps/web/src/components/settings/TeamSection.tsx`

**Step 1: Create the component**

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, useMemberships, useInvitations } from '@mobileworship/shared';
import type { Role } from '@mobileworship/shared';
import { getInvitationStatus } from '@mobileworship/shared';

export function TeamSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    churchMembers,
    isLoadingChurchMembers,
    changeRole,
    isChangingRole,
    removeMember,
    isRemovingMember,
    getAdminCount,
  } = useMemberships();
  const {
    invitations,
    isLoading: isLoadingInvitations,
    createInvitation,
    isCreating,
    resendInvitation,
    isResending,
    cancelInvitation,
    isCanceling,
  } = useInvitations();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('operator');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const pendingInvitations = invitations.filter(
    (inv) => getInvitationStatus(inv) === 'pending'
  );

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await createInvitation({ email: inviteEmail, role: inviteRole });
      setSuccess(t('settings.team.inviteSent', { email: inviteEmail }));
      setInviteEmail('');
      setInviteRole('operator');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    }
  }

  async function handleChangeRole(membershipId: string, memberId: string, newRole: Role) {
    setError(null);

    // Check if demoting the last admin
    if (newRole !== 'admin') {
      const adminCount = await getAdminCount(user!.churchId);
      const currentMember = churchMembers.find((m) => m.id === membershipId);
      if (currentMember?.role === 'admin' && adminCount <= 1) {
        setError(t('settings.team.lastAdminRole'));
        return;
      }
    }

    try {
      await changeRole({ membershipId, newRole });
      setSuccess(t('settings.team.roleChanged'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role');
    }
  }

  async function handleRemoveMember(membershipId: string, memberName: string) {
    setError(null);

    const currentMember = churchMembers.find((m) => m.id === membershipId);
    if (currentMember?.role === 'admin') {
      const adminCount = await getAdminCount(user!.churchId);
      if (adminCount <= 1) {
        setError(t('settings.team.lastAdmin'));
        return;
      }
    }

    if (!confirm(t('settings.team.confirmRemove', { name: memberName }))) {
      return;
    }

    try {
      await removeMember(membershipId);
      setSuccess(t('settings.team.memberRemoved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  }

  async function handleResendInvitation(invitationId: string) {
    setError(null);
    try {
      await resendInvitation(invitationId);
      setSuccess(t('settings.team.inviteResent'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invitation');
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    setError(null);
    try {
      await cancelInvitation(invitationId);
      setSuccess(t('settings.team.inviteCanceled'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invitation');
    }
  }

  function formatExpiry(expiresAt: string) {
    const days = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return `${days} days`;
  }

  return (
    <section>
      <h3 className="text-lg font-semibold mb-4">{t('settings.team.title')}</h3>

      {(error || success) && (
        <div
          className={`mb-4 p-3 rounded-lg ${
            error
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          }`}
        >
          {error || success}
        </div>
      )}

      <div className="space-y-6">
        {/* Invite Form */}
        <div className="p-4 border dark:border-gray-700 rounded-lg">
          <h4 className="font-medium mb-2">{t('settings.team.invite')}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {t('settings.team.inviteDescription')}
          </p>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={t('settings.team.emailPlaceholder')}
              required
              className="flex-1 px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="admin">{t('roles.admin')}</option>
              <option value="editor">{t('roles.editor')}</option>
              <option value="operator">{t('roles.operator')}</option>
            </select>
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {isCreating ? t('settings.team.sending') : t('settings.team.send')}
            </button>
          </form>
        </div>

        {/* Members List */}
        <div className="p-4 border dark:border-gray-700 rounded-lg">
          <h4 className="font-medium mb-4">{t('settings.team.members')}</h4>
          {isLoadingChurchMembers ? (
            <p className="text-gray-500">{t('common.loading')}</p>
          ) : churchMembers.length === 0 ? (
            <p className="text-gray-500">{t('settings.team.noMembers')}</p>
          ) : (
            <div className="space-y-3">
              {churchMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-2 border-b dark:border-gray-700 last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {member.user?.name}
                      {member.userId === user?.id && (
                        <span className="ml-2 text-xs text-gray-500">(you)</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {member.user?.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleChangeRole(member.id, member.userId, e.target.value as Role)
                      }
                      disabled={isChangingRole || member.userId === user?.id}
                      className="px-2 py-1 text-sm border dark:border-gray-700 rounded bg-white dark:bg-gray-800 disabled:opacity-50"
                    >
                      <option value="admin">{t('roles.admin')}</option>
                      <option value="editor">{t('roles.editor')}</option>
                      <option value="operator">{t('roles.operator')}</option>
                    </select>
                    {member.userId !== user?.id && (
                      <button
                        onClick={() => handleRemoveMember(member.id, member.user?.name || '')}
                        disabled={isRemovingMember}
                        className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                      >
                        {t('settings.team.remove')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Invitations */}
        <div className="p-4 border dark:border-gray-700 rounded-lg">
          <h4 className="font-medium mb-4">{t('settings.team.invitations')}</h4>
          {isLoadingInvitations ? (
            <p className="text-gray-500">{t('common.loading')}</p>
          ) : pendingInvitations.length === 0 ? (
            <p className="text-gray-500">{t('settings.team.noInvitations')}</p>
          ) : (
            <div className="space-y-3">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between py-2 border-b dark:border-gray-700 last:border-0"
                >
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('roles.' + invitation.role)} &middot;{' '}
                      {t('settings.team.expires')} {formatExpiry(invitation.expiresAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResendInvitation(invitation.id)}
                      disabled={isResending}
                      className="px-2 py-1 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded"
                    >
                      {t('settings.team.resend')}
                    </button>
                    <button
                      onClick={() => handleCancelInvitation(invitation.id)}
                      disabled={isCanceling}
                      className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                    >
                      {t('settings.team.cancel')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Verify build**

```bash
pnpm build --filter=@mobileworship/web
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/src/components/settings/TeamSection.tsx
git commit -m "feat(ui): add TeamSection component for member management"
```

---

## Task 8: Create ChurchSwitcher Component

**Files:**
- Create: `apps/web/src/components/settings/ChurchSwitcher.tsx`

**Step 1: Create the component**

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, useMemberships } from '@mobileworship/shared';

export function ChurchSwitcher() {
  const { t } = useTranslation();
  const { user, switchChurch } = useAuth();
  const { myMemberships, isLoadingMyMemberships } = useMemberships();
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSwitch(churchId: string) {
    if (churchId === user?.churchId) return;

    setIsSwitching(churchId);
    setError(null);

    try {
      await switchChurch(churchId);
      // Page will reload with new church context
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch church');
      setIsSwitching(null);
    }
  }

  if (isLoadingMyMemberships) {
    return (
      <section>
        <h3 className="text-lg font-semibold mb-4">{t('settings.switchChurch.title')}</h3>
        <div className="p-4 border dark:border-gray-700 rounded-lg">
          <p className="text-gray-500">{t('common.loading')}</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-lg font-semibold mb-4">{t('settings.switchChurch.title')}</h3>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="p-4 border dark:border-gray-700 rounded-lg">
        <div className="space-y-2">
          {myMemberships.map((membership) => (
            <div
              key={membership.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                membership.churchId === user?.churchId
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div>
                <p className="font-medium">{membership.church?.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('roles.' + membership.role)}
                </p>
              </div>
              {membership.churchId === user?.churchId ? (
                <span className="px-3 py-1 text-sm text-primary-600 dark:text-primary-400 font-medium">
                  {t('settings.switchChurch.current')}
                </span>
              ) : (
                <button
                  onClick={() => handleSwitch(membership.churchId)}
                  disabled={isSwitching !== null}
                  className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                >
                  {isSwitching === membership.churchId
                    ? t('settings.switchChurch.switching')
                    : t('settings.switchChurch.switch')}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Verify build**

```bash
pnpm build --filter=@mobileworship/web
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/src/components/settings/ChurchSwitcher.tsx
git commit -m "feat(ui): add ChurchSwitcher component"
```

---

## Task 9: Create DeleteChurchSection Component

**Files:**
- Create: `apps/web/src/components/settings/DeleteChurchSection.tsx`

**Step 1: Create the component**

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth, useSupabase, useMemberships } from '@mobileworship/shared';

export function DeleteChurchSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabase = useSupabase();
  const { churchMembers } = useMemberships();

  const [churchName, setChurchName] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show if user is sole member
  const isSoleMember = churchMembers.length === 1;

  // Fetch church name on mount
  useState(() => {
    if (user?.churchId) {
      supabase
        .from('churches')
        .select('name')
        .eq('id', user.churchId)
        .single()
        .then(({ data }) => {
          if (data) setChurchName(data.name);
        });
    }
  });

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (confirmName !== churchName) {
      setError(t('settings.deleteChurch.confirmMismatch'));
      return;
    }

    setIsDeleting(true);

    try {
      const { error: deleteError } = await supabase.rpc('delete_church', {
        p_church_id: user?.churchId,
        p_confirmation: confirmName,
      });

      if (deleteError) throw deleteError;

      // Sign out and redirect to home
      await supabase.auth.signOut();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete church');
      setIsDeleting(false);
    }
  }

  if (!isSoleMember) {
    return (
      <section>
        <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">
          {t('settings.deleteChurch.title')}
        </h3>
        <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
          <p className="text-gray-600 dark:text-gray-400">
            {t('settings.deleteChurch.notSoleMember')}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">
        {t('settings.deleteChurch.title')}
      </h3>

      <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
        <p className="text-red-700 dark:text-red-300 mb-4">
          {t('settings.deleteChurch.warning')}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleDelete} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('settings.deleteChurch.confirm')}
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Type "<strong>{churchName}</strong>" to confirm
            </p>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={t('settings.deleteChurch.confirmPlaceholder')}
              className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-800"
            />
          </div>
          <button
            type="submit"
            disabled={isDeleting || confirmName !== churchName}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? t('settings.deleteChurch.deleting') : t('settings.deleteChurch.delete')}
          </button>
        </form>
      </div>
    </section>
  );
}
```

**Step 2: Verify build**

```bash
pnpm build --filter=@mobileworship/web
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/src/components/settings/DeleteChurchSection.tsx
git commit -m "feat(ui): add DeleteChurchSection component"
```

---

## Task 10: Update SettingsPage

**Files:**
- Modify: `apps/web/src/pages/SettingsPage.tsx`

**Step 1: Import and add new components**

Update the imports at the top:

```typescript
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, useSupabase } from '@mobileworship/shared';
import { useTheme } from '../contexts/ThemeContext';
import { supportedLanguages } from '../i18n';
import { TeamSection } from '../components/settings/TeamSection';
import { ChurchSwitcher } from '../components/settings/ChurchSwitcher';
import { DeleteChurchSection } from '../components/settings/DeleteChurchSection';
```

**Step 2: Add hasMultipleChurches to useAuth**

Update the useAuth destructuring:

```typescript
const { user, can, hasMultipleChurches } = useAuth();
```

**Step 3: Replace the placeholder Team section**

Replace the existing Team section (around line 211-218):

```typescript
{can('church:users') && <TeamSection />}
```

**Step 4: Add Church Switcher after Team section**

```typescript
{hasMultipleChurches && <ChurchSwitcher />}
```

**Step 5: Add Delete Church section after Billing**

```typescript
{can('church:manage') && <DeleteChurchSection />}
```

**Step 6: Verify build**

```bash
pnpm build --filter=@mobileworship/web
```

Expected: Build succeeds

**Step 7: Commit**

```bash
git add apps/web/src/pages/SettingsPage.tsx
git commit -m "feat(ui): integrate user management into SettingsPage"
```

---

## Task 11: Create Invite Acceptance Page

**Files:**
- Create: `apps/web/src/pages/AcceptInvitePage.tsx`
- Modify: `apps/web/src/App.tsx`

**Step 1: Create the page component**

```typescript
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, useInvitations, useSupabase } from '@mobileworship/shared';
import type { Invitation } from '@mobileworship/shared';
import { getInvitationStatus } from '@mobileworship/shared';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function AcceptInvitePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { acceptInvitation, isAccepting, getInvitationByToken } = useInvitations();
  const supabase = useSupabase();

  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [churchName, setChurchName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (!token) {
      setError(t('invite.invalid'));
      setIsLoading(false);
      return;
    }

    // Fetch invitation details
    getInvitationByToken(token).then(async (inv) => {
      if (!inv) {
        setError(t('invite.invalid'));
        setIsLoading(false);
        return;
      }

      const status = getInvitationStatus(inv);
      if (status === 'expired') {
        setError(t('invite.expired'));
        setIsLoading(false);
        return;
      }
      if (status === 'accepted') {
        // Already accepted, redirect to dashboard
        navigate('/dashboard');
        return;
      }

      setInvitation(inv);

      // Fetch church name
      const { data: church } = await supabase
        .from('churches')
        .select('name')
        .eq('id', inv.churchId)
        .single();

      if (church) {
        setChurchName(church.name);
      }

      setIsLoading(false);
    });
  }, [token]);

  useEffect(() => {
    // Check if user needs to create profile
    if (user && !isAuthLoading) {
      // User is logged in, check if they have a profile
      supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (!data) {
            setNeedsProfile(true);
          }
        });
    }
  }, [user, isAuthLoading]);

  async function handleAccept() {
    if (!token || !invitation) return;

    setError(null);

    try {
      // If user needs profile, create it first
      if (needsProfile && userName.trim()) {
        await supabase.from('users').insert({
          id: user!.id,
          name: userName.trim(),
          email: user!.email,
        });
      }

      const result = await acceptInvitation(token);

      // Update current church in JWT
      await supabase.auth.updateUser({
        data: { current_church_id: result.church_id },
      });

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invite.invalid'));
    }
  }

  if (isLoading || isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">{t('invite.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            {t('auth.signIn')}
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    // Not logged in, redirect to login with return URL
    navigate(`/login?redirect=/accept-invite?token=${token}`);
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="text-center mb-6">
          <div className="text-primary-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('invite.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('invite.description', {
              churchName,
              role: t('roles.' + invitation?.role),
            })}
          </p>
        </div>

        {needsProfile && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              {t('invite.enterName')}
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={t('auth.name')}
              className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
              required
            />
          </div>
        )}

        <button
          onClick={handleAccept}
          disabled={isAccepting || (needsProfile && !userName.trim())}
          className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
        >
          {isAccepting ? t('invite.accepting') : t('invite.accept')}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Add route to App.tsx**

Import the page:

```typescript
import { AcceptInvitePage } from './pages/AcceptInvitePage';
```

Add route before the dashboard routes:

```typescript
<Route path="/accept-invite" element={<AcceptInvitePage />} />
```

**Step 3: Verify build**

```bash
pnpm build --filter=@mobileworship/web
```

Expected: Build succeeds

**Step 4: Commit**

```bash
git add apps/web/src/pages/AcceptInvitePage.tsx apps/web/src/App.tsx
git commit -m "feat(ui): add invitation acceptance page"
```

---

## Task 12: Update Header with Church Name

**Files:**
- Modify: `apps/web/src/pages/DashboardLayout.tsx`

**Step 1: Read the current file to understand structure**

Read the file first to see the current implementation.

**Step 2: Add church name display to header**

Find the header section and add after the logo/app name:

```typescript
{user && (
  <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
    &middot; {churchName}
  </span>
)}
```

Add state and effect to fetch church name:

```typescript
const [churchName, setChurchName] = useState('');

useEffect(() => {
  if (user?.churchId) {
    supabase
      .from('churches')
      .select('name')
      .eq('id', user.churchId)
      .single()
      .then(({ data }) => {
        if (data) setChurchName(data.name);
      });
  }
}, [user?.churchId]);
```

**Step 3: Verify build**

```bash
pnpm build --filter=@mobileworship/web
```

Expected: Build succeeds

**Step 4: Commit**

```bash
git add apps/web/src/pages/DashboardLayout.tsx
git commit -m "feat(ui): display current church name in header"
```

---

## Task 13: Create Component Index Files

**Files:**
- Create: `apps/web/src/components/settings/index.ts`

**Step 1: Create index file**

```typescript
export { TeamSection } from './TeamSection';
export { ChurchSwitcher } from './ChurchSwitcher';
export { DeleteChurchSection } from './DeleteChurchSection';
```

**Step 2: Commit**

```bash
git add apps/web/src/components/settings/index.ts
git commit -m "chore: add settings components index"
```

---

## Task 14: Final Integration Test

**Step 1: Run full build**

```bash
pnpm build
```

Expected: All packages build successfully

**Step 2: Run tests**

```bash
pnpm test
```

Expected: All tests pass

**Step 3: Run linter**

```bash
pnpm lint
```

Expected: No lint errors

**Step 4: Final commit if needed**

Fix any issues and commit.

---

## Summary

This implementation plan covers:

1. **Database migration** - New tables, functions, RLS policies
2. **Shared types** - ChurchMembership, Invitation types
3. **Hooks** - useMemberships, useInvitations
4. **Auth update** - Multi-church support with switchChurch
5. **i18n** - All new translation keys
6. **UI Components** - TeamSection, ChurchSwitcher, DeleteChurchSection
7. **Pages** - AcceptInvitePage, updated SettingsPage
8. **Header** - Church name display

Total: 14 tasks with incremental commits at each step.
