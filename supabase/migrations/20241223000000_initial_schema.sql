-- Mobile Worship Initial Schema
-- Multi-tenant worship lyrics display application

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Churches (tenants)
CREATE TABLE churches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  attendance_bracket TEXT CHECK (attendance_bracket IN ('<100', '100-500', '500-1000', '1000+')),
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'trialing' CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled')),
  ccli_license_number TEXT,
  planning_center_token TEXT, -- encrypted
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (linked to auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'editor', 'operator')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Songs library
CREATE TABLE songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  ccli_song_id TEXT,
  key TEXT,
  tempo INTEGER,
  content JSONB NOT NULL DEFAULT '{"sections": []}',
  default_arrangement JSONB,
  default_background_id UUID,
  transition_type TEXT DEFAULT 'fade',
  tags TEXT[] DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Media library
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'video')),
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  source TEXT DEFAULT 'upload' CHECK (source IN ('upload', 'unsplash', 'pexels')),
  source_id TEXT,
  dominant_color TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for song backgrounds
ALTER TABLE songs ADD CONSTRAINT songs_default_background_fkey
  FOREIGN KEY (default_background_id) REFERENCES media(id) ON DELETE SET NULL;

-- Events (services)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches ON DELETE CASCADE,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  items JSONB NOT NULL DEFAULT '[]',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'live', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Song usage for CCLI reporting
CREATE TABLE song_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs ON DELETE CASCADE,
  event_id UUID REFERENCES events ON DELETE SET NULL,
  ccli_song_id TEXT,
  displayed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_church_id ON users(church_id);
CREATE INDEX idx_songs_church_id ON songs(church_id);
CREATE INDEX idx_songs_title ON songs(church_id, title);
CREATE INDEX idx_songs_last_used ON songs(church_id, last_used_at DESC);
CREATE INDEX idx_media_church_id ON media(church_id);
CREATE INDEX idx_media_type ON media(church_id, type);
CREATE INDEX idx_events_church_id ON events(church_id);
CREATE INDEX idx_events_scheduled ON events(church_id, scheduled_at DESC);
CREATE INDEX idx_song_usage_church_id ON song_usage(church_id);
CREATE INDEX idx_song_usage_displayed ON song_usage(church_id, displayed_at);

-- Helper function to get current user's church_id
CREATE OR REPLACE FUNCTION get_user_church_id()
RETURNS UUID AS $$
  SELECT church_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Row Level Security Policies

-- Churches: Users can only see their own church
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their church" ON churches
  FOR SELECT USING (id = get_user_church_id());

CREATE POLICY "Admins can update their church" ON churches
  FOR UPDATE USING (id = get_user_church_id() AND get_user_role() = 'admin');

-- Users: Scoped to church
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view users in their church" ON users
  FOR SELECT USING (church_id = get_user_church_id());

CREATE POLICY "Admins can manage users in their church" ON users
  FOR ALL USING (church_id = get_user_church_id() AND get_user_role() = 'admin');

-- Songs: Scoped to church with role-based write
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view songs in their church" ON songs
  FOR SELECT USING (church_id = get_user_church_id());

CREATE POLICY "Editors and admins can manage songs" ON songs
  FOR ALL USING (church_id = get_user_church_id() AND get_user_role() IN ('admin', 'editor'));

-- Media: Scoped to church with role-based write
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view media in their church" ON media
  FOR SELECT USING (church_id = get_user_church_id());

CREATE POLICY "Editors and admins can manage media" ON media
  FOR ALL USING (church_id = get_user_church_id() AND get_user_role() IN ('admin', 'editor'));

-- Events: Scoped to church with role-based write
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events in their church" ON events
  FOR SELECT USING (church_id = get_user_church_id());

CREATE POLICY "Editors and admins can manage events" ON events
  FOR ALL USING (church_id = get_user_church_id() AND get_user_role() IN ('admin', 'editor'));

-- Song usage: Scoped to church, all users can insert (for tracking)
ALTER TABLE song_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view song usage in their church" ON song_usage
  FOR SELECT USING (church_id = get_user_church_id());

CREATE POLICY "Users can track song usage" ON song_usage
  FOR INSERT WITH CHECK (church_id = get_user_church_id());

-- Storage bucket for media files
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can view media files from their church" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'media' AND
    (storage.foldername(name))[1] = get_user_church_id()::text
  );

CREATE POLICY "Editors can upload media files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'media' AND
    (storage.foldername(name))[1] = get_user_church_id()::text AND
    get_user_role() IN ('admin', 'editor')
  );

CREATE POLICY "Editors can delete media files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'media' AND
    (storage.foldername(name))[1] = get_user_church_id()::text AND
    get_user_role() IN ('admin', 'editor')
  );
