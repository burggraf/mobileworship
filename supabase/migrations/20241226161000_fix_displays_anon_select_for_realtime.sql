-- Drop the restrictive unpaired-only policy
DROP POLICY IF EXISTS "displays_anon_select_unpaired" ON displays;

-- Allow anon to SELECT any display by ID
-- This is needed for realtime subscriptions to work after pairing
-- Security: Display IDs are UUIDs (unguessable), host only subscribes to its own
CREATE POLICY "displays_anon_select" ON displays
  FOR SELECT TO anon
  USING (true);
