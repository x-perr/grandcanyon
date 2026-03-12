'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import type { AuditLogQueryResult, AuditLogWithUser } from './types'
import { normalizeAuditLog } from './types'

/**
 * Get audit logs with optional filters
 */
export async function getAuditLogs(options?: {
  action?: string
  entityType?: string
  userId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<{ logs: AuditLogWithUser[]; count: number }> {
  const supabase = await createClient()
  const { action, entityType, userId, dateFrom, dateTo, search, limit = 25, offset = 0 } = options ?? {}

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { logs: [], count: 0 }
  }

  let query = supabase
    .from('audit_logs')
    .select(
      `
      id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      ip_address,
      user_agent,
      created_at,
      user_id,
      user:profiles!audit_logs_user_id_fkey(id, first_name, last_name, email)
    `,
      { count: 'exact' }
    )

  // Filter by action
  if (action) {
    query = query.eq('action', action)
  }

  // Filter by entity type
  if (entityType) {
    query = query.eq('entity_type', entityType)
  }

  // Filter by user who performed the action
  if (userId) {
    query = query.eq('user_id', userId)
  }

  // Date range filters
  if (dateFrom) {
    query = query.gte('created_at', dateFrom)
  }
  if (dateTo) {
    // Add 1 day to include the entire end date
    const endDate = new Date(dateTo)
    endDate.setDate(endDate.getDate() + 1)
    query = query.lt('created_at', endDate.toISOString())
  }

  // Search in entity_id
  if (search) {
    query = query.ilike('entity_id', `%${search}%`)
  }

  // Pagination & order (most recent first)
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching audit logs:', error)
    return { logs: [], count: 0 }
  }

  const logs = (data as AuditLogQueryResult[]).map(normalizeAuditLog)
  return { logs, count: count ?? 0 }
}

/**
 * Get list of users who have performed audited actions (for filter dropdown)
 */
export async function getAuditLogUsers(): Promise<{ id: string; first_name: string; last_name: string; email: string }[]> {
  const supabase = await createClient()

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return []
  }

  // Get distinct user IDs from audit logs (limited to prevent unbounded queries)
  const { data: auditUsers, error: auditError } = await supabase
    .from('audit_logs')
    .select('user_id')
    .not('user_id', 'is', null)
    .limit(10000)

  if (auditError || !auditUsers) {
    console.error('Error fetching audit log users:', auditError)
    return []
  }

  // Get unique user IDs
  const userIds = [...new Set(auditUsers.map(a => a.user_id).filter(Boolean))]

  if (userIds.length === 0) {
    return []
  }

  // Fetch user details
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .in('id', userIds)
    .order('last_name')
    .order('first_name')

  if (error) {
    console.error('Error fetching users:', error)
    return []
  }

  return users ?? []
}
