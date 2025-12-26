-- Fix: Allow users to view churches they have pending invitations to
-- This fixes the "blank page" issue when existing users from other churches
-- try to accept an invitation - the JOIN to churches was failing due to RLS.

-- Add a policy that allows viewing a church if you have a pending invitation to it
CREATE POLICY "View church with pending invitation" ON churches
  FOR SELECT USING (
    id IN (
      SELECT church_id FROM invitations
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND accepted_at IS NULL
      AND expires_at > NOW()
    )
  );
