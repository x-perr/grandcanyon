-- Migration: Add structured address fields and display_title to projects
-- Date: 2026-03-03
-- Purpose: Support address auto-classification and flexible display

-- ============================================
-- 1. Add structured address fields
-- ============================================

-- Civic number (e.g., "7101", "10 305")
ALTER TABLE projects ADD COLUMN IF NOT EXISTS civic_number TEXT;

-- Street name (e.g., "Notre-Dame est", "rue Grande-Allée")
ALTER TABLE projects ADD COLUMN IF NOT EXISTS street_name TEXT;

-- Province (for full address)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS province TEXT DEFAULT 'QC';

-- ============================================
-- 2. Make name nullable (address can be the title)
-- ============================================

ALTER TABLE projects ALTER COLUMN name DROP NOT NULL;

-- ============================================
-- 3. Add generated display_title column
-- ============================================

-- This column automatically computes the display title:
-- Priority: name > (civic_number + street_name) > address > code
ALTER TABLE projects ADD COLUMN IF NOT EXISTS display_title TEXT
  GENERATED ALWAYS AS (
    COALESCE(
      NULLIF(name, ''),
      CASE
        WHEN civic_number IS NOT NULL AND street_name IS NOT NULL
        THEN civic_number || ' ' || street_name
        ELSE NULL
      END,
      NULLIF(address, ''),
      code
    )
  ) STORED;

-- ============================================
-- 4. Add index for display_title searches
-- ============================================

CREATE INDEX IF NOT EXISTS idx_projects_display_title
  ON projects (display_title);

CREATE INDEX IF NOT EXISTS idx_projects_city
  ON projects (city);

CREATE INDEX IF NOT EXISTS idx_projects_street_name
  ON projects (street_name);

-- ============================================
-- 5. Comments for documentation
-- ============================================

COMMENT ON COLUMN projects.civic_number IS 'Street number (e.g., "7101", "10 305")';
COMMENT ON COLUMN projects.street_name IS 'Street name without number (e.g., "Notre-Dame est")';
COMMENT ON COLUMN projects.display_title IS 'Auto-computed: name > structured address > address > code';
COMMENT ON COLUMN projects.province IS 'Province/State (default: QC)';
