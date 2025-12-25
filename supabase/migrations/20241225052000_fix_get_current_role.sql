-- Fix get_current_role to use SECURITY DEFINER to bypass RLS
-- This prevents potential circular dependency issues when evaluating RLS policies

CREATE OR REPLACE FUNCTION get_current_role()
RETURNS TEXT AS $$
  SELECT role FROM church_memberships
  WHERE user_id = auth.uid()
  AND church_id = get_current_church_id();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Also ensure invitations and memberships policies work correctly by making sure
-- the view policies don't depend on get_current_role() for SELECT operations

-- The "View invitation by token" policy allows anyone to SELECT, which is fine
-- The "Admins manage invitations" policy uses get_current_role() for INSERT/UPDATE/DELETE

-- For memberships, let's also ensure admins can view all memberships in their current church
-- without needing get_current_role() (which would create circular dependency)
DROP POLICY IF EXISTS "View memberships in my churches" ON church_memberships;
CREATE POLICY "View memberships in my churches" ON church_memberships
  FOR SELECT USING (
    church_id = get_current_church_id()
    OR church_id IN (SELECT get_user_church_ids())
  );
