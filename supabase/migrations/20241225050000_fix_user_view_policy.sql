-- Fix: Allow users to always view their own profile
-- This is needed because the current policy requires get_current_church_id() to be set,
-- but during login the user needs to read their profile to determine their church

CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (id = auth.uid());
