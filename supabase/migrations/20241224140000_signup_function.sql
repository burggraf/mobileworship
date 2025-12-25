-- Create a function to handle user signup that bypasses RLS
-- This is necessary because new users don't have a profile yet,
-- so they can't pass the RLS checks to create a church

CREATE OR REPLACE FUNCTION create_church_and_user(
  p_user_id UUID,
  p_church_name TEXT,
  p_user_name TEXT,
  p_user_email TEXT
)
RETURNS JSON AS $$
DECLARE
  v_church_id UUID;
  v_result JSON;
BEGIN
  -- Create the church
  INSERT INTO churches (name)
  VALUES (p_church_name)
  RETURNING id INTO v_church_id;

  -- Create the user profile
  INSERT INTO users (id, church_id, role, name, email)
  VALUES (p_user_id, v_church_id, 'admin', p_user_name, p_user_email);

  -- Return the created church data
  SELECT json_build_object(
    'church_id', v_church_id,
    'user_id', p_user_id
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_church_and_user TO authenticated;
