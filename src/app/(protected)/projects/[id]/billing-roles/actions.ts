'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { billingRoleSchema } from '@/lib/validations/project'

export async function createBillingRoleAction(projectId: string, formData: FormData) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'projects.edit')) {
    return { error: 'You do not have permission to manage billing roles' }
  }

  // Parse form data
  const rawData = {
    name: formData.get('name'),
    rate: formData.get('rate'),
  }

  // Validate
  const result = billingRoleSchema.safeParse(rawData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed' }
  }

  const data = result.data

  // Insert
  const { error } = await supabase.from('project_billing_roles').insert({
    project_id: projectId,
    name: data.name,
    rate: data.rate,
  })

  if (error) {
    console.error('Error creating billing role:', error)
    return { error: 'Failed to create billing role' }
  }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function updateBillingRoleAction(
  projectId: string,
  roleId: string,
  formData: FormData
) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'projects.edit')) {
    return { error: 'You do not have permission to manage billing roles' }
  }

  // Parse form data
  const rawData = {
    name: formData.get('name'),
    rate: formData.get('rate'),
  }

  // Validate
  const result = billingRoleSchema.safeParse(rawData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed' }
  }

  const data = result.data

  // Update
  const { error } = await supabase
    .from('project_billing_roles')
    .update({
      name: data.name,
      rate: data.rate,
    })
    .eq('id', roleId)
    .eq('project_id', projectId)

  if (error) {
    console.error('Error updating billing role:', error)
    return { error: 'Failed to update billing role' }
  }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function deleteBillingRoleAction(projectId: string, roleId: string) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'projects.edit')) {
    return { error: 'You do not have permission to manage billing roles' }
  }

  // Check if any team members use this role
  const { data: members } = await supabase
    .from('project_members')
    .select('id')
    .eq('billing_role_id', roleId)
    .limit(1)

  if (members && members.length > 0) {
    return { error: 'Cannot delete role that is assigned to team members' }
  }

  // Check if any timesheet entries use this role
  const { data: timesheets } = await supabase
    .from('timesheet_entries')
    .select('id')
    .eq('billing_role_id', roleId)
    .limit(1)

  if (timesheets && timesheets.length > 0) {
    return { error: 'Cannot delete role that is used in timesheet entries' }
  }

  const { error } = await supabase
    .from('project_billing_roles')
    .delete()
    .eq('id', roleId)
    .eq('project_id', projectId)

  if (error) {
    console.error('Error deleting billing role:', error)
    return { error: 'Failed to delete billing role' }
  }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}
