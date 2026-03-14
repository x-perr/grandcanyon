'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import type {
  Employee360Data,
  Employee360Timesheet,
  Employee360Expense,
  Employee360Profile,
  Employee360SkillLevel,
} from './types'
import type {
  EmployeeClassification,
  EmployeeRateOverride,
  CcqClassification,
  CcqTrade,
} from '@/types/billing'

/**
 * Get Employee 360° view data
 * Fetches profile with skill level, recent timesheets, and recent expenses
 */
export async function getEmployee360(userId: string): Promise<Employee360Data | null> {
  const supabase = await createClient()

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return null
  }

  // Fetch user profile with person and skill level
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      first_name,
      last_name,
      phone,
      is_active,
      role_id,
      manager_id,
      created_at,
      role:roles(id, name),
      manager:profiles!profiles_manager_id_fkey(id, first_name, last_name),
      person:people(
        id,
        address,
        city,
        postal_code,
        skill_level:skill_levels(id, code, name_en, name_fr, hourly_rate)
      )
    `)
    .eq('id', userId)
    .single()

  if (profileError || !profileData) {
    console.error('Error fetching employee profile:', profileError)
    return null
  }

  // Helper to unwrap Supabase array relations
  const unwrap = <T>(val: T | T[] | null): T | null => {
    if (Array.isArray(val)) return val[0] ?? null
    return val
  }

  // Normalize the profile data (Supabase returns arrays for relations)
  const rawRole = unwrap(profileData.role as { id: string; name: string } | { id: string; name: string }[] | null)
  const rawManager = unwrap(profileData.manager as { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null)

  // Handle nested person -> skill_level
  type RawPerson = {
    id: string
    address: string | null
    city: string | null
    postal_code: string | null
    skill_level: Employee360SkillLevel | Employee360SkillLevel[] | null
  }
  const rawPerson = unwrap(profileData.person as RawPerson | RawPerson[] | null)

  let normalizedPerson: Employee360Profile['person'] = null
  if (rawPerson) {
    normalizedPerson = {
      id: rawPerson.id,
      address: rawPerson.address,
      city: rawPerson.city,
      postal_code: rawPerson.postal_code,
      skill_level: unwrap(rawPerson.skill_level),
    }
  }

  const profile: Employee360Profile = {
    id: profileData.id,
    email: profileData.email,
    first_name: profileData.first_name,
    last_name: profileData.last_name,
    phone: profileData.phone,
    is_active: profileData.is_active,
    role_id: profileData.role_id,
    manager_id: profileData.manager_id,
    created_at: profileData.created_at,
    role: rawRole,
    manager: rawManager,
    person: normalizedPerson,
  }

  // Calculate date range for last 8 weeks
  const eightWeeksAgo = new Date()
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
  const eightWeeksAgoStr = eightWeeksAgo.toISOString().split('T')[0]

  // Fetch recent timesheets with total hours
  const { data: timesheetsData, error: timesheetsError } = await supabase
    .from('timesheets')
    .select(`
      id,
      week_start,
      status,
      entries:timesheet_entries(hours)
    `)
    .eq('user_id', userId)
    .gte('week_start', eightWeeksAgoStr)
    .order('week_start', { ascending: false })

  if (timesheetsError) {
    console.error('Error fetching timesheets:', timesheetsError)
  }

  // Calculate total hours for each timesheet
  const timesheets: Employee360Timesheet[] = (timesheetsData ?? []).map((ts) => {
    const entries = ts.entries as { hours: number[] }[] | null
    let totalHours = 0
    if (entries) {
      for (const entry of entries) {
        if (entry.hours) {
          totalHours += entry.hours.reduce((sum, h) => sum + (h || 0), 0)
        }
      }
    }
    return {
      id: ts.id,
      week_start: ts.week_start,
      status: ts.status as Employee360Timesheet['status'],
      total_hours: totalHours,
    }
  })

  // Fetch recent expenses with totals
  const { data: expensesData, error: expensesError } = await supabase
    .from('expenses')
    .select(`
      id,
      week_start,
      status,
      entries:expense_entries(total)
    `)
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(10)

  if (expensesError) {
    console.error('Error fetching expenses:', expensesError)
  }

  // Calculate total amount for each expense report
  const expenses: Employee360Expense[] = (expensesData ?? []).map((exp) => {
    const entries = exp.entries as { total: number }[] | null
    let totalAmount = 0
    let entryCount = 0
    if (entries) {
      entryCount = entries.length
      for (const entry of entries) {
        totalAmount += entry.total || 0
      }
    }
    return {
      id: exp.id,
      week_start: exp.week_start,
      status: exp.status as Employee360Expense['status'],
      total_amount: totalAmount,
      entry_count: entryCount,
    }
  })

  // Fetch billing classification and rate data via person_id
  const personId = normalizedPerson?.id
  let currentClassification: (EmployeeClassification & { classification?: CcqClassification }) | null = null
  let tradeInfo: CcqTrade | null = null
  let activeRateOverrides: EmployeeRateOverride[] = []
  let classificationHistory: (EmployeeClassification & { classification?: CcqClassification })[] = []

  if (personId) {
    const today = new Date().toISOString().split('T')[0]

    // Current classification (effective_to IS NULL = currently active)
    const { data: currentClassData } = await supabase
      .from('employee_classifications')
      .select(`
        *,
        classification:ccq_classifications(*, trade:ccq_trades(*))
      `)
      .eq('person_id', personId)
      .is('effective_to', null)
      .order('effective_from', { ascending: false })
      .limit(1)
      .single()

    if (currentClassData) {
      const rawClassification = Array.isArray(currentClassData.classification)
        ? currentClassData.classification[0]
        : currentClassData.classification
      currentClassification = {
        ...currentClassData,
        classification: rawClassification ?? undefined,
      } as EmployeeClassification & { classification?: CcqClassification }
    }

    // Trade info via people.primary_trade_id
    const { data: personData } = await supabase
      .from('people')
      .select('primary_trade_id')
      .eq('id', personId)
      .single()

    if (personData?.primary_trade_id) {
      const { data: trade } = await supabase
        .from('ccq_trades')
        .select('*')
        .eq('id', personData.primary_trade_id)
        .single()

      if (trade) {
        tradeInfo = trade as CcqTrade
      }
    }

    // Active rate overrides (not yet expired)
    const { data: overrides } = await supabase
      .from('employee_rate_overrides')
      .select('*')
      .eq('person_id', personId)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order('effective_from', { ascending: false })

    activeRateOverrides = (overrides ?? []) as EmployeeRateOverride[]

    // Classification history (all rows for this person)
    const { data: historyData } = await supabase
      .from('employee_classifications')
      .select(`
        *,
        classification:ccq_classifications(*, trade:ccq_trades(*))
      `)
      .eq('person_id', personId)
      .order('effective_from', { ascending: false })

    classificationHistory = (historyData ?? []).map((row) => {
      const rawCls = Array.isArray(row.classification) ? row.classification[0] : row.classification
      return {
        ...row,
        classification: rawCls ?? undefined,
      }
    }) as (EmployeeClassification & { classification?: CcqClassification })[]
  }

  // Calculate this month's totals
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const firstDayOfMonthStr = firstDayOfMonth.toISOString().split('T')[0]

  let hoursThisMonth = 0
  for (const ts of timesheets) {
    if (ts.week_start >= firstDayOfMonthStr) {
      hoursThisMonth += ts.total_hours
    }
  }

  let expensesThisMonth = 0
  for (const exp of expenses) {
    if (exp.week_start >= firstDayOfMonthStr) {
      expensesThisMonth += exp.total_amount
    }
  }

  return {
    profile,
    timesheets,
    expenses,
    summary: {
      hoursThisMonth,
      expensesThisMonth,
    },
    billing: {
      currentClassification,
      tradeInfo,
      activeRateOverrides,
      classificationHistory,
    },
  }
}
