-- Migration: Add people table for clean identity separation
-- Run this in Supabase SQL Editor

-- 1. Create the people table
CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_user_id INTEGER UNIQUE,  -- Original system ID for migration tracking
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,  -- Can be null or shared - not used for auth
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add person_id to profiles (links auth user to person)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id);

-- 3. Add person_id to timesheets (replaces user_id)
ALTER TABLE timesheets
ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id);

-- 4. Add person_id to expenses (replaces user_id)
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_people_legacy_user_id ON people(legacy_user_id);
CREATE INDEX IF NOT EXISTS idx_people_email ON people(email);
CREATE INDEX IF NOT EXISTS idx_profiles_person_id ON profiles(person_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_person_id ON timesheets(person_id);
CREATE INDEX IF NOT EXISTS idx_expenses_person_id ON expenses(person_id);

-- 6. Enable RLS on people table
ALTER TABLE people ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for people table
-- Allow authenticated users to view all people (employees are public within org)
CREATE POLICY "Users can view all people" ON people
  FOR SELECT TO authenticated
  USING (true);

-- Allow users to update their own person record
CREATE POLICY "Users can update their own person" ON people
  FOR UPDATE TO authenticated
  USING (
    id IN (SELECT person_id FROM profiles WHERE id = auth.uid())
  );

-- Service role can do everything
CREATE POLICY "Service role full access to people" ON people
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 8. Add updated_at trigger
CREATE OR REPLACE FUNCTION update_people_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW
  EXECUTE FUNCTION update_people_updated_at();

-- Note: After running this migration:
-- 1. Run the import script to populate the people table
-- 2. Then we can optionally drop user_id from timesheets/expenses
--    (keep it during transition for safety)
