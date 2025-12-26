-- Migration: Add local network columns to displays table
-- Enables hosts to report their local IP for direct WebSocket connections

-- Add local network columns
ALTER TABLE displays ADD COLUMN local_ip inet;
ALTER TABLE displays ADD COLUMN local_port integer DEFAULT 8765;
ALTER TABLE displays ADD COLUMN local_ip_updated_at timestamptz;

-- Index for finding displays with recent local IPs
CREATE INDEX idx_displays_local_ip_updated
ON displays(church_id, local_ip_updated_at DESC NULLS LAST)
WHERE local_ip IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN displays.local_ip IS 'Local network IP address reported by host for direct WebSocket connection';
COMMENT ON COLUMN displays.local_port IS 'WebSocket server port on host (default 8765)';
COMMENT ON COLUMN displays.local_ip_updated_at IS 'When local_ip was last updated; stale if > 10 min';
