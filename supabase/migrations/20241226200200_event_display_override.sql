-- Migration: Add display override to events
-- NULL = use church defaults, populated = specific displays for this event

ALTER TABLE events ADD COLUMN display_ids uuid[];

COMMENT ON COLUMN events.display_ids IS 'Override display IDs for this event; NULL uses church defaults';

-- Helper function to resolve which displays an event should use
CREATE OR REPLACE FUNCTION get_event_displays(p_event_id uuid)
RETURNS uuid[] AS $$
  SELECT COALESCE(
    NULLIF(e.display_ids, '{}'),  -- Event override (if not empty)
    c.default_display_ids         -- Church defaults
  )
  FROM events e
  JOIN churches c ON c.id = e.church_id
  WHERE e.id = p_event_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_event_displays IS 'Returns display IDs for an event, falling back to church defaults';
