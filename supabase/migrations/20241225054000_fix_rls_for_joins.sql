-- Fix RLS policies to work correctly with JOINs
-- The issue is that when PostgREST does a JOIN (e.g., invitations with users:invited_by),
-- the RLS policies on the joined table (users) are evaluated and can fail if they
-- depend on functions that require the current user's church context.

-- First, let's make get_current_church_id return NULL safely if not set
CREATE OR REPLACE FUNCTION get_current_church_id()
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt() -> 'user_metadata' ->> 'current_church_id')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Make get_current_role handle NULL current_church_id gracefully
CREATE OR REPLACE FUNCTION get_current_role()
RETURNS TEXT AS $$
DECLARE
  church UUID;
  user_role TEXT;
BEGIN
  church := get_current_church_id();
  IF church IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO user_role
  FROM church_memberships
  WHERE user_id = auth.uid()
  AND church_id = church;

  RETURN user_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Drop existing policies on users table
DROP POLICY IF EXISTS "View users in member churches" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;

-- Create a simpler, more permissive SELECT policy for users
-- Users can view: their own profile, OR any user in their current church, OR any user who invited them
DROP POLICY IF EXISTS "Users can view profiles" ON users;
CREATE POLICY "Users can view profiles" ON users
  FOR SELECT USING (
    -- Own profile
    id = auth.uid()
    OR
    -- Users in same church (using SECURITY DEFINER function)
    id IN (SELECT get_church_user_ids(get_current_church_id()))
  );

-- Drop existing policies on church_memberships
DROP POLICY IF EXISTS "View memberships in my churches" ON church_memberships;
DROP POLICY IF EXISTS "View own memberships" ON church_memberships;
DROP POLICY IF EXISTS "View church memberships" ON church_memberships;

-- Create a comprehensive SELECT policy for church_memberships
-- Use get_user_church_ids() SECURITY DEFINER function to avoid recursion
CREATE POLICY "View church memberships" ON church_memberships
  FOR SELECT USING (
    -- Use SECURITY DEFINER function to avoid recursive RLS
    church_id IN (SELECT get_user_church_ids())
  );

-- Drop existing policies on invitations
DROP POLICY IF EXISTS "Admins view church invitations" ON invitations;
DROP POLICY IF EXISTS "Admins insert invitations" ON invitations;
DROP POLICY IF EXISTS "Admins update invitations" ON invitations;
DROP POLICY IF EXISTS "Admins delete invitations" ON invitations;
DROP POLICY IF EXISTS "View invitation by token" ON invitations;

-- Create comprehensive policies for invitations
-- Anyone can SELECT by token (for accepting invitations)
CREATE POLICY "View invitation by token" ON invitations
  FOR SELECT USING (true);

-- Admins can INSERT invitations for their current church
CREATE POLICY "Admins insert invitations" ON invitations
  FOR INSERT WITH CHECK (
    get_current_church_id() IS NOT NULL
    AND church_id = get_current_church_id()
    AND get_current_role() = 'admin'
  );

-- Admins can UPDATE invitations in their current church
CREATE POLICY "Admins update invitations" ON invitations
  FOR UPDATE USING (
    get_current_church_id() IS NOT NULL
    AND church_id = get_current_church_id()
    AND get_current_role() = 'admin'
  );

-- Admins can DELETE invitations in their current church
CREATE POLICY "Admins delete invitations" ON invitations
  FOR DELETE USING (
    get_current_church_id() IS NOT NULL
    AND church_id = get_current_church_id()
    AND get_current_role() = 'admin'
  );
