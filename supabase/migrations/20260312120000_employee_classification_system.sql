-- ============================================================
-- Employee Classification & Rate Override System
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  classification_id uuid NOT NULL REFERENCES ccq_classifications(id) ON DELETE RESTRICT,
  effective_from date NOT NULL,
  effective_to date,
  ccq_hours_accumulated numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_rate_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  classification_id uuid REFERENCES ccq_classifications(id) ON DELETE CASCADE,
  hourly_rate numeric NOT NULL,
  reason text,
  effective_from date NOT NULL,
  effective_to date,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employee_classifications_person
  ON employee_classifications(person_id);
CREATE INDEX IF NOT EXISTS idx_employee_classifications_current
  ON employee_classifications(person_id) WHERE effective_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_employee_rate_overrides_person
  ON employee_rate_overrides(person_id);
CREATE INDEX IF NOT EXISTS idx_employee_rate_overrides_active
  ON employee_rate_overrides(person_id, effective_to)
  WHERE effective_to IS NULL;

-- ALTER existing tables
ALTER TABLE people ADD COLUMN IF NOT EXISTS primary_trade_id uuid REFERENCES ccq_trades(id);
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS classification_override_id uuid REFERENCES ccq_classifications(id);

-- RLS
ALTER TABLE employee_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_rate_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_classifications_read" ON employee_classifications;
CREATE POLICY "employee_classifications_read" ON employee_classifications
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "employee_classifications_admin" ON employee_classifications;
CREATE POLICY "employee_classifications_admin" ON employee_classifications
  FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));

DROP POLICY IF EXISTS "employee_rate_overrides_read" ON employee_rate_overrides;
CREATE POLICY "employee_rate_overrides_read" ON employee_rate_overrides
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "employee_rate_overrides_admin" ON employee_rate_overrides;
CREATE POLICY "employee_rate_overrides_admin" ON employee_rate_overrides
  FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
