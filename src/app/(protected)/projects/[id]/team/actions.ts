'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserPermissions, hasPermission } from '@/lib/auth'

export async function addTeamMemberAction(
  projectId: string,
  userId: string,
  billingRoleId: string | null
) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'projects.edit')) {
    return { error: 'You do not have permission to manage team members' }
  }

  // Check if user is already a member
  const { data: existing } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single()

  if (existing) {
    return { error: 'User is already a team member' }
  }

  // Add member
  const { error } = await supabase.from('project_members').insert({
    project_id: projectId,
    user_id: userId,
    billing_role_id: billingRoleId || null,
    is_active: true,
  })

  if (error) {
    console.error('Error adding team member:', error)
    return { error: 'Failed to add team member' }
  }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function updateTeamMemberAction(
  projectId: string,
  memberId: string,
  billingRoleId: string | null
) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'projects.edit')) {
    return { error: 'You do not have permission to manage team members' }
  }

  // Update member
  const { error } = await supabase
    .from('project_members')
    .update({ billing_role_id: billingRoleId || null })
    .eq('id', memberId)
    .eq('project_id', projectId)

  if (error) {
    console.error('Error updating team member:', error)
    return { error: 'Failed to update team member' }
  }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function removeTeamMemberAction(projectId: string, memberId: string) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'projects.edit')) {
    return { error: 'You do not have permission to manage team members' }
  }

  // Delete member
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', memberId)
    .eq('project_id', projectId)

  if (error) {
    console.error('Error removing team member:', error)
    return { error: 'Failed to remove team member' }
  }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}
