-- Migration: Fix Timesheets RLS to Check Permissions
-- Problem: Admin users with timesheets.view_all permission cannot see all timesheets
--          because RLS policies only check user_id or manager_id, not permissions
-- Solution: Create has_permission() function and update RLS policies

-- ============================================================================
-- Step 1: Create helper function to check permissions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_permission(permission_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN role_permissions rp ON p.role_id = rp.role_id
    JOIN permissions perm ON rp.permission_id = perm.id
    WHERE p.id = auth.uid()
      AND perm.code = permission_code
  )
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

-- ============================================================================
-- Step 2: Update timesheets SELECT policy
-- ============================================================================

-- Drop existing select policies
DROP POLICY IF EXISTS "Users can view own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Managers can view subordinate timesheets" ON timesheets;
DROP POLICY IF EXISTS "timesheets_select" ON timesheets;
DROP POLICY IF EXISTS "Users can read own timesheets" ON timesheets;

-- Create unified select policy with permission check
CREATE POLICY "timesheets_select_policy" ON timesheets
FOR SELECT USING (
  -- Own timesheets
  user_id = auth.uid()
  -- Direct reports' timesheets
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.manager_id = auth.uid()
      AND profiles.id = timesheets.user_id
  )
  -- Users with timesheets.view_all permission (admins, reporting)
  OR has_permission('timesheets.view_all')
);

-- ============================================================================
-- Step 3: Update timesheet_entries SELECT policy
-- ============================================================================

-- Drop existing select policies
DROP POLICY IF EXISTS "Users can view own timesheet entries" ON timesheet_entries;
DROP POLICY IF EXISTS "Managers can view subordinate timesheet entries" ON timesheet_entries;
DROP POLICY IF EXISTS "timesheet_entries_select" ON timesheet_entries;
DROP POLICY IF EXISTS "Users can read own timesheet entries" ON timesheet_entries;

-- Create unified select policy with permission check
CREATE POLICY "timesheet_entries_select_policy" ON timesheet_entries
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM timesheets t
    WHERE t.id = timesheet_entries.timesheet_id
    AND (
      -- Own entries
      t.user_id = auth.uid()
      -- Direct reports' entries
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.manager_id = auth.uid()
          AND profiles.id = t.user_id
      )
      -- Users with timesheets.view_all permission
      OR has_permission('timesheets.view_all')
    )
  )
);

-- ============================================================================
-- Step 4: Add index for performance (if not exists)
-- ============================================================================

-- Index on profiles.manager_id for faster manager lookups
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON profiles(manager_id);

-- Index on role_permissions for faster permission checks
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);

-- ============================================================================
-- Verification queries (comment out in production, use for testing)
-- ============================================================================

-- Test has_permission function:
-- SELECT has_permission('timesheets.view_all');

-- Verify policy exists:
-- SELECT * FROM pg_policies WHERE tablename IN ('timesheets', 'timesheet_entries');

-- Test access (should return data for admin):
-- SELECT COUNT(*) FROM timesheets WHERE status = 'approved';
-- SELECT COUNT(*) FROM timesheet_entries;
