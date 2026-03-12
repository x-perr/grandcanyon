'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import type { InvitationStatus, InvitationWithRelations, InvitationQueryResult } from './types'
import { normalizeInvitation } from './types'

/**
 * Get all invitations with optional filters
 */
export async function getInvitations(options?: {
  status?: InvitationStatus
  search?: string
  limit?: number
  offset?: number
}): Promise<{ invitations: InvitationWithRelations[]; count: number }> {
  const supabase = await createClient()
  const { status, search, limit = 25, offset = 0 } = options ?? {}

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { invitations: [], count: 0 }
  }

  let query = supabase
    .from('user_invitations')
    .select(
      `
      id,
      email,
      token,
      status,
      expires_at,
      accepted_at,
      created_at,
      role:roles(id, name),
      invited_by_user:profiles!user_invitations_invited_by_fkey(id, first_name, last_name),
      accepted_by_user:profiles!user_invitations_accepted_by_fkey(id, first_name, last_name)
    `,
      { count: 'exact' }
    )

  // Filter by status
  if (status) {
    query = query.eq('status', status)
  }

  // Search by email
  if (search) {
    query = query.ilike('email', `%${search}%`)
  }

  // Pagination & order (most recent first)
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching invitations:', error)
    return { invitations: [], count: 0 }
  }

  const invitations = (data as InvitationQueryResult[]).map(normalizeInvitation)
  return { invitations, count: count ?? 0 }
}

/**
 * Generate a secure random token for invitation
 */
function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Create a new user invitation
 */
export async function createInvitation(data: {
  email: string
  role_id?: string | null
  expires_in_days?: number
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to invite users' }
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(data.email)) {
    return { error: 'Invalid email format' }
  }

  // Check if email already has a pending invitation
  const { data: existingInvitation } = await supabase
    .from('user_invitations')
    .select('id')
    .eq('email', data.email.toLowerCase())
    .eq('status', 'pending')
    .single()

  if (existingInvitation) {
    return { error: 'A pending invitation already exists for this email' }
  }

  // Check if user already exists with this email
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', data.email.toLowerCase())
    .single()

  if (existingUser) {
    return { error: 'A user with this email already exists' }
  }

  // Generate token and expiry date
  const token = generateToken()
  const expiresInDays = data.expires_in_days ?? 7
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)

  // Create invitation
  const { data: invitation, error } = await supabase
    .from('user_invitations')
    .insert({
      email: data.email.toLowerCase(),
      token,
      role_id: data.role_id || null,
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
    })
    .select('id, email, token')
    .single()

  if (error) {
    console.error('Error creating invitation:', error)
    return { error: 'Failed to create invitation' }
  }

  // Log audit
  await logAudit({
    action: 'create',
    entityType: 'invitation',
    entityId: invitation.id,
    newValues: { email: data.email, role_id: data.role_id },
  })

  revalidatePath('/admin/users')

  // Return the invitation URL
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invite?token=${token}`

  return { success: true, invitation, inviteUrl }
}

/**
 * Resend an invitation (generates new token and extends expiry)
 */
export async function resendInvitation(invitationId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to resend invitations' }
  }

  // Get existing invitation
  const { data: existing, error: fetchError } = await supabase
    .from('user_invitations')
    .select('id, email, status')
    .eq('id', invitationId)
    .single()

  if (fetchError || !existing) {
    return { error: 'Invitation not found' }
  }

  if (existing.status !== 'pending' && existing.status !== 'expired') {
    return { error: 'Can only resend pending or expired invitations' }
  }

  // Generate new token and extend expiry
  const token = generateToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const { error } = await supabase
    .from('user_invitations')
    .update({
      token,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .eq('id', invitationId)

  if (error) {
    console.error('Error resending invitation:', error)
    return { error: 'Failed to resend invitation' }
  }

  // Log audit
  await logAudit({
    action: 'resend',
    entityType: 'invitation',
    entityId: invitationId,
    newValues: { email: existing.email },
  })

  revalidatePath('/admin/users')

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invite?token=${token}`

  return { success: true, inviteUrl }
}

/**
 * Revoke a pending invitation
 */
export async function revokeInvitation(invitationId: string) {
  const supabase = await createClient()

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to revoke invitations' }
  }

  // Get existing invitation
  const { data: existing, error: fetchError } = await supabase
    .from('user_invitations')
    .select('id, email, status')
    .eq('id', invitationId)
    .single()

  if (fetchError || !existing) {
    return { error: 'Invitation not found' }
  }

  if (existing.status !== 'pending') {
    return { error: 'Can only revoke pending invitations' }
  }

  const { error } = await supabase
    .from('user_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)

  if (error) {
    console.error('Error revoking invitation:', error)
    return { error: 'Failed to revoke invitation' }
  }

  // Log audit
  await logAudit({
    action: 'revoke',
    entityType: 'invitation',
    entityId: invitationId,
    oldValues: { status: 'pending' },
    newValues: { status: 'revoked', email: existing.email },
  })

  revalidatePath('/admin/users')

  return { success: true }
}

/**
 * Validate an invitation token (used during signup)
 */
export async function validateInvitationToken(token: string) {
  const supabase = await createClient()

  const { data: invitation, error } = await supabase
    .from('user_invitations')
    .select(`
      id,
      email,
      status,
      expires_at,
      role:roles(id, name)
    `)
    .eq('token', token)
    .single()

  if (error || !invitation) {
    return { valid: false, error: 'Invalid invitation token' }
  }

  if (invitation.status !== 'pending') {
    return { valid: false, error: 'This invitation has already been used or revoked' }
  }

  if (new Date(invitation.expires_at) < new Date()) {
    // Mark as expired
    await supabase
      .from('user_invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id)

    return { valid: false, error: 'This invitation has expired' }
  }

  const role = Array.isArray(invitation.role) ? invitation.role[0] : invitation.role

  return {
    valid: true,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: role ?? null,
    },
  }
}

/**
 * Accept an invitation (called after user creates account)
 */
export async function acceptInvitation(token: string, userId: string) {
  const supabase = await createClient()

  // Validate the token first
  const validation = await validateInvitationToken(token)
  if (!validation.valid) {
    return { error: validation.error }
  }

  // Get invitation details
  const { data: invitation, error: fetchError } = await supabase
    .from('user_invitations')
    .select('id, email, role_id')
    .eq('token', token)
    .single()

  if (fetchError || !invitation) {
    return { error: 'Invitation not found' }
  }

  // Update invitation status
  const { error: updateError } = await supabase
    .from('user_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq('id', invitation.id)

  if (updateError) {
    console.error('Error accepting invitation:', updateError)
    return { error: 'Failed to accept invitation' }
  }

  // If a role was specified, update the user's profile
  if (invitation.role_id) {
    await supabase
      .from('profiles')
      .update({ role_id: invitation.role_id })
      .eq('id', userId)
  }

  // Log audit
  await logAudit({
    action: 'accept',
    entityType: 'invitation',
    entityId: invitation.id,
    newValues: { accepted_by: userId },
  })

  return { success: true }
}
