'use server'

import { advanceClassification as advanceClassificationCore } from '@/lib/billing/progression'
import { getUserPermissions, hasPermission } from '@/lib/auth'

export async function advanceEmployeeClassification(params: {
  personId: string
  newClassificationId: string
  effectiveDate: string
  notes?: string
}): Promise<{ success?: boolean; error?: string }> {
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'Permission denied' }
  }

  try {
    await advanceClassificationCore(params)
    return { success: true }
  } catch (e) {
    console.error('Error advancing classification:', e)
    return { error: 'Failed to advance classification' }
  }
}
