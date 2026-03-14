-- ============================================================
-- Rate Tier System (Paliers tarifaires)
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  auto_rules jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_tier_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id uuid NOT NULL REFERENCES rate_tiers(id) ON DELETE CASCADE,
  classification_id uuid NOT NULL REFERENCES ccq_classifications(id) ON DELETE CASCADE,
  hourly_rate numeric NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tier_id, classification_id, effective_date)
);

CREATE TABLE IF NOT EXISTS client_rate_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES rate_tiers(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES profiles(id),
  notes text,
  UNIQUE (client_id)
);

CREATE TABLE IF NOT EXISTS project_rate_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  classification_id uuid REFERENCES ccq_classifications(id) ON DELETE CASCADE,
  hourly_rate numeric NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, classification_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rate_tier_lines_tier ON rate_tier_lines(tier_id);
CREATE INDEX IF NOT EXISTS idx_rate_tier_lines_classification ON rate_tier_lines(classification_id);
CREATE INDEX IF NOT EXISTS idx_client_rate_tiers_client ON client_rate_tiers(client_id);
CREATE INDEX IF NOT EXISTS idx_project_rate_overrides_project ON project_rate_overrides(project_id);

-- Seed: Grand Canyon tiers
INSERT INTO rate_tiers (name, code, description, is_default) VALUES
  ('Standard',  'A', 'Default rate for most clients', true),
  ('Preferred', 'B', 'Discounted rate for loyal/volume clients', false)
ON CONFLICT (code) DO NOTHING;

-- Seed: Tier A lines (Platrier trade — repeat for other trades as needed)
-- Compagnon = $89, Apprenti 3 = $89, Apprenti 2 = $72, Apprenti 1 = $72
INSERT INTO rate_tier_lines (tier_id, classification_id, hourly_rate, effective_date)
SELECT rt.id, cc.id, v.rate, '2026-01-01'::date
FROM rate_tiers rt
CROSS JOIN ccq_classifications cc
JOIN ccq_trades ct ON cc.trade_id = ct.id
JOIN (VALUES
  ('A', 'compagnon',  89.00),
  ('A', 'apprenti_3', 89.00),
  ('A', 'apprenti_2', 72.00),
  ('A', 'apprenti_1', 72.00),
  ('B', 'compagnon',  86.00),
  ('B', 'apprenti_3', 86.00),
  ('B', 'apprenti_2', 72.00),
  ('B', 'apprenti_1', 72.00)
) AS v(tier_code, level, rate) ON rt.code = v.tier_code AND cc.level = v.level
WHERE ct.code = '16'
ON CONFLICT (tier_id, classification_id, effective_date) DO NOTHING;

-- Manoeuvre tier lines (single level)
INSERT INTO rate_tier_lines (tier_id, classification_id, hourly_rate, effective_date)
SELECT rt.id, cc.id, v.rate, '2026-01-01'::date
FROM rate_tiers rt
CROSS JOIN ccq_classifications cc
JOIN ccq_trades ct ON cc.trade_id = ct.id
JOIN (VALUES
  ('A', 55.00),
  ('B', 55.00)
) AS v(tier_code, rate) ON rt.code = v.tier_code
WHERE ct.code = 'MAN' AND cc.level = 'manoeuvre'
ON CONFLICT (tier_id, classification_id, effective_date) DO NOTHING;

-- RLS
ALTER TABLE rate_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_tier_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_rate_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_rate_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_tiers_read" ON rate_tiers;
CREATE POLICY "rate_tiers_read" ON rate_tiers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rate_tier_lines_read" ON rate_tier_lines;
CREATE POLICY "rate_tier_lines_read" ON rate_tier_lines FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "client_rate_tiers_read" ON client_rate_tiers;
CREATE POLICY "client_rate_tiers_read" ON client_rate_tiers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "project_rate_overrides_read" ON project_rate_overrides;
CREATE POLICY "project_rate_overrides_read" ON project_rate_overrides FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rate_tiers_admin" ON rate_tiers;
CREATE POLICY "rate_tiers_admin" ON rate_tiers FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
DROP POLICY IF EXISTS "rate_tier_lines_admin" ON rate_tier_lines;
CREATE POLICY "rate_tier_lines_admin" ON rate_tier_lines FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
DROP POLICY IF EXISTS "client_rate_tiers_admin" ON client_rate_tiers;
CREATE POLICY "client_rate_tiers_admin" ON client_rate_tiers FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
DROP POLICY IF EXISTS "project_rate_overrides_admin" ON project_rate_overrides;
CREATE POLICY "project_rate_overrides_admin" ON project_rate_overrides FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
