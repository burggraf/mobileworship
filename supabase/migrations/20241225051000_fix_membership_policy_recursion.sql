-- Fix infinite recursion in church_memberships policy
-- The "View memberships in my churches" policy queries church_memberships
-- to determine what you can see in church_memberships, causing recursion.
-- Solution: Use a SECURITY DEFINER function to avoid the recursion.

-- First, drop the problematic policy
DROP POLICY IF EXISTS "View memberships in my churches" ON church_memberships;

-- Create a helper function that bypasses RLS to get user's church IDs
CREATE OR REPLACE FUNCTION get_user_church_ids()
RETURNS SETOF UUID AS $$
  SELECT church_id FROM church_memberships WHERE user_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Recreate the policy using the function
CREATE POLICY "View memberships in my churches" ON church_memberships
  FOR SELECT USING (
    church_id IN (SELECT get_user_church_ids())
  );

GRANT EXECUTE ON FUNCTION get_user_church_ids TO authenticated;
