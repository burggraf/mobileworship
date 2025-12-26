-- Allow anon role to update displays for heartbeat functionality
-- The host app runs unauthenticated and needs to update last_seen_at
CREATE POLICY "displays_anon_heartbeat" ON displays
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
