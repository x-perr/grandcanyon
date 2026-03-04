-- Fix profiles RLS policy to allow admins to view all profiles
-- Previously: only is_active = true profiles were visible
-- Now: admins with 'admin.manage' permission can see all profiles

DROP POLICY IF EXISTS profiles_select ON profiles;

CREATE POLICY profiles_select ON profiles
  FOR SELECT
  USING (
    is_active = true
    OR has_permission('admin.manage')
  );

-- Add comment for documentation
COMMENT ON POLICY profiles_select ON profiles IS
  'Allow viewing active profiles to all users, and all profiles to admins';
