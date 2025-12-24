-- Migration: Add displays table for host device management
-- Displays can be unpaired (church_id NULL) or paired to a church

-- Helper function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create displays table for host device management
CREATE TABLE displays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid REFERENCES churches ON DELETE CASCADE,

  -- Identity
  name text NOT NULL DEFAULT 'Unnamed Display',
  location text,

  -- Pairing
  pairing_code text,
  pairing_code_expires_at timestamptz,
  paired_at timestamptz,

  -- Status
  last_seen_at timestamptz,
  device_info jsonb DEFAULT '{}',

  -- Settings
  default_background_id uuid REFERENCES media ON DELETE SET NULL,
  settings jsonb DEFAULT '{
    "fontSize": "medium",
    "textPosition": "center",
    "margins": {"top": 5, "bottom": 10, "left": 5, "right": 5},
    "fontFamily": "system",
    "textShadow": true,
    "overlayOpacity": 0.3
  }',

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE displays ENABLE ROW LEVEL SECURITY;

-- Users can view displays for their church
CREATE POLICY "displays_select" ON displays
  FOR SELECT USING (church_id = get_user_church_id());

-- Users can insert displays for their church
CREATE POLICY "displays_insert" ON displays
  FOR INSERT WITH CHECK (church_id = get_user_church_id());

-- Users can update displays for their church
CREATE POLICY "displays_update" ON displays
  FOR UPDATE USING (church_id = get_user_church_id());

-- Users can delete displays for their church
CREATE POLICY "displays_delete" ON displays
  FOR DELETE USING (church_id = get_user_church_id());

-- Service role can manage all displays (for edge functions)
CREATE POLICY "displays_service" ON displays
  FOR ALL USING (auth.role() = 'service_role');

-- Index for pairing code lookups (edge function uses this)
CREATE INDEX idx_displays_pairing_code ON displays(pairing_code)
  WHERE pairing_code IS NOT NULL;

-- Unique constraint to prevent duplicate pairing codes
CREATE UNIQUE INDEX idx_displays_unique_pairing_code
ON displays(pairing_code)
WHERE pairing_code IS NOT NULL;

-- Index for church lookups
CREATE INDEX idx_displays_church_id ON displays(church_id);

-- Index for last_seen_at queries (online/offline status)
CREATE INDEX idx_displays_church_last_seen ON displays(church_id, last_seen_at DESC NULLS LAST);

-- Trigger to update updated_at
CREATE TRIGGER displays_updated_at
  BEFORE UPDATE ON displays
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
