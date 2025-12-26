-- Set replica identity to FULL so postgres_changes includes old row values
-- This is needed to detect when paired_at changes from NULL to a value
ALTER TABLE displays REPLICA IDENTITY FULL;
