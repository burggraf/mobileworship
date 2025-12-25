-- Fix church_memberships RLS policy to use SECURITY DEFINER function
-- This avoids the recursive RLS check that was causing queries to fail

-- Drop the current policy that has recursive subquery
DROP POLICY IF EXISTS "View church memberships" ON church_memberships;

-- Recreate using the SECURITY DEFINER function
CREATE POLICY "View church memberships" ON church_memberships
  FOR SELECT TO authenticated
  USING (
    -- Use SECURITY DEFINER function to avoid recursive RLS
    church_id IN (SELECT get_user_church_ids())
  );
