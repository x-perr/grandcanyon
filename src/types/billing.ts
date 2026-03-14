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

// ============================================================
// Rate Resolution Types
// ============================================================

export type RateSource =
  | 'project_override'
  | 'employee_override'
  | 'client_tier'
  | 'default_tier'
  | 'legacy_role'

export interface ResolvedRate {
  rate: number
  source: RateSource
  tierCode?: string
  classificationLevel?: string
}

// ============================================================
// Advancement Alert Types
// ============================================================

export interface AdvancementAlert {
  personId: string
  personName: string
  currentClassification: CcqClassification
  nextClassification: CcqClassification | null
  hoursAccumulated: number
  hoursRequired: number
  progressPercent: number
  estimatedAdvancementDate: string | null
}
