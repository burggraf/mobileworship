-- Simplify users RLS policy to fix JOINs
-- The issue: Complex policies using get_church_user_ids(get_current_church_id())
-- fail during JOINs because the context may not be properly set.
--
-- Solution: Allow any authenticated user to SELECT from users table.
-- User profile data (name, email) is not sensitive in this context.
-- The actual access control is on invitations and church_memberships tables.

-- Drop all existing SELECT policies on users
DROP POLICY IF EXISTS "Users can view profiles" ON users;
DROP POLICY IF EXISTS "View users in member churches" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;

-- Simple policy: authenticated users can view all user profiles
CREATE POLICY "Authenticated users can view profiles" ON users
  FOR SELECT TO authenticated
  USING (true);

-- Also simplify church_memberships SELECT policy
DROP POLICY IF EXISTS "View church memberships" ON church_memberships;
DROP POLICY IF EXISTS "View memberships in my churches" ON church_memberships;
DROP POLICY IF EXISTS "View own memberships" ON church_memberships;

-- Authenticated users can view memberships in churches they belong to
-- Use get_user_church_ids() SECURITY DEFINER function to avoid recursion
CREATE POLICY "View church memberships" ON church_memberships
  FOR SELECT TO authenticated
  USING (
    -- Use SECURITY DEFINER function to avoid recursive RLS
    church_id IN (SELECT get_user_church_ids())
  );
