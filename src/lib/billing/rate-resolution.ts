import { createClient } from '@/lib/supabase/server'
import type {
  BillingSettings,
  CcqClassification,
  ResolvedRate,
} from '@/types/billing'

// ============================================================
// Default billing settings (fallback when no DB row exists)
// ============================================================

const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  default_rate_tier_id: null,
  rate_tier_versioning: 'annual_may',
  ot_default_mode: 'standard',
  ot_standard_multiplier_1_5x: 1.5,
  ot_standard_multiplier_2x: 2.0,
  ot_custom_multiplier_1_5x: null,
  ot_custom_multiplier_2x: null,
  ot_approval_default: 'per_instance',
  retainage_default_percent: 10,
  retainage_on_subtotal: true,
  retainage_hold_days: 45,
  learning_phase_default_weeks: 2,
  learning_phase_alert_days: 3,
}

// ============================================================
// Billing Settings
// ============================================================

/**
 * Read billing settings from the settings table.
 * Merges with defaults so all fields are guaranteed present.
 */
export async function getBillingSettings(): Promise<BillingSettings> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'billing_settings')
    .single()

  if (error || !data) {
    return DEFAULT_BILLING_SETTINGS
  }

  return { ...DEFAULT_BILLING_SETTINGS, ...(data.value as Partial<BillingSettings>) }
}

// ============================================================
// Employee Classification Resolution
// ============================================================

/**
 * Resolve the CCQ classification for an employee.
 *
 * Resolution order:
 *  1. Project-level override (project_members.classification_override_id)
 *  2. Current employee classification (employee_classifications WHERE effective_to IS NULL)
 */
export async function getEmployeeClassification(params: {
  personId: string
  projectId?: string
}): Promise<CcqClassification | null> {
  const supabase = await createClient()

  // 1. Check project-level classification override
  if (params.projectId) {
    const { data: member } = await supabase
      .from('project_members')
      .select('classification_override_id')
      .eq('person_id', params.personId)
      .eq('project_id', params.projectId)
      .single()

    if (member?.classification_override_id) {
      const { data: classification } = await supabase
        .from('ccq_classifications')
        .select('*, trade:ccq_trades(*)')
        .eq('id', member.classification_override_id)
        .single()

      if (classification) {
        return classification as CcqClassification
      }
    }
  }

  // 2. Current employee classification (no effective_to = currently active)
  const { data: empClass } = await supabase
    .from('employee_classifications')
    .select('classification_id')
    .eq('person_id', params.personId)
    .is('effective_to', null)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single()

  if (!empClass?.classification_id) {
    return null
  }

  const { data: classification } = await supabase
    .from('ccq_classifications')
    .select('*, trade:ccq_trades(*)')
    .eq('id', empClass.classification_id)
    .single()

  return (classification as CcqClassification) ?? null
}

// ============================================================
// Rate Resolution — 6-level cascade
// ============================================================

/**
 * Resolve the hourly billing rate for an employee on a project.
 *
 * Rate Resolution Order (most specific wins):
 *  1. Change order override         — skipped for v1
 *  2. Project rate override         — project_rate_overrides
 *  3. Employee rate override        — employee_rate_overrides (active only)
 *  4. Client rate tier line         — client_rate_tiers → rate_tier_lines
 *  5. Default rate tier line        — rate_tiers WHERE is_default = true
 *  6. Legacy fallback               — project_billing_roles.rate
 */
export async function resolveHourlyRate(params: {
  employeePersonId: string
  projectId: string
  classificationId?: string
  changeOrderId?: string | null
  asOfDate?: string
}): Promise<ResolvedRate> {
  const supabase = await createClient()
  const today = params.asOfDate ?? new Date().toISOString().slice(0, 10)

  // Resolve classification if not provided
  let classificationId = params.classificationId
  let classificationLevel: string | undefined

  if (!classificationId) {
    const classification = await getEmployeeClassification({
      personId: params.employeePersonId,
      projectId: params.projectId,
    })
    classificationId = classification?.id
    classificationLevel = classification?.level
  } else {
    // Fetch level for the provided classification
    const { data: cls } = await supabase
      .from('ccq_classifications')
      .select('level')
      .eq('id', classificationId)
      .single()
    classificationLevel = cls?.level
  }

  // --- Level 1: Change order override (skipped for v1) ---

  // --- Level 2: Project rate override ---
  if (classificationId) {
    const { data: projectOverride } = await supabase
      .from('project_rate_overrides')
      .select('hourly_rate')
      .eq('project_id', params.projectId)
      .eq('classification_id', classificationId)
      .single()

    if (projectOverride) {
      return {
        rate: projectOverride.hourly_rate,
        source: 'project_override',
        classificationLevel,
      }
    }
  }

  // Also check project override with null classification (applies to all)
  const { data: projectWildcard } = await supabase
    .from('project_rate_overrides')
    .select('hourly_rate')
    .eq('project_id', params.projectId)
    .is('classification_id', null)
    .single()

  if (projectWildcard) {
    return {
      rate: projectWildcard.hourly_rate,
      source: 'project_override',
      classificationLevel,
    }
  }

  // --- Level 3: Employee rate override (active only) ---
  {
    // Build query: person match, started on or before today, not yet expired
    let query = supabase
      .from('employee_rate_overrides')
      .select('hourly_rate')
      .eq('person_id', params.employeePersonId)
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)

    if (classificationId) {
      query = query.or(
        `classification_id.eq.${classificationId},classification_id.is.null`
      )
    }

    const { data: activeOverride } = await query
      .order('effective_from', { ascending: false })
      .limit(1)
      .single()

    if (activeOverride) {
      return {
        rate: activeOverride.hourly_rate,
        source: 'employee_override',
        classificationLevel,
      }
    }
  }

  // --- Level 4: Client rate tier ---
  if (classificationId) {
    // Get project's client_id
    const { data: project } = await supabase
      .from('projects')
      .select('client_id')
      .eq('id', params.projectId)
      .single()

    if (project?.client_id) {
      const { data: clientTier } = await supabase
        .from('client_rate_tiers')
        .select('tier_id, tier:rate_tiers(code)')
        .eq('client_id', project.client_id)
        .single()

      if (clientTier?.tier_id) {
        const { data: tierLine } = await supabase
          .from('rate_tier_lines')
          .select('hourly_rate')
          .eq('tier_id', clientTier.tier_id)
          .eq('classification_id', classificationId)
          .lte('effective_date', today)
          .order('effective_date', { ascending: false })
          .limit(1)
          .single()

        if (tierLine) {
          const tierCode = (clientTier.tier as { code?: string } | null)?.code
          return {
            rate: tierLine.hourly_rate,
            source: 'client_tier',
            tierCode: tierCode ?? undefined,
            classificationLevel,
          }
        }
      }
    }
  }

  // --- Level 5: Default rate tier ---
  if (classificationId) {
    const { data: defaultTier } = await supabase
      .from('rate_tiers')
      .select('id, code')
      .eq('is_default', true)
      .eq('is_active', true)
      .single()

    if (defaultTier) {
      const { data: tierLine } = await supabase
        .from('rate_tier_lines')
        .select('hourly_rate')
        .eq('tier_id', defaultTier.id)
        .eq('classification_id', classificationId)
        .lte('effective_date', today)
        .order('effective_date', { ascending: false })
        .limit(1)
        .single()

      if (tierLine) {
        return {
          rate: tierLine.hourly_rate,
          source: 'default_tier',
          tierCode: defaultTier.code,
          classificationLevel,
        }
      }
    }
  }

  // --- Level 6: Legacy fallback (project_billing_roles.rate) ---
  {
    // Find the billing role assigned to this employee on the project
    const { data: member } = await supabase
      .from('project_members')
      .select('billing_role_id')
      .eq('person_id', params.employeePersonId)
      .eq('project_id', params.projectId)
      .single()

    if (member?.billing_role_id) {
      const { data: role } = await supabase
        .from('project_billing_roles')
        .select('rate')
        .eq('id', member.billing_role_id)
        .single()

      if (role) {
        return {
          rate: role.rate,
          source: 'legacy_role',
          classificationLevel,
        }
      }
    }

    // Last resort: project default hourly rate
    const { data: project } = await supabase
      .from('projects')
      .select('hourly_rate')
      .eq('id', params.projectId)
      .single()

    if (project?.hourly_rate) {
      return {
        rate: project.hourly_rate,
        source: 'legacy_role',
        classificationLevel,
      }
    }
  }

  // No rate found — return zero with legacy source
  return {
    rate: 0,
    source: 'legacy_role',
    classificationLevel,
  }
}
