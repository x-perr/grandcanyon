'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { projectSchema } from '@/lib/validations/project'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import type { Enums } from '@/types/database'

type ProjectStatus = Enums<'project_status'>

export type ProjectWithClient = {
  id: string
  code: string
  name: string
  status: ProjectStatus | null
  is_active: boolean | null
  client_id: string
  start_date: string | null
  end_date: string | null
  created_at: string | null
  deleted_at: string | null
  client: {
    id: string
    code: string
    name: string
  } | null
  project_manager: {
    id: string
    first_name: string
    last_name: string
  } | null
}

export type SortColumn = 'code' | 'name' | 'status' | 'start_date' | 'created_at' | 'client_name'
export type SortDirection = 'asc' | 'desc'

export async function getProjects(options?: {
  search?: string
  status?: string
  clientId?: string
  managerId?: string
  showDeleted?: boolean
  showInactive?: boolean
  limit?: number
  offset?: number
  sortColumn?: SortColumn
  sortDirection?: SortDirection
}): Promise<{ projects: ProjectWithClient[]; count: number }> {
  const supabase = await createClient()
  const {
    search,
    status,
    clientId,
    managerId,
    showDeleted = false,
    showInactive = false,
    limit = 25,
    offset = 0,
    sortColumn = 'created_at',
    sortDirection = 'desc',
  } = options ?? {}

  let query = supabase
    .from('projects')
    .select(
      `
      id,
      code,
      name,
      status,
      is_active,
      client_id,
      start_date,
      end_date,
      created_at,
      deleted_at,
      client:clients!projects_client_id_fkey(id, code, name),
      project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name)
    `,
      { count: 'exact' }
    )

  // Filter deleted unless requested
  if (!showDeleted) {
    query = query.is('deleted_at', null)
  }

  // Filter inactive unless requested
  if (!showInactive) {
    query = query.eq('is_active', true)
  }

  // Search filter
  if (search) {
    query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`)
  }

  // Status filter
  if (status) {
    query = query.eq('status', status)
  }

  // Client filter
  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  // Manager filter
  if (managerId) {
    query = query.eq('project_manager_id', managerId)
  }

  // Sorting & pagination
  if (sortColumn === 'client_name') {
    // Sort by client name using foreign table ordering
    query = query.order('name', {
      ascending: sortDirection === 'asc',
      referencedTable: 'clients',
    })
  } else {
    query = query.order(sortColumn, { ascending: sortDirection === 'asc' })
  }
  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching projects:', error)
    return { projects: [], count: 0 }
  }

  // Transform data to handle Supabase's array response for joins
  const projects = (data ?? []).map((project) => ({
    ...project,
    client: Array.isArray(project.client) ? project.client[0] ?? null : project.client,
    project_manager: Array.isArray(project.project_manager)
      ? project.project_manager[0] ?? null
      : project.project_manager,
  })) as ProjectWithClient[]

  return { projects, count: count ?? 0 }
}

export async function getProject(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projects')
    .select(
      `
      *,
      client:clients!projects_client_id_fkey(id, code, name, charges_gst, charges_qst),
      project_manager:profiles!projects_project_manager_id_fkey(id, first_name, last_name, email),
      members:project_members(
        id,
        is_active,
        created_at,
        user:profiles!project_members_user_id_fkey(id, first_name, last_name, email),
        billing_role:project_billing_roles!project_members_billing_role_id_fkey(id, name, rate)
      ),
      tasks:project_tasks(id, code, name, description, sort_order, start_date, end_date),
      billing_roles:project_billing_roles!project_billing_roles_project_id_fkey(id, name, rate, created_at)
    `
    )
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching project:', error)
    return null
  }

  return data
}

export async function getClientsForSelect() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('clients')
    .select('id, code, name, next_project_number')
    .is('deleted_at', null)
    .order('name')

  if (error) {
    console.error('Error fetching clients:', error)
    return []
  }

  return data
}

export async function getUsersForSelect() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .eq('is_active', true)
    .order('first_name')

  if (error) {
    console.error('Error fetching users:', error)
    return []
  }

  return data
}

export async function createProjectAction(formData: FormData) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'projects.edit')) {
    return { error: 'You do not have permission to create projects' }
  }

  // Parse form data
  const rawData = Object.fromEntries(formData.entries())

  // Handle checkboxes
  const formValues = {
    ...rawData,
    is_global: formData.get('is_global') === 'on',
  }

  // Validate
  const result = projectSchema.safeParse(formValues)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed' }
  }

  const data = result.data

  // Get client for code generation
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('code, next_project_number')
    .eq('id', data.client_id)
    .single()

  if (clientError || !client) {
    return { error: 'Invalid client selected' }
  }

  // Generate project code
  const code = `${client.code}-${String(client.next_project_number ?? 1).padStart(3, '0')}`

  // Get current user for created_by
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Insert project
  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      code,
      client_id: data.client_id,
      name: data.name,
      description: data.description || null,
      status: data.status,
      billing_type: data.billing_type,
      hourly_rate: data.hourly_rate || null,
      fixed_price: data.fixed_price || null,
      per_unit_rate: data.per_unit_rate || null,
      project_manager_id: data.project_manager_id || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      is_global: data.is_global,
      address: data.address || null,
      po_number: data.po_number || null,
      work_type: data.work_type || null,
      created_by: user?.id,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating project:', error)
    return { error: 'Failed to create project' }
  }

  // Increment client's next_project_number
  await supabase
    .from('clients')
    .update({ next_project_number: (client.next_project_number ?? 1) + 1 })
    .eq('id', data.client_id)

  revalidatePath('/projects')
  revalidatePath(`/clients/${data.client_id}`)
  redirect(`/projects/${project.id}`)
}

export async function updateProjectAction(id: string, formData: FormData) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'projects.edit')) {
    return { error: 'You do not have permission to edit projects' }
  }

  // Parse form data
  const rawData = Object.fromEntries(formData.entries())

  const formValues = {
    ...rawData,
    is_global: formData.get('is_global') === 'on',
  }

  // Validate
  const result = projectSchema.safeParse(formValues)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed' }
  }

  const data = result.data

  // Get current project to check if client changed (shouldn't happen but just in case)
  const { data: currentProject } = await supabase.from('projects').select('client_id').eq('id', id).single()

  // Update project (don't update code - it's auto-generated)
  const { error } = await supabase
    .from('projects')
    .update({
      name: data.name,
      description: data.description || null,
      status: data.status,
      billing_type: data.billing_type,
      hourly_rate: data.hourly_rate || null,
      fixed_price: data.fixed_price || null,
      per_unit_rate: data.per_unit_rate || null,
      project_manager_id: data.project_manager_id || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      is_global: data.is_global,
      address: data.address || null,
      po_number: data.po_number || null,
      work_type: data.work_type || null,
    })
    .eq('id', id)

  if (error) {
    console.error('Error updating project:', error)
    return { error: 'Failed to update project' }
  }

  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  if (currentProject) {
    revalidatePath(`/clients/${currentProject.client_id}`)
  }
  redirect(`/projects/${id}`)
}

export async function deleteProjectAction(id: string) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'projects.edit')) {
    return { error: 'You do not have permission to delete projects' }
  }

  // Get project for client revalidation
  const { data: project } = await supabase.from('projects').select('client_id').eq('id', id).single()

  // Soft delete
  const { error } = await supabase
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error deleting project:', error)
    return { error: 'Failed to delete project' }
  }

  revalidatePath('/projects')
  if (project) {
    revalidatePath(`/clients/${project.client_id}`)
  }
  redirect('/projects')
}

/**
 * Toggle project active status
 */
export async function toggleProjectActive(id: string) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'projects.edit')) {
    return { error: 'You do not have permission to update projects' }
  }

  // Get current status
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('is_active, client_id')
    .eq('id', id)
    .single()

  if (fetchError || !project) {
    return { error: 'Project not found' }
  }

  const newStatus = !project.is_active

  // Toggle
  const { error } = await supabase
    .from('projects')
    .update({ is_active: newStatus })
    .eq('id', id)

  if (error) {
    console.error('Error toggling project status:', error)
    return { error: 'Failed to update project status' }
  }

  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  if (project.client_id) {
    revalidatePath(`/clients/${project.client_id}`)
  }

  return { success: true, is_active: newStatus }
}
