'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { taskSchema } from '@/lib/validations/project'

export async function createTaskAction(projectId: string, formData: FormData) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'projects.edit')) {
    return { error: 'You do not have permission to manage tasks' }
  }

  // Parse form data
  const rawData = {
    name: formData.get('name'),
    description: formData.get('description'),
  }

  // Validate
  const result = taskSchema.safeParse(rawData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed' }
  }

  const data = result.data

  // Get current max task number for this project to generate code
  const { data: existingTasks } = await supabase
    .from('project_tasks')
    .select('code')
    .eq('project_id', projectId)
    .order('code', { ascending: false })
    .limit(1)

  let nextNumber = 1
  if (existingTasks && existingTasks.length > 0) {
    const lastCode = existingTasks[0].code
    const match = lastCode.match(/T(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1
    }
  }

  const code = `T${String(nextNumber).padStart(3, '0')}`

  // Get max sort_order
  const { data: maxOrder } = await supabase
    .from('project_tasks')
    .select('sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const sortOrder = (maxOrder?.[0]?.sort_order ?? 0) + 1

  // Insert
  const { error } = await supabase.from('project_tasks').insert({
    project_id: projectId,
    code,
    name: data.name,
    description: data.description || null,
    sort_order: sortOrder,
  })

  if (error) {
    console.error('Error creating task:', error)
    return { error: 'Failed to create task' }
  }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function updateTaskAction(projectId: string, taskId: string, formData: FormData) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'projects.edit')) {
    return { error: 'You do not have permission to manage tasks' }
  }

  // Parse form data
  const rawData = {
    name: formData.get('name'),
    description: formData.get('description'),
  }

  // Validate
  const result = taskSchema.safeParse(rawData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed' }
  }

  const data = result.data

  // Update
  const { error } = await supabase
    .from('project_tasks')
    .update({
      name: data.name,
      description: data.description || null,
    })
    .eq('id', taskId)
    .eq('project_id', projectId)

  if (error) {
    console.error('Error updating task:', error)
    return { error: 'Failed to update task' }
  }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

export async function deleteTaskAction(projectId: string, taskId: string) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'projects.edit')) {
    return { error: 'You do not have permission to manage tasks' }
  }

  const { error } = await supabase
    .from('project_tasks')
    .delete()
    .eq('id', taskId)
    .eq('project_id', projectId)

  if (error) {
    console.error('Error deleting task:', error)
    return { error: 'Failed to delete task' }
  }

  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}
