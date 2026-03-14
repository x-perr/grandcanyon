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
-- Disable audit_trigger (references NEW.id but settings table has no id column)
ALTER TABLE settings DISABLE TRIGGER audit_trigger;
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
ALTER TABLE settings ENABLE TRIGGER audit_trigger;

-- RLS
ALTER TABLE billing_rate_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing_rate_history_read" ON billing_rate_history;
CREATE POLICY "billing_rate_history_read" ON billing_rate_history
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "billing_rate_history_admin" ON billing_rate_history;
CREATE POLICY "billing_rate_history_admin" ON billing_rate_history
  FOR ALL TO authenticated
  USING (has_permission('admin.manage')) WITH CHECK (has_permission('admin.manage'));
