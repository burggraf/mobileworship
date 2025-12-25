-- Fix displays RLS policies to allow update/delete operations
-- The issue: UPDATE policy's implicit WITH CHECK prevents setting church_id to NULL

-- Drop existing policies
DROP POLICY IF EXISTS "displays_select" ON displays;
DROP POLICY IF EXISTS "displays_insert" ON displays;
DROP POLICY IF EXISTS "displays_update" ON displays;
DROP POLICY IF EXISTS "displays_delete" ON displays;
DROP POLICY IF EXISTS "displays_service" ON displays;

-- Recreate with proper permissions

-- Users can view displays for their church
CREATE POLICY "displays_select" ON displays
  FOR SELECT TO authenticated
  USING (church_id = get_user_church_id());

-- Users can insert displays for their church (via edge function claiming)
CREATE POLICY "displays_insert" ON displays
  FOR INSERT TO authenticated
  WITH CHECK (church_id = get_user_church_id());

-- Users can update displays for their church
-- WITH CHECK allows keeping same church_id OR setting to NULL (unpair)
CREATE POLICY "displays_update" ON displays
  FOR UPDATE TO authenticated
  USING (church_id = get_user_church_id())
  WITH CHECK (church_id = get_user_church_id() OR church_id IS NULL);

-- Users can delete displays for their church
CREATE POLICY "displays_delete" ON displays
  FOR DELETE TO authenticated
  USING (church_id = get_user_church_id());

-- Service role can manage all displays (for edge functions)
CREATE POLICY "displays_service" ON displays
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon can view unpaired displays (for pairing screen verification)
CREATE POLICY "displays_anon_select_unpaired" ON displays
  FOR SELECT TO anon
  USING (church_id IS NULL);
