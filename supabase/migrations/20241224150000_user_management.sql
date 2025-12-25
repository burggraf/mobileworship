-- User Management Schema Update
-- Adds multi-church support with memberships and invitations

-- ============================================
-- PHASE 1: Create new tables (non-breaking)
-- ============================================

-- Church memberships (many-to-many users <-> churches)
CREATE TABLE church_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'editor', 'operator')),
  invited_by UUID NOT NULL REFERENCES auth.users,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
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

-- Drop old user policies (various naming conventions)
DROP POLICY IF EXISTS "Users can view users in their church" ON users;
DROP POLICY IF EXISTS "Admins can manage users in their church" ON users;
DROP POLICY IF EXISTS "Users can view church members" ON users;
DROP POLICY IF EXISTS "Admins can update church users" ON users;
DROP POLICY IF EXISTS "Admins can delete church users" ON users;

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
