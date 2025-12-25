-- Fix RLS policies for users and invitations to avoid circular dependencies
-- The issue is that "View users in member churches" policy queries church_memberships,
-- which creates a cascade of RLS checks that can fail

-- Create a SECURITY DEFINER function to check church membership without RLS
CREATE OR REPLACE FUNCTION get_church_user_ids(p_church_id UUID)
RETURNS SETOF UUID AS $$
  SELECT user_id FROM church_memberships WHERE church_id = p_church_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Drop the problematic policy
DROP POLICY IF EXISTS "View users in member churches" ON users;

-- Create a better policy using SECURITY DEFINER function
CREATE POLICY "View users in member churches" ON users
  FOR SELECT USING (
    id IN (SELECT get_church_user_ids(get_current_church_id()))
  );

-- For invitations, the "Admins manage invitations" policy handles admin access
-- But we should also have a separate SELECT policy for admins that's more explicit
-- The "View invitation by token" policy already allows anyone to SELECT by token

-- Make sure the invitations policies work correctly by creating a
-- separate SELECT policy for admins (instead of ALL)
DROP POLICY IF EXISTS "Admins manage invitations" ON invitations;

-- Admins can view all invitations for their church
DROP POLICY IF EXISTS "Admins view church invitations" ON invitations;
CREATE POLICY "Admins view church invitations" ON invitations
  FOR SELECT USING (
    church_id = get_current_church_id()
    AND get_current_role() = 'admin'
  );

-- Admins can insert invitations for their church
DROP POLICY IF EXISTS "Admins insert invitations" ON invitations;
CREATE POLICY "Admins insert invitations" ON invitations
  FOR INSERT WITH CHECK (
    church_id = get_current_church_id()
    AND get_current_role() = 'admin'
  );

-- Admins can update invitations for their church
DROP POLICY IF EXISTS "Admins update invitations" ON invitations;
CREATE POLICY "Admins update invitations" ON invitations
  FOR UPDATE USING (
    church_id = get_current_church_id()
    AND get_current_role() = 'admin'
  );

-- Admins can delete invitations for their church
DROP POLICY IF EXISTS "Admins delete invitations" ON invitations;
CREATE POLICY "Admins delete invitations" ON invitations
  FOR DELETE USING (
    church_id = get_current_church_id()
    AND get_current_role() = 'admin'
  );
