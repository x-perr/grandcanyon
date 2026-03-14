# Billing & Classification — Technical Implementation Spec

**Status**: Ready for agent team execution
**Date**: 2026-03-12
**Depends on**: `BILLING_AND_CLASSIFICATION_DRAFT.md` (design spec, all 32 questions resolved)
**Migration base**: 9 existing migrations in `supabase/migrations/`

---

## 1. Migration Chain

5 ordered SQL migrations. Each is idempotent (IF NOT EXISTS pattern).
Execute in order — later migrations reference tables from earlier ones.

### Migration 10: `20260312100000_ccq_foundation.sql`

Creates the CCQ trade/classification/rate infrastructure.

```sql
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
CREATE POLICY IF NOT EXISTS "ccq_trades_read" ON ccq_trades FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "ccq_classifications_read" ON ccq_classifications FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "ccq_rates_read" ON ccq_rates FOR SELECT TO authenticated USING (true);

-- Write access for admins only (via has_permission RPC)
CREATE POLICY IF NOT EXISTS "ccq_trades_admin" ON ccq_trades FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
CREATE POLICY IF NOT EXISTS "ccq_classifications_admin" ON ccq_classifications FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
CREATE POLICY IF NOT EXISTS "ccq_rates_admin" ON ccq_rates FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
```

### Migration 11: `20260312110000_rate_tier_system.sql`

```sql
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

CREATE POLICY IF NOT EXISTS "rate_tiers_read" ON rate_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "rate_tier_lines_read" ON rate_tier_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "client_rate_tiers_read" ON client_rate_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "project_rate_overrides_read" ON project_rate_overrides FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "rate_tiers_admin" ON rate_tiers FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
CREATE POLICY IF NOT EXISTS "rate_tier_lines_admin" ON rate_tier_lines FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
CREATE POLICY IF NOT EXISTS "client_rate_tiers_admin" ON client_rate_tiers FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
CREATE POLICY IF NOT EXISTS "project_rate_overrides_admin" ON project_rate_overrides FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
```

### Migration 12: `20260312120000_employee_classification_system.sql`

```sql
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
  ON employee_rate_overrides(person_id)
  WHERE effective_to IS NULL OR effective_to >= CURRENT_DATE;

-- ALTER existing tables
ALTER TABLE people ADD COLUMN IF NOT EXISTS primary_trade_id uuid REFERENCES ccq_trades(id);
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS classification_override_id uuid REFERENCES ccq_classifications(id);

-- RLS
ALTER TABLE employee_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_rate_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "employee_classifications_read" ON employee_classifications
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "employee_classifications_admin" ON employee_classifications
  FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));

CREATE POLICY IF NOT EXISTS "employee_rate_overrides_read" ON employee_rate_overrides
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "employee_rate_overrides_admin" ON employee_rate_overrides
  FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
```

### Migration 13: `20260312130000_billing_enhancements.sql`

```sql
-- ============================================================
-- Billing Enhancements: OT config, rate history, billing settings
-- ============================================================

-- Rate history audit trail
CREATE TABLE IF NOT EXISTS billing_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_role_id uuid NOT NULL REFERENCES project_billing_roles(id) ON DELETE CASCADE,
  rate numeric NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  changed_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_rate_history_role ON billing_rate_history(billing_role_id);

-- OT billing config on projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ot_billing_config jsonb DEFAULT '{"mode":"flat"}'::jsonb;

-- OT flags on timesheet entries
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS ot_flags jsonb;

-- Billing settings (company-level defaults)
INSERT INTO settings (key, value, description)
VALUES (
  'billing_settings',
  jsonb_build_object(
    'default_rate_tier_id', NULL,
    'rate_tier_versioning', 'annual_may',
    'ot_default_mode', 'flat',
    'ot_standard_multiplier_1_5x', 1.5,
    'ot_standard_multiplier_2x', 2.0,
    'ot_custom_multiplier_1_5x', NULL,
    'ot_custom_multiplier_2x', NULL,
    'ot_approval_default', 'per_instance',
    'retainage_default_percent', 0,
    'retainage_on_subtotal', true,
    'retainage_hold_days', 35,
    'learning_phase_default_weeks', 4,
    'learning_phase_alert_days', 7
  ),
  'Company-level billing configuration (rate tiers, OT, retainage, learning phase)'
)
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE billing_rate_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "billing_rate_history_read" ON billing_rate_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "billing_rate_history_admin" ON billing_rate_history
  FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
```

### Migration 14: `20260312140000_backfill_classification_links.sql`

```sql
-- ============================================================
-- Backfill: Link existing project_billing_roles to ccq_classifications
-- Best-effort name matching — manual review needed after migration
-- ============================================================

-- Add classification_id to project_billing_roles for forward compatibility
ALTER TABLE project_billing_roles
  ADD COLUMN IF NOT EXISTS classification_id uuid REFERENCES ccq_classifications(id);

-- Best-effort mapping of role names to classifications
-- Defaulting to Platrier trade (code '16') as most common for GC
UPDATE project_billing_roles pbr
SET classification_id = cc.id
FROM ccq_classifications cc
JOIN ccq_trades ct ON cc.trade_id = ct.id
WHERE pbr.classification_id IS NULL
  AND ct.code = '16'
  AND (
    (cc.level = 'compagnon'  AND (LOWER(pbr.name) SIMILAR TO '%(compagnon|journalier|comp\.|jour\.)%'))
    OR (cc.level = 'apprenti_3' AND (LOWER(pbr.name) SIMILAR TO '%(apprenti%3|app%3|apprenti%3i)%'))
    OR (cc.level = 'apprenti_2' AND (LOWER(pbr.name) SIMILAR TO '%(apprenti%2|app%2|apprenti%2i)%'))
    OR (cc.level = 'apprenti_1' AND (LOWER(pbr.name) SIMILAR TO '%(apprenti%1|app%1|apprenti%1e)%'))
  );

-- Map manoeuvre roles
UPDATE project_billing_roles pbr
SET classification_id = cc.id
FROM ccq_classifications cc
JOIN ccq_trades ct ON cc.trade_id = ct.id
WHERE pbr.classification_id IS NULL
  AND ct.code = 'MAN'
  AND cc.level = 'manoeuvre'
  AND LOWER(pbr.name) SIMILAR TO '%(manoeuvre|man\.|labou)%';

-- Map peintre roles
UPDATE project_billing_roles pbr
SET classification_id = cc.id
FROM ccq_classifications cc
JOIN ccq_trades ct ON cc.trade_id = ct.id
WHERE pbr.classification_id IS NULL
  AND ct.code = '23'
  AND cc.level = 'compagnon'
  AND LOWER(pbr.name) SIMILAR TO '%(peintre|paint)%';

-- Map generic "apprenti" (no number) to apprenti_1 Platrier
UPDATE project_billing_roles pbr
SET classification_id = cc.id
FROM ccq_classifications cc
JOIN ccq_trades ct ON cc.trade_id = ct.id
WHERE pbr.classification_id IS NULL
  AND ct.code = '16'
  AND cc.level = 'apprenti_1'
  AND LOWER(pbr.name) SIMILAR TO '%(apprenti|app\.)%'
  AND LOWER(pbr.name) NOT SIMILAR TO '%(apprenti%[0-9]|app%[0-9])%';

-- Note: OT roles ("Temps Double", "Temps et demi") are NOT mapped —
-- they'll be handled by the OT billing config system instead.
-- Roles with trick rates ($0, $1, $9999.99) are NOT mapped — manual review.

-- Log unmapped roles for admin review
-- (Run this query manually post-migration to see what needs attention)
-- SELECT id, name, rate FROM project_billing_roles WHERE classification_id IS NULL;
```

---

## 2. TypeScript Types

New file: `src/types/billing.ts`

```typescript
// ============================================================
// CCQ Types
// ============================================================

export interface CcqTrade {
  id: string
  code: string
  name_fr: string
  name_en: string
  apprentice_periods: number
  is_active: boolean
  sort_order: number
}

export interface CcqClassification {
  id: string
  trade_id: string
  level: 'apprenti_1' | 'apprenti_2' | 'apprenti_3' | 'compagnon' | 'manoeuvre'
  name_fr: string
  name_en: string
  hours_required: number | null
  sort_order: number
  // Joined
  trade?: CcqTrade
}

export interface CcqRate {
  id: string
  classification_id: string
  effective_from: string
  effective_to: string | null
  hourly_rate: number
  vacation_percent: number | null
  benefit_rate: number | null
  total_hourly_cost: number | null
  notes: string | null
}

// ============================================================
// Rate Tier Types
// ============================================================

export interface RateTier {
  id: string
  name: string
  code: string
  description: string | null
  is_default: boolean
  is_active: boolean
  auto_rules: AutoTierRules | null
  // Joined
  lines?: RateTierLine[]
}

export interface RateTierLine {
  id: string
  tier_id: string
  classification_id: string
  hourly_rate: number
  effective_date: string
  notes: string | null
  // Joined
  classification?: CcqClassification
}

export interface ClientRateTier {
  id: string
  client_id: string
  tier_id: string
  assigned_at: string
  assigned_by: string | null
  notes: string | null
  // Joined
  tier?: RateTier
}

export interface ProjectRateOverride {
  id: string
  project_id: string
  classification_id: string | null
  hourly_rate: number
  reason: string | null
}

export interface AutoTierRules {
  min_ytd_hours?: number
  max_avg_payment_days?: number
  evaluation_period?: 'ytd' | 'rolling_12m'
  action?: 'suggest' | 'auto'
}

// ============================================================
// Employee Classification Types
// ============================================================

export interface EmployeeClassification {
  id: string
  person_id: string
  classification_id: string
  effective_from: string
  effective_to: string | null
  ccq_hours_accumulated: number
  notes: string | null
  // Joined
  classification?: CcqClassification
}

export interface EmployeeRateOverride {
  id: string
  person_id: string
  classification_id: string | null
  hourly_rate: number
  reason: string | null
  effective_from: string
  effective_to: string | null
  created_by: string | null
}

// ============================================================
// OT & Billing Config Types
// ============================================================

export type OtMode = 'flat' | 'standard' | 'custom' | 'off'

export interface OtBillingConfig {
  mode: OtMode
  ot_1_5x?: number
  ot_2x?: number
  premiums?: OtPremium[]
}

export interface OtPremium {
  label: string
  multiplier: number
}

export interface OtFlags {
  days?: Record<string, {
    type: 'standard_ot' | 'weekend' | 'conditions' | 'custom'
    status: 'pending' | 'approved' | 'rejected'
    multiplier?: number
  }>
  approved_by?: string
  approved_at?: string
}

export interface BillingSettings {
  default_rate_tier_id: string | null
  rate_tier_versioning: 'annual_may' | 'annual_jan' | 'on_change'
  ot_default_mode: OtMode
  ot_standard_multiplier_1_5x: number
  ot_standard_multiplier_2x: number
  ot_custom_multiplier_1_5x: number | null
  ot_custom_multiplier_2x: number | null
  ot_approval_default: 'pre_approved' | 'per_instance' | 'never'
  retainage_default_percent: number
  retainage_on_subtotal: boolean
  retainage_hold_days: number
  learning_phase_default_weeks: number
  learning_phase_alert_days: number
}
```

---

## 3. Core Logic: Rate Resolution

New file: `src/lib/billing/rate-resolution.ts`

```typescript
import { createClient } from '@/lib/supabase/server'

/**
 * Resolves the billing rate for an employee on a project.
 * 6-level cascade, most specific wins:
 *
 * 1. Change order override (future — not v1)
 * 2. Project rate override
 * 3. Employee rate override (learning phase / temp)
 * 4. Client rate tier line
 * 5. Default rate tier line (Tier A)
 * 6. Legacy fallback: project_billing_roles.rate
 */
export async function resolveHourlyRate(params: {
  employeePersonId: string
  projectId: string
  classificationId?: string   // if known, skip lookup
  changeOrderId?: string | null
  asOfDate?: string           // for historical lookups, defaults to today
}): Promise<{
  rate: number
  source: 'project_override' | 'employee_override' | 'client_tier' | 'default_tier' | 'legacy_role'
  tierCode?: string
  classificationLevel?: string
}> {
  // Implementation: query each level in order, return first match
  // See design spec section 1.4 for full cascade logic
}

/**
 * Get the current classification for an employee.
 * Returns the active employee_classifications row (effective_to IS NULL).
 * Falls back to project_members.classification_override_id if set.
 */
export async function getEmployeeClassification(params: {
  personId: string
  projectId?: string  // if provided, check for project-level override
}): Promise<CcqClassification | null> {
  // 1. Check project_members.classification_override_id (if projectId given)
  // 2. Fallback to employee_classifications WHERE effective_to IS NULL
}

/**
 * Get billing settings from the settings table.
 * Cached per-request via React cache() or unstable_cache.
 */
export async function getBillingSettings(): Promise<BillingSettings> {
  // Read settings.key = 'billing_settings'
  // Merge with defaults for any missing keys
}
```

New file: `src/lib/billing/progression.ts`

```typescript
/**
 * Check all active apprentices for advancement eligibility.
 * Returns employees who have reached or are near their next threshold.
 */
export async function getAdvancementAlerts(): Promise<AdvancementAlert[]> {
  // Query employee_classifications + sum timesheet hours
  // Compare against ccq_classifications.hours_required
  // Return alerts with progress percentage
}

/**
 * Advance an employee to the next classification level.
 * Closes current classification, opens new one.
 * Does NOT auto-update billing — rate resolution handles it dynamically.
 */
export async function advanceClassification(params: {
  personId: string
  newClassificationId: string
  effectiveDate: string
  notes?: string
}): Promise<void> {
  // 1. Close current: UPDATE employee_classifications SET effective_to = date
  // 2. Open new: INSERT employee_classifications
  // 3. Log audit
}
```

---

## 4. File Change Manifest

### New Files to Create

| File | Agent | Purpose |
|------|-------|---------|
| `supabase/migrations/20260312100000_ccq_foundation.sql` | Schema | CCQ tables + seed |
| `supabase/migrations/20260312110000_rate_tier_system.sql` | Schema | Rate tiers + seed |
| `supabase/migrations/20260312120000_employee_classification_system.sql` | Schema | Employee classifications |
| `supabase/migrations/20260312130000_billing_enhancements.sql` | Schema | OT config, rate history, settings |
| `supabase/migrations/20260312140000_backfill_classification_links.sql` | Schema | Backfill existing data |
| `src/types/billing.ts` | Core | All billing TypeScript types |
| `src/lib/billing/rate-resolution.ts` | Core | Rate cascade logic |
| `src/lib/billing/progression.ts` | Core | Apprenti advancement logic |
| `src/lib/validations/billing.ts` | Core | Zod schemas for billing forms |
| `src/app/(protected)/admin/rate-tiers/page.tsx` | Admin UI | Rate tier management page |
| `src/app/(protected)/admin/rate-tiers/actions.ts` | Admin UI | Rate tier CRUD server actions |
| `src/app/(protected)/admin/ccq-rates/page.tsx` | Admin UI | CCQ rate management page |
| `src/app/(protected)/admin/ccq-rates/actions.ts` | Admin UI | CCQ rate CRUD server actions |
| `src/components/admin/rate-tier-form.tsx` | Admin UI | Rate tier edit form |
| `src/components/admin/rate-tier-lines-table.tsx` | Admin UI | Rate tier lines grid |
| `src/components/admin/ccq-rate-table.tsx` | Admin UI | CCQ rates display/edit |
| `src/components/admin/billing-settings-form.tsx` | Admin UI | Company billing settings form |
| `src/components/admin/learning-phase-dashboard.tsx` | Admin UI | Active overrides dashboard |
| `src/components/admin/advancement-alerts.tsx` | Admin UI | Apprenti progression alerts |
| `src/components/admin/classification-section.tsx` | Admin UI | Employee profile classification |

### Existing Files to Modify

| File | Agent | Changes |
|------|-------|---------|
| `src/types/database.ts` | Core | Regenerate with `supabase gen types` after migrations |
| `src/app/(protected)/admin/actions/settings.ts` | Core | Add `getBillingSettings()`, `updateBillingSettings()` |
| `src/app/(protected)/admin/actions/users.ts` | Core | Add classification data to employee queries |
| `src/app/(protected)/admin/actions/employee360.ts` | Core | Include classification history + trade |
| `src/app/(protected)/invoices/actions/queries.ts` | Integration | Use `resolveHourlyRate()` for uninvoiced entries |
| `src/app/(protected)/invoices/actions/mutations.ts` | Integration | Capture resolved rate source on invoice lines |
| `src/app/(protected)/timesheets/actions.ts` | Integration | Add OT flag support to save/submit |
| `src/components/admin/company-settings-form.tsx` | Admin UI | Add billing settings tab |
| `src/components/admin/user-edit-form.tsx` or similar | Admin UI | Embed classification section |
| `src/messages/en.json` | All | Add billing/CCQ/rate tier i18n keys |
| `src/messages/fr.json` | All | Add billing/CCQ/rate tier i18n keys |
| `src/app/(protected)/admin/page.tsx` | Admin UI | Add rate tiers + CCQ links to nav |

---

## 5. Agent Team Breakdown

### Agent 1: Schema (migrations + types)

**Scope**: All 5 SQL migration files + TypeScript type regeneration

**Tasks**:
1. Create migration files 10-14 (exact SQL from Section 1)
2. Run `supabase db push` or `supabase migration up` to apply
3. Run `supabase gen types typescript --local > src/types/database.ts` to regenerate
4. Create `src/types/billing.ts` with all new types
5. Verify all tables exist with correct constraints

**Depends on**: Nothing (runs first)
**Produces**: Schema ready for other agents

### Agent 2: Core Logic (rate resolution + classification)

**Scope**: Business logic layer

**Tasks**:
1. Create `src/lib/billing/rate-resolution.ts` — full 6-level cascade
2. Create `src/lib/billing/progression.ts` — advancement detection + execution
3. Create `src/lib/validations/billing.ts` — Zod schemas for all billing forms
4. Update `admin/actions/settings.ts` — billing settings CRUD
5. Update `admin/actions/users.ts` — classification data in employee queries
6. Update `admin/actions/employee360.ts` — classification history
7. Write tests for rate resolution cascade

**Depends on**: Agent 1 (schema must exist)

### Agent 3: Admin UI (rate tier management + settings)

**Scope**: All new admin pages and components

**Tasks**:
1. Create rate tier management page (`/admin/rate-tiers`)
2. Create CCQ rate management page (`/admin/ccq-rates`)
3. Create billing settings form (extension of company settings)
4. Create learning phase dashboard component
5. Create advancement alerts component
6. Create classification section for employee profiles
7. Add i18n keys to en.json and fr.json
8. Add navigation links

**Depends on**: Agent 2 (needs server actions + types)

### Agent 4: Integration (invoice + timesheet updates)

**Scope**: Wire rate tiers into existing invoice/timesheet flow

**Tasks**:
1. Update `invoices/actions/queries.ts` — use resolveHourlyRate for uninvoiced entries
2. Update `invoices/actions/mutations.ts` — capture rate source metadata
3. Update `timesheets/actions.ts` — OT flag support in save/submit
4. Update timesheet entry UI — show employee classification (read-only)
5. Update invoice wizard preview — show rate source (tier/override)
6. Test: existing invoices still render correctly
7. Test: new invoice creation uses rate tier resolution

**Depends on**: Agent 2 (needs rate resolution function)

---

## 6. Execution Order

```
Phase 1 (sequential):
  Agent 1: Schema → apply migrations → regenerate types

Phase 2 (parallel after Agent 1):
  Agent 2: Core Logic (rate resolution, progression, settings)

Phase 3 (parallel after Agent 2):
  Agent 3: Admin UI ──┐
  Agent 4: Integration ┘ (can run in parallel)

Phase 4 (sequential):
  Build verification: pnpm build
  Test suite: pnpm test
  Manual verification: invoice rendering, rate resolution
```

---

## 7. Testing Strategy

### Unit Tests (Agent 2)

```typescript
// src/lib/billing/__tests__/rate-resolution.test.ts
describe('resolveHourlyRate', () => {
  it('returns project override when set')
  it('returns employee override during learning phase')
  it('returns client tier line for assigned tier')
  it('returns default tier line when no client tier assigned')
  it('falls back to legacy project_billing_roles.rate')
  it('employee override expires correctly based on effective_to')
  it('handles missing classification gracefully')
})

// src/lib/billing/__tests__/progression.test.ts
describe('getAdvancementAlerts', () => {
  it('detects apprenti approaching threshold')
  it('correctly calculates hours from timesheet entries')
  it('excludes compagnons (no next level)')
  it('handles multi-trade employees')
})
```

### Integration Tests (Agent 4)

```typescript
// Verify backward compatibility
describe('Invoice generation', () => {
  it('existing invoices render with original captured rates')
  it('new invoices use rate tier resolution')
  it('rate source is captured on invoice lines')
})
```

### Build Verification

- `pnpm build` — must compile without errors
- `pnpm test` — all existing + new tests pass
- Manual: verify 3 existing invoices display correctly (no rate corruption)

---

## 8. Rollback Strategy

All migrations are additive (new tables + nullable columns). Rollback:

```sql
-- Reverse Migration 14
ALTER TABLE project_billing_roles DROP COLUMN IF EXISTS classification_id;

-- Reverse Migration 13
ALTER TABLE projects DROP COLUMN IF EXISTS ot_billing_config;
ALTER TABLE timesheet_entries DROP COLUMN IF EXISTS ot_flags;
DROP TABLE IF EXISTS billing_rate_history;
DELETE FROM settings WHERE key = 'billing_settings';

-- Reverse Migration 12
ALTER TABLE people DROP COLUMN IF EXISTS primary_trade_id;
ALTER TABLE project_members DROP COLUMN IF EXISTS classification_override_id;
DROP TABLE IF EXISTS employee_rate_overrides;
DROP TABLE IF EXISTS employee_classifications;

-- Reverse Migration 11
DROP TABLE IF EXISTS project_rate_overrides;
DROP TABLE IF EXISTS client_rate_tiers;
DROP TABLE IF EXISTS rate_tier_lines;
DROP TABLE IF EXISTS rate_tiers;

-- Reverse Migration 10
DROP TABLE IF EXISTS ccq_rates;
DROP TABLE IF EXISTS ccq_classifications;
DROP TABLE IF EXISTS ccq_trades;
```

**No existing data is modified or deleted** during forward migration.
The only destructive operation is the backfill (Migration 14) which sets
`project_billing_roles.classification_id` — this is a new column, so
dropping it reverts cleanly.

---

## 9. Data Entry Required (Post-Migration, Manual)

These are business tasks that require human knowledge, not code:

1. **Employee classifications**: Admin assigns trade + level to each active employee
   - `employee_classifications` rows (person_id, classification_id, effective_from)
   - ~15-40 employees, ~5 min each = 1-3 hours of admin work

2. **Client tier assignments**: Admin assigns rate tiers to clients
   - `client_rate_tiers` rows (client_id, tier_id)
   - Most clients = Tier A (default), identify Tier B and Custom clients
   - ~10 minutes total

3. **Real CCQ rates**: Enter actual CCQ wage rates from décret
   - `ccq_rates` rows — replace placeholder values
   - Will be automated once CCQ scrape is built

4. **Tier line rates**: Confirm/adjust rates for non-Platrier trades
   - Currently only Platrier rates are seeded
   - Need Tireur de joints, Peintre rates per tier

5. **Review unmapped billing roles**: Check roles that didn't match in backfill
   - Query: `SELECT * FROM project_billing_roles WHERE classification_id IS NULL`
   - OT roles and trick rates are intentionally unmapped
