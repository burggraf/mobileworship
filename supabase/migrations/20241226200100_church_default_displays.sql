-- Migration: Add default display configuration to churches
-- Allows churches to set which displays are used by default for events

ALTER TABLE churches ADD COLUMN default_display_ids uuid[] DEFAULT '{}';

COMMENT ON COLUMN churches.default_display_ids IS 'Default display IDs used for events when not overridden';
