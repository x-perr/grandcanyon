'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { formatDateISO, getMonday, getSunday } from '@/lib/date'

// === TYPE DEFINITIONS ===

export type AssignmentStatus = 'scheduled' | 'active' | 'completed' | 'cancelled'

export type Assignment = {
  id: string
  employee_id: string
  project_id: string
  start_date: string
  end_date: string
  status: AssignmentStatus
  hours_per_day: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AssignmentWithRelations = Assignment & {
  employee: {
    id: string
    first_name: string
    last_name: string
    email: string
  } | null
  project: {
    id: string
    code: string
    name: string
    client: { id: string; name: string; code: string } | null
  } | null
}

export type EmployeeWithAssignment = {
  id: string
  first_name: string
  last_name: string
  email: string
  assignment: AssignmentWithRelations | null
}

// === QUERY FUNCTIONS ===

/**
 * Get assignments for a specific week (all employees)
 * Returns a list of employees with their assignment for that week (if any)
 */
export async function getWeekAssignments(weekStart: string): Promise<{
  employees: EmployeeWithAssignment[]
  weekStart: string
  weekEnd: string
}> {
  const supabase = await createClient()

  // Normalize to Monday
  const monday = getMonday(new Date(weekStart))
  const sunday = getSunday(monday)
  const weekStartISO = formatDateISO(monday)
  const weekEndISO = formatDateISO(sunday)

  // Get all active employees
  // Note: profiles table doesn't have deleted_at column
  const { data: employees, error: empError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .eq('is_active', true)
    .order('last_name')
    .order('first_name')

  if (empError) {
    console.error('Error fetching employees:', empError)
    return { employees: [], weekStart: weekStartISO, weekEnd: weekEndISO }
  }

  // Get assignments that overlap with this week
  const { data: assignments, error: assError } = await supabase
    .from('assignments')
    .select(`
      *,
      employee:profiles!assignments_employee_id_fkey(id, first_name, last_name, email),
      project:projects!assignments_project_id_fkey(
        id, code, name,
        client:clients!projects_client_id_fkey(id, name, code)
      )
    `)
    .neq('status', 'cancelled')
    .lte('start_date', weekEndISO)
    .gte('end_date', weekStartISO)

  if (assError) {
    console.error('Error fetching assignments:', assError)
  }

  // Build lookup map by employee_id
  const assignmentByEmployee = new Map<string, AssignmentWithRelations>()
  assignments?.forEach((a) => {
    const employee = Array.isArray(a.employee) ? a.employee[0] : a.employee
    const project = Array.isArray(a.project) ? a.project[0] : a.project
    const client = project ? (Array.isArray(project.client) ? project.client[0] : project.client) : null

    assignmentByEmployee.set(a.employee_id, {
      ...a,
      employee,
      project: project ? { ...project, client } : null,
    } as AssignmentWithRelations)
  })

  // Build result with employees and their assignments
  const result: EmployeeWithAssignment[] = (employees ?? []).map((emp) => ({
    id: emp.id,
    first_name: emp.first_name ?? '',
    last_name: emp.last_name ?? '',
    email: emp.email ?? '',
    assignment: assignmentByEmployee.get(emp.id) ?? null,
  }))

  return { employees: result, weekStart: weekStartISO, weekEnd: weekEndISO }
}

/**
 * Get assignments for a specific employee
 */
export async function getEmployeeAssignments(
  employeeId: string,
  options?: { upcoming?: boolean; limit?: number }
): Promise<AssignmentWithRelations[]> {
  const supabase = await createClient()
  const { upcoming = false, limit = 10 } = options ?? {}

  let query = supabase
    .from('assignments')
    .select(`
      *,
      employee:profiles!assignments_employee_id_fkey(id, first_name, last_name, email),
      project:projects!assignments_project_id_fkey(
        id, code, name,
        client:clients!projects_client_id_fkey(id, name, code)
      )
    `)
    .eq('employee_id', employeeId)
    .neq('status', 'cancelled')

  if (upcoming) {
    const today = formatDateISO(new Date())
    query = query.gte('end_date', today)
  }

  query = query.order('start_date', { ascending: true }).limit(limit)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching employee assignments:', error)
    return []
  }

  return (data ?? []).map((a) => {
    const employee = Array.isArray(a.employee) ? a.employee[0] : a.employee
    const project = Array.isArray(a.project) ? a.project[0] : a.project
    const client = project ? (Array.isArray(project.client) ? project.client[0] : project.client) : null

    return {
      ...a,
      employee,
      project: project ? { ...project, client } : null,
    } as AssignmentWithRelations
  })
}

/**
 * Get a single assignment by ID
 */
export async function getAssignmentById(id: string): Promise<AssignmentWithRelations | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('assignments')
    .select(`
      *,
      employee:profiles!assignments_employee_id_fkey(id, first_name, last_name, email),
      project:projects!assignments_project_id_fkey(
        id, code, name,
        client:clients!projects_client_id_fkey(id, name, code)
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching assignment:', error)
    return null
  }

  const employee = Array.isArray(data.employee) ? data.employee[0] : data.employee
  const project = Array.isArray(data.project) ? data.project[0] : data.project
  const client = project ? (Array.isArray(project.client) ? project.client[0] : project.client) : null

  return {
    ...data,
    employee,
    project: project ? { ...project, client } : null,
  } as AssignmentWithRelations
}

/**
 * Get all active projects for dropdown
 */
export async function getActiveProjects(): Promise<
  { id: string; code: string; name: string; client: { id: string; name: string } | null }[]
> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projects')
    .select(`
      id, code, name,
      client:clients!projects_client_id_fkey(id, name)
    `)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('code')

  if (error) {
    console.error('Error fetching projects:', error)
    return []
  }

  return (data ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    client: Array.isArray(p.client) ? p.client[0] : p.client,
  }))
}

/**
 * Get all active employees for dropdown
 */
export async function getActiveEmployees(): Promise<
  { id: string; first_name: string; last_name: string; email: string }[]
> {
  const supabase = await createClient()

  // Note: profiles table doesn't have deleted_at column
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .eq('is_active', true)
    .order('last_name')
    .order('first_name')

  if (error) {
    console.error('Error fetching employees:', error)
    return []
  }

  return data ?? []
}

// === MUTATION FUNCTIONS ===

/**
 * Create a new assignment
 */
export async function createAssignment(data: {
  employee_id: string
  project_id: string
  start_date: string
  end_date: string
  hours_per_day?: number
  notes?: string
}): Promise<{ assignment?: Assignment; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check admin permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.users')) {
    return { error: 'Not authorized to manage assignments' }
  }

  // Validate dates
  if (new Date(data.end_date) < new Date(data.start_date)) {
    return { error: 'End date must be after start date' }
  }

  // Check for conflicts
  const conflicts = await checkAssignmentConflicts(data.employee_id, data.start_date, data.end_date)
  if (conflicts.hasConflict) {
    return { error: conflicts.message ?? 'Employee already has an assignment during this period' }
  }

  const { data: assignment, error } = await supabase
    .from('assignments')
    .insert({
      employee_id: data.employee_id,
      project_id: data.project_id,
      start_date: data.start_date,
      end_date: data.end_date,
      hours_per_day: data.hours_per_day ?? 8.0,
      notes: data.notes || null,
      status: 'scheduled',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating assignment:', error)
    if (error.code === '23P01') {
      // Exclusion constraint violation
      return { error: 'Employee already has an assignment during this period' }
    }
    return { error: 'Failed to create assignment' }
  }

  revalidatePath('/scheduling')
  return { assignment }
}

/**
 * Update an existing assignment
 */
export async function updateAssignment(
  id: string,
  data: {
    project_id?: string
    start_date?: string
    end_date?: string
    status?: AssignmentStatus
    hours_per_day?: number
    notes?: string
  }
): Promise<{ assignment?: Assignment; error?: string }> {
  const supabase = await createClient()

  // Check admin permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.users')) {
    return { error: 'Not authorized to manage assignments' }
  }

  // Get current assignment
  const { data: current, error: fetchError } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !current) {
    return { error: 'Assignment not found' }
  }

  // Validate dates if changing
  const startDate = data.start_date ?? current.start_date
  const endDate = data.end_date ?? current.end_date
  if (new Date(endDate) < new Date(startDate)) {
    return { error: 'End date must be after start date' }
  }

  // Check for conflicts if dates are changing
  if (data.start_date || data.end_date) {
    const conflicts = await checkAssignmentConflicts(current.employee_id, startDate, endDate, id)
    if (conflicts.hasConflict) {
      return { error: conflicts.message ?? 'Employee already has an assignment during this period' }
    }
  }

  const { data: assignment, error } = await supabase
    .from('assignments')
    .update({
      project_id: data.project_id ?? current.project_id,
      start_date: data.start_date ?? current.start_date,
      end_date: data.end_date ?? current.end_date,
      status: data.status ?? current.status,
      hours_per_day: data.hours_per_day ?? current.hours_per_day,
      notes: data.notes !== undefined ? (data.notes || null) : current.notes,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating assignment:', error)
    if (error.code === '23P01') {
      return { error: 'Employee already has an assignment during this period' }
    }
    return { error: 'Failed to update assignment' }
  }

  revalidatePath('/scheduling')
  return { assignment }
}

/**
 * Cancel an assignment (soft delete)
 */
export async function cancelAssignment(id: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()

  // Check admin permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.users')) {
    return { error: 'Not authorized to manage assignments' }
  }

  const { error } = await supabase.from('assignments').update({ status: 'cancelled' }).eq('id', id)

  if (error) {
    console.error('Error cancelling assignment:', error)
    return { error: 'Failed to cancel assignment' }
  }

  revalidatePath('/scheduling')
  return { success: true }
}

/**
 * Delete an assignment permanently
 */
export async function deleteAssignment(id: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()

  // Check admin permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.users')) {
    return { error: 'Not authorized to manage assignments' }
  }

  const { error } = await supabase.from('assignments').delete().eq('id', id)

  if (error) {
    console.error('Error deleting assignment:', error)
    return { error: 'Failed to delete assignment' }
  }

  revalidatePath('/scheduling')
  return { success: true }
}

// === HELPER FUNCTIONS ===

/**
 * Check for assignment conflicts
 */
export async function checkAssignmentConflicts(
  employeeId: string,
  startDate: string,
  endDate: string,
  excludeId?: string
): Promise<{ hasConflict: boolean; conflictingAssignment?: AssignmentWithRelations; message?: string }> {
  const supabase = await createClient()

  let query = supabase
    .from('assignments')
    .select(`
      *,
      employee:profiles!assignments_employee_id_fkey(id, first_name, last_name, email),
      project:projects!assignments_project_id_fkey(
        id, code, name,
        client:clients!projects_client_id_fkey(id, name, code)
      )
    `)
    .eq('employee_id', employeeId)
    .neq('status', 'cancelled')
    .lte('start_date', endDate)
    .gte('end_date', startDate)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query.limit(1)

  if (error) {
    console.error('Error checking conflicts:', error)
    return { hasConflict: false }
  }

  if (data && data.length > 0) {
    const conflict = data[0]
    const employee = Array.isArray(conflict.employee) ? conflict.employee[0] : conflict.employee
    const project = Array.isArray(conflict.project) ? conflict.project[0] : conflict.project
    const client = project ? (Array.isArray(project.client) ? project.client[0] : project.client) : null

    return {
      hasConflict: true,
      conflictingAssignment: {
        ...conflict,
        employee,
        project: project ? { ...project, client } : null,
      } as AssignmentWithRelations,
      message: `Employee is already assigned to ${project?.name ?? 'another project'} from ${conflict.start_date} to ${conflict.end_date}`,
    }
  }

  return { hasConflict: false }
}
