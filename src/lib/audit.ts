import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import type { Json } from '@/types/database'

// Audit action types
export type AuditAction = 'create' | 'update' | 'delete' | 'send' | 'upload'

// Audit entity types
export type AuditEntity = 'user' | 'settings' | 'logo' | 'password_reset' | 'invoice' | 'expense' | 'project'

// Input for logging an audit event
export interface AuditLogInput {
  action: AuditAction
  entityType: AuditEntity
  entityId: string | null
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
}

/**
 * Log an audit event to the audit_logs table.
 * Captures the current user, IP address, and user agent automatically.
 * Silently fails to avoid breaking mutations if audit logging fails.
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const supabase = await createClient()
    const profile = await getProfile()

    // Get request metadata from headers
    const headersList = await headers()
    const forwardedFor = headersList.get('x-forwarded-for')
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || null
    const userAgent = headersList.get('user-agent') || null

    await supabase.from('audit_logs').insert({
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      user_id: profile?.id || null,
      ip_address: ipAddress,
      user_agent: userAgent,
      old_values: input.oldValues as Json || null,
      new_values: input.newValues as Json || null,
    })
  } catch (error) {
    // Silent fail - don't break the main operation if audit logging fails
    console.error('Audit logging failed:', error)
  }
}

/**
 * Helper to diff two objects and return only changed fields
 */
export function diffObjects(
  oldObj: Record<string, unknown> | null | undefined,
  newObj: Record<string, unknown> | null | undefined
): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const oldValues: Record<string, unknown> = {}
  const newValues: Record<string, unknown> = {}

  if (!oldObj || !newObj) {
    return { oldValues: oldObj || {}, newValues: newObj || {} }
  }

  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])

  for (const key of allKeys) {
    const oldVal = oldObj[key]
    const newVal = newObj[key]

    // Compare values (simple comparison, works for primitives)
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      oldValues[key] = oldVal
      newValues[key] = newVal
    }
  }

  return { oldValues, newValues }
}
