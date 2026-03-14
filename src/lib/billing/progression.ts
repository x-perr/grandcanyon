import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import type { AdvancementAlert, CcqClassification } from '@/types/billing'

// ============================================================
// Classification level ordering (for determining next level)
// ============================================================

const APPRENTICE_LEVELS = ['apprenti_1', 'apprenti_2', 'apprenti_3'] as const
const LEVEL_ORDER = ['apprenti_1', 'apprenti_2', 'apprenti_3', 'compagnon'] as const

/**
 * Given a classification level, return the next level in the progression.
 * Returns null if already at compagnon or if level is not in the progression.
 */
function getNextLevel(
  currentLevel: string
): (typeof LEVEL_ORDER)[number] | null {
  const idx = LEVEL_ORDER.indexOf(currentLevel as (typeof LEVEL_ORDER)[number])
  if (idx === -1 || idx >= LEVEL_ORDER.length - 1) return null
  return LEVEL_ORDER[idx + 1]
}

// ============================================================
// Advancement Alerts
// ============================================================

/**
 * Scan all active apprentice classifications and compare accumulated
 * hours against the required hours for advancement.
 *
 * Returns alerts sorted by progress descending (closest to advancement first).
 */
export async function getAdvancementAlerts(): Promise<AdvancementAlert[]> {
  const supabase = await createClient()

  // Get all active employee classifications at apprentice levels
  const { data: empClassifications, error: empError } = await supabase
    .from('employee_classifications')
    .select(`
      id,
      person_id,
      classification_id,
      ccq_hours_accumulated,
      effective_from,
      classification:ccq_classifications(
        id, trade_id, level, name_fr, name_en, hours_required, sort_order,
        trade:ccq_trades(*)
      )
    `)
    .is('effective_to', null)

  if (empError || !empClassifications) {
    console.error('Error fetching employee classifications:', empError)
    return []
  }

  // Filter to apprentice levels only
  const apprenticeRecords = empClassifications.filter((ec) => {
    const classificationArr = ec.classification as unknown as CcqClassification[] | null
    const classification = classificationArr?.[0] ?? null
    return (
      classification &&
      APPRENTICE_LEVELS.includes(
        classification.level as (typeof APPRENTICE_LEVELS)[number]
      )
    )
  })

  if (apprenticeRecords.length === 0) return []

  // Collect person IDs to fetch names and timesheet hours
  const personIds = [...new Set(apprenticeRecords.map((r) => r.person_id))]

  // Fetch person names
  const { data: people } = await supabase
    .from('people')
    .select('id, first_name, last_name')
    .in('id', personIds)

  const personMap = new Map(
    (people ?? []).map((p) => [
      p.id,
      `${p.first_name} ${p.last_name}`,
    ])
  )

  // Sum timesheet hours per person (from effective_from of their classification onward)
  // We compute per-person totals using the hours[] array (7 elements, Mon-Sun)
  const hoursMap = new Map<string, number>()

  for (const rec of apprenticeRecords) {
    const { data: entries } = await supabase
      .from('timesheet_entries')
      .select('hours, timesheet:timesheets!inner(person_id, week_start)')
      .eq('timesheet.person_id', rec.person_id)
      .gte('timesheet.week_start', rec.effective_from)

    let total = rec.ccq_hours_accumulated ?? 0

    if (entries) {
      for (const entry of entries) {
        const hours = entry.hours as number[] | null
        if (hours && Array.isArray(hours)) {
          total += hours.reduce((sum: number, h: number) => sum + (h ?? 0), 0)
        }
      }
    }

    hoursMap.set(rec.person_id, total)
  }

  // For each apprentice, find the next classification in the same trade
  const alerts: AdvancementAlert[] = []

  for (const rec of apprenticeRecords) {
    const classArr = rec.classification as unknown as CcqClassification[] | CcqClassification | null
    const classification = Array.isArray(classArr) ? classArr[0] : classArr
    if (!classification || !classification.hours_required) continue

    const hoursAccumulated = hoursMap.get(rec.person_id) ?? 0
    const hoursRequired = classification.hours_required
    const progressPercent = Math.min(
      100,
      Math.round((hoursAccumulated / hoursRequired) * 100)
    )

    // Determine next classification
    const nextLevel = getNextLevel(classification.level)
    let nextClassification: CcqClassification | null = null

    if (nextLevel) {
      const { data: nextCls } = await supabase
        .from('ccq_classifications')
        .select('*, trade:ccq_trades(*)')
        .eq('trade_id', classification.trade_id)
        .eq('level', nextLevel)
        .single()

      nextClassification = (nextCls as CcqClassification) ?? null
    }

    // Estimate advancement date based on average hours/week
    let estimatedAdvancementDate: string | null = null
    if (hoursAccumulated > 0 && hoursAccumulated < hoursRequired) {
      const effectiveFrom = new Date(rec.effective_from)
      const now = new Date()
      const weeksElapsed = Math.max(
        1,
        (now.getTime() - effectiveFrom.getTime()) / (7 * 24 * 60 * 60 * 1000)
      )
      const avgHoursPerWeek = hoursAccumulated / weeksElapsed
      if (avgHoursPerWeek > 0) {
        const remainingHours = hoursRequired - hoursAccumulated
        const remainingWeeks = remainingHours / avgHoursPerWeek
        const estimatedDate = new Date(
          now.getTime() + remainingWeeks * 7 * 24 * 60 * 60 * 1000
        )
        estimatedAdvancementDate = estimatedDate.toISOString().slice(0, 10)
      }
    }

    alerts.push({
      personId: rec.person_id,
      personName: personMap.get(rec.person_id) ?? 'Unknown',
      currentClassification: classification,
      nextClassification,
      hoursAccumulated,
      hoursRequired,
      progressPercent,
      estimatedAdvancementDate,
    })
  }

  // Sort by progress descending (closest to advancement first)
  alerts.sort((a, b) => b.progressPercent - a.progressPercent)

  return alerts
}

// ============================================================
// Advance Classification
// ============================================================

/**
 * Advance an employee to a new classification level.
 *
 * - Closes the current classification record (sets effective_to)
 * - Inserts a new classification record with the new classification_id
 * - Logs an audit entry
 */
export async function advanceClassification(params: {
  personId: string
  newClassificationId: string
  effectiveDate: string
  notes?: string
}): Promise<void> {
  const supabase = await createClient()

  // Close the current active classification
  const { data: current, error: fetchError } = await supabase
    .from('employee_classifications')
    .select('id, classification_id')
    .eq('person_id', params.personId)
    .is('effective_to', null)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single()

  if (fetchError) {
    console.error('Error fetching current classification:', fetchError)
    throw new Error('Failed to fetch current classification')
  }

  if (current) {
    const { error: closeError } = await supabase
      .from('employee_classifications')
      .update({ effective_to: params.effectiveDate })
      .eq('id', current.id)

    if (closeError) {
      console.error('Error closing current classification:', closeError)
      throw new Error('Failed to close current classification')
    }
  }

  // Insert new classification record
  const { error: insertError } = await supabase
    .from('employee_classifications')
    .insert({
      person_id: params.personId,
      classification_id: params.newClassificationId,
      effective_from: params.effectiveDate,
      effective_to: null,
      ccq_hours_accumulated: 0,
      notes: params.notes ?? null,
    })

  if (insertError) {
    console.error('Error inserting new classification:', insertError)
    throw new Error('Failed to insert new classification')
  }

  // Log audit
  await logAudit({
    action: 'update',
    entityType: 'classification',
    entityId: params.personId,
    oldValues: current
      ? { classification_id: current.classification_id }
      : undefined,
    newValues: {
      classification_id: params.newClassificationId,
      effective_date: params.effectiveDate,
      notes: params.notes,
    },
  })
}
