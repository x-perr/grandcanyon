'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import type { RoleWithPermissions } from './types'

/**
 * Get all roles
 */
export async function getRoles(): Promise<{ id: string; name: string; description: string | null }[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('roles')
    .select('id, name, description')
    .order('name')

  if (error) {
    console.error('Error fetching roles:', error)
    return []
  }

  return data ?? []
}

/**
 * Get all roles with their permissions
 */
export async function getRolesWithPermissions(): Promise<RoleWithPermissions[]> {
  const supabase = await createClient()

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return []
  }

  // Get roles
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id, name, description')
    .order('name')

  if (rolesError || !roles) {
    console.error('Error fetching roles:', rolesError)
    return []
  }

  // Get all permissions
  const { data: allPermissions, error: permError } = await supabase
    .from('permissions')
    .select('id, code, description, category')
    .order('category')
    .order('code')

  if (permError) {
    console.error('Error fetching permissions:', permError)
    return []
  }

  // Get role_permissions mappings
  const { data: rolePermissions, error: rpError } = await supabase
    .from('role_permissions')
    .select('role_id, permission_id')

  if (rpError) {
    console.error('Error fetching role_permissions:', rpError)
    return []
  }

  // Build result
  const result: RoleWithPermissions[] = roles.map((role) => {
    const permissionIds = rolePermissions
      ?.filter((rp) => rp.role_id === role.id)
      .map((rp) => rp.permission_id) ?? []

    const permissions = allPermissions
      ?.filter((p) => permissionIds.includes(p.id)) ?? []

    return {
      ...role,
      permissions,
    }
  })

  return result
}

/**
 * Get all permissions grouped by category
 */
export async function getPermissionsByCategory(): Promise<
  Record<string, { id: string; code: string; description: string | null }[]>
> {
  const supabase = await createClient()

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return {}
  }

  const { data, error } = await supabase
    .from('permissions')
    .select('id, code, description, category')
    .order('category')
    .order('code')

  if (error) {
    console.error('Error fetching permissions:', error)
    return {}
  }

  // Group by category
  const grouped: Record<string, { id: string; code: string; description: string | null }[]> = {}
  for (const perm of data ?? []) {
    const category = perm.category ?? 'Other'
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push({
      id: perm.id,
      code: perm.code,
      description: perm.description,
    })
  }

  return grouped
}

/**
 * Toggle a permission for a role
 */
export async function toggleRolePermission(roleId: string, permissionId: string) {
  const supabase = await createClient()

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to modify role permissions' }
  }

  // Check if the permission currently exists for this role
  const { data: existing, error: checkError } = await supabase
    .from('role_permissions')
    .select('id')
    .eq('role_id', roleId)
    .eq('permission_id', permissionId)
    .single()

  if (checkError && checkError.code !== 'PGRST116') {
    console.error('Error checking role permission:', checkError)
    return { error: 'Failed to check permission status' }
  }

  // Get role and permission names for audit log
  const [{ data: role }, { data: permission }] = await Promise.all([
    supabase.from('roles').select('name').eq('id', roleId).single(),
    supabase.from('permissions').select('code').eq('id', permissionId).single(),
  ])

  if (existing) {
    // Remove the permission
    const { error } = await supabase
      .from('role_permissions')
      .delete()
      .eq('id', existing.id)

    if (error) {
      console.error('Error removing role permission:', error)
      return { error: 'Failed to remove permission' }
    }

    // Log audit
    await logAudit({
      action: 'delete',
      entityType: 'role_permission',
      entityId: roleId,
      oldValues: { role: role?.name, permission: permission?.code },
    })

    revalidatePath('/admin/roles')
    return { success: true, added: false }
  } else {
    // Add the permission
    const { error } = await supabase.from('role_permissions').insert({
      role_id: roleId,
      permission_id: permissionId,
    })

    if (error) {
      console.error('Error adding role permission:', error)
      return { error: 'Failed to add permission' }
    }

    // Log audit
    await logAudit({
      action: 'create',
      entityType: 'role_permission',
      entityId: roleId,
      newValues: { role: role?.name, permission: permission?.code },
    })

    revalidatePath('/admin/roles')
    return { success: true, added: true }
  }
}
