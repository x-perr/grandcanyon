-- ============================================================================
-- Contact System Consolidation Migration
-- ============================================================================
-- This migration:
-- 1. Adds user_type enum to profiles (employee, admin, client, subcontractor)
-- 2. Expands people table as central contact hub
-- 3. Migrates client_contacts data to people table
-- 4. Updates RLS policies
-- ============================================================================

-- ============================================================================
-- PART 1: Add user_type to profiles
-- ============================================================================

-- Create user_type enum
DO $$ BEGIN
  CREATE TYPE user_type AS ENUM ('employee', 'admin', 'client', 'subcontractor');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add user_type column to profiles (default to 'employee')
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_type user_type DEFAULT 'employee';

-- Set existing super_admin role users to 'admin' type
UPDATE profiles
SET user_type = 'admin'
WHERE role_id IN (SELECT id FROM roles WHERE name ILIKE '%super_admin%')
  AND user_type = 'employee';

-- ============================================================================
-- PART 2: Expand people table as central contact hub
-- ============================================================================

-- Create contact_type enum
DO $$ BEGIN
  CREATE TYPE contact_type AS ENUM ('employee', 'client_contact', 'subcontractor', 'external');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to people table
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS contact_type contact_type DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_people_client_id ON people(client_id);
CREATE INDEX IF NOT EXISTS idx_people_contact_type ON people(contact_type);
CREATE INDEX IF NOT EXISTS idx_people_is_primary ON people(is_primary) WHERE is_primary = true;

-- Update existing people records to have contact_type = 'employee'
UPDATE people
SET contact_type = 'employee'
WHERE contact_type IS NULL;

-- ============================================================================
-- PART 3: Migrate client_contacts to people table
-- ============================================================================

-- Insert client_contacts into people table (only if client_contacts exists and has data)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_contacts') THEN
    INSERT INTO people (
      first_name,
      last_name,
      email,
      phone,
      title,
      client_id,
      contact_type,
      is_primary,
      is_active,
      created_at,
      updated_at
    )
    SELECT
      cc.first_name,
      cc.last_name,
      cc.email,
      cc.phone,
      cc.title,
      cc.client_id,
      'client_contact'::contact_type,
      COALESCE(cc.is_primary, false),
      true,
      COALESCE(cc.created_at, NOW()),
      COALESCE(cc.updated_at, NOW())
    FROM client_contacts cc
    -- Avoid duplicates by checking if already migrated
    WHERE NOT EXISTS (
      SELECT 1 FROM people p
      WHERE p.contact_type = 'client_contact'
        AND p.client_id = cc.client_id
        AND LOWER(p.first_name) = LOWER(cc.first_name)
        AND LOWER(p.last_name) = LOWER(cc.last_name)
    );

    RAISE NOTICE 'Migrated client_contacts to people table';
  END IF;
END $$;

-- Create migration mapping table for reference (keep track of old IDs)
CREATE TABLE IF NOT EXISTS _client_contacts_migration_map (
  old_id UUID PRIMARY KEY,
  new_people_id UUID REFERENCES people(id),
  migrated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Populate mapping table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_contacts') THEN
    INSERT INTO _client_contacts_migration_map (old_id, new_people_id)
    SELECT
      cc.id as old_id,
      p.id as new_people_id
    FROM client_contacts cc
    JOIN people p ON
      p.contact_type = 'client_contact' AND
      p.client_id = cc.client_id AND
      LOWER(p.first_name) = LOWER(cc.first_name) AND
      LOWER(p.last_name) = LOWER(cc.last_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM _client_contacts_migration_map m WHERE m.old_id = cc.id
    );
  END IF;
END $$;

-- ============================================================================
-- PART 4: Update RLS policies for people table
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all people" ON people;
DROP POLICY IF EXISTS "Users can update their own person record" ON people;
DROP POLICY IF EXISTS "Users can manage client contacts" ON people;
DROP POLICY IF EXISTS "Service role has full access to people" ON people;

-- Policy: All authenticated users can view all people
CREATE POLICY "Users can view all people" ON people
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Users can update their own linked person record
CREATE POLICY "Users can update their own person record" ON people
  FOR UPDATE
  TO authenticated
  USING (
    id IN (SELECT person_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    id IN (SELECT person_id FROM profiles WHERE id = auth.uid())
  );

-- Policy: Users with clients.edit permission can manage client contacts
CREATE POLICY "Users can manage client contacts" ON people
  FOR ALL
  TO authenticated
  USING (
    contact_type = 'client_contact' AND
    EXISTS (
      SELECT 1 FROM profiles pr
      JOIN role_permissions rp ON rp.role_id = pr.role_id
      JOIN permissions perm ON perm.id = rp.permission_id
      WHERE pr.id = auth.uid() AND perm.code = 'clients.edit'
    )
  )
  WITH CHECK (
    contact_type = 'client_contact' AND
    EXISTS (
      SELECT 1 FROM profiles pr
      JOIN role_permissions rp ON rp.role_id = pr.role_id
      JOIN permissions perm ON perm.id = rp.permission_id
      WHERE pr.id = auth.uid() AND perm.code = 'clients.edit'
    )
  );

-- Policy: Users with admin.manage permission can manage all people
CREATE POLICY "Admins can manage all people" ON people
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles pr
      JOIN role_permissions rp ON rp.role_id = pr.role_id
      JOIN permissions perm ON perm.id = rp.permission_id
      WHERE pr.id = auth.uid() AND perm.code = 'admin.manage'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles pr
      JOIN role_permissions rp ON rp.role_id = pr.role_id
      JOIN permissions perm ON perm.id = rp.permission_id
      WHERE pr.id = auth.uid() AND perm.code = 'admin.manage'
    )
  );

-- ============================================================================
-- PART 5: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN profiles.user_type IS 'Type of user: employee (field worker), admin (system admin), client (client portal user), subcontractor (subcontractor portal user)';
COMMENT ON COLUMN people.contact_type IS 'Type of contact: employee, client_contact, subcontractor, external';
COMMENT ON COLUMN people.client_id IS 'For client_contact type: links to the client company';
COMMENT ON COLUMN people.title IS 'Job title (e.g., Project Manager, Foreman)';
COMMENT ON COLUMN people.is_primary IS 'For client_contact type: marks primary contact for the client';
COMMENT ON TABLE _client_contacts_migration_map IS 'Temporary table mapping old client_contacts IDs to new people IDs. Can be dropped after verification.';
