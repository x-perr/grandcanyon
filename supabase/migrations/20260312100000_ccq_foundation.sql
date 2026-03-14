-- ============================================================
-- CCQ Foundation: Trades, Classifications, Rates
-- ============================================================

-- CCQ Trades
CREATE TABLE IF NOT EXISTS ccq_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_fr text NOT NULL,
  name_en text NOT NULL,
  apprentice_periods int NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- CCQ Classifications (per trade × level)
CREATE TABLE IF NOT EXISTS ccq_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES ccq_trades(id) ON DELETE CASCADE,
  level text NOT NULL,
  name_fr text NOT NULL,
  name_en text NOT NULL,
  hours_required int,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trade_id, level)
);

-- CCQ Rates (versioned, cost side — what you PAY the worker)
CREATE TABLE IF NOT EXISTS ccq_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id uuid NOT NULL REFERENCES ccq_classifications(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  effective_to date,
  hourly_rate numeric NOT NULL,
  vacation_percent numeric,
  benefit_rate numeric,
  total_hourly_cost numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classification_id, effective_from)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ccq_classifications_trade ON ccq_classifications(trade_id);
CREATE INDEX IF NOT EXISTS idx_ccq_rates_classification ON ccq_rates(classification_id);
CREATE INDEX IF NOT EXISTS idx_ccq_rates_current ON ccq_rates(classification_id) WHERE effective_to IS NULL;

-- Seed: Grand Canyon trades
INSERT INTO ccq_trades (code, name_fr, name_en, apprentice_periods, sort_order) VALUES
  ('16',  'Plâtrier',           'Plasterer',      3, 1),
  ('21',  'Tireur de joints',   'Taper',          3, 2),
  ('23',  'Peintre',            'Painter',        3, 3),
  ('MAN', 'Manœuvre',           'Labourer',       0, 4)
ON CONFLICT (code) DO NOTHING;

-- Seed: Classifications per trade (3 apprenti + 1 compagnon for trades with apprentice periods)
INSERT INTO ccq_classifications (trade_id, level, name_fr, name_en, hours_required, sort_order)
SELECT t.id, v.level, v.name_fr, v.name_en, v.hours_required, v.sort_order
FROM ccq_trades t
CROSS JOIN (VALUES
  ('apprenti_1', 'Apprenti 1ère période', 'Apprentice Period 1', 0,    1),
  ('apprenti_2', 'Apprenti 2ième période', 'Apprentice Period 2', 2000, 2),
  ('apprenti_3', 'Apprenti 3ième période', 'Apprentice Period 3', 4000, 3),
  ('compagnon',  'Compagnon',              'Journeyman',          6000, 4)
) AS v(level, name_fr, name_en, hours_required, sort_order)
WHERE t.code IN ('16', '21', '23')
  AND t.apprentice_periods > 0
ON CONFLICT (trade_id, level) DO NOTHING;

-- Manœuvre: single level, no apprenticeship
INSERT INTO ccq_classifications (trade_id, level, name_fr, name_en, hours_required, sort_order)
SELECT t.id, 'manoeuvre', 'Manœuvre', 'Labourer', NULL, 1
FROM ccq_trades t WHERE t.code = 'MAN'
ON CONFLICT (trade_id, level) DO NOTHING;

-- CCQ rates: placeholder structure (real rates from CCQ scrape later)
-- Platrier rates (2025-2026 approximate)
INSERT INTO ccq_rates (classification_id, effective_from, effective_to, hourly_rate, vacation_percent, total_hourly_cost)
SELECT cc.id, '2025-05-01'::date, '2026-04-30'::date, v.rate, 13, v.cost
FROM ccq_classifications cc
JOIN ccq_trades ct ON cc.trade_id = ct.id
JOIN (VALUES
  ('apprenti_1', 22.89, 33.50),
  ('apprenti_2', 30.52, 40.20),
  ('apprenti_3', 34.33, 44.80),
  ('compagnon',  42.78, 55.60)
) AS v(level, rate, cost) ON cc.level = v.level
WHERE ct.code = '16'
ON CONFLICT (classification_id, effective_from) DO NOTHING;

-- RLS
ALTER TABLE ccq_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccq_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccq_rates ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated users
DROP POLICY IF EXISTS "ccq_trades_read" ON ccq_trades;
CREATE POLICY "ccq_trades_read" ON ccq_trades FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ccq_classifications_read" ON ccq_classifications;
CREATE POLICY "ccq_classifications_read" ON ccq_classifications FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ccq_rates_read" ON ccq_rates;
CREATE POLICY "ccq_rates_read" ON ccq_rates FOR SELECT TO authenticated USING (true);

-- Write access for admins only (via has_permission RPC)
DROP POLICY IF EXISTS "ccq_trades_admin" ON ccq_trades;
CREATE POLICY "ccq_trades_admin" ON ccq_trades FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
DROP POLICY IF EXISTS "ccq_classifications_admin" ON ccq_classifications;
CREATE POLICY "ccq_classifications_admin" ON ccq_classifications FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
DROP POLICY IF EXISTS "ccq_rates_admin" ON ccq_rates;
CREATE POLICY "ccq_rates_admin" ON ccq_rates FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
