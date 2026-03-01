'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  MoreHorizontal,
  Send,
  X,
  Copy,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { resendInvitation, revokeInvitation } from '@/app/(protected)/admin/actions'
import type { InvitationWithRelations, InvitationStatus } from '@/app/(protected)/admin/actions'

interface InvitationListProps {
  invitations: InvitationWithRelations[]
  totalCount: number
  currentPage: number
  pageSize: number
}

const statusConfig: Record<
  InvitationStatus,
  { icon: typeof CheckCircle2; color: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { icon: Clock, color: 'text-amber-500', variant: 'outline' },
  accepted: { icon: CheckCircle2, color: 'text-green-500', variant: 'default' },
  expired: { icon: AlertCircle, color: 'text-muted-foreground', variant: 'secondary' },
  revoked: { icon: XCircle, color: 'text-destructive', variant: 'destructive' },
}

export function InvitationList({
  invitations,
  totalCount,
  currentPage,
  pageSize,
}: InvitationListProps) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, setIsPending] = useState(false)
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [selectedInvitation, setSelectedInvitation] = useState<InvitationWithRelations | null>(null)

  const totalPages = Math.ceil(totalCount / pageSize)

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(name, value)
      return params.toString()
    },
    [searchParams]
  )

  const handlePageChange = (page: number) => {
    router.push(`/admin/users?tab=invitations&${createQueryString('invPage', page.toString())}`)
  }

  const handleResend = async (invitation: InvitationWithRelations) => {
    setIsPending(true)
    try {
      const result = await resendInvitation(invitation.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('invitations.toast.resent'))
        if (result.inviteUrl) {
          await navigator.clipboard.writeText(result.inviteUrl)
          toast.success(t('invitations.toast.copied'))
        }
      }
    } catch {
      toast.error(tCommon('errors.generic'))
    } finally {
      setIsPending(false)
    }
  }

  const handleCopyLink = async (invitation: InvitationWithRelations) => {
    const inviteUrl = `${window.location.origin}/auth/accept-invite?token=${invitation.token}`
    await navigator.clipboard.writeText(inviteUrl)
    toast.success(t('invitations.toast.copied'))
  }

  const handleRevoke = async () => {
    if (!selectedInvitation) return
    setIsPending(true)
    try {
      const result = await revokeInvitation(selectedInvitation.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('invitations.toast.revoked'))
      }
    } catch {
      toast.error(tCommon('errors.generic'))
    } finally {
      setIsPending(false)
      setRevokeDialogOpen(false)
      setSelectedInvitation(null)
    }
  }

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date()

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('invitations.email')}</TableHead>
              <TableHead>{t('invitations.role')}</TableHead>
              <TableHead>{t('invitations.status')}</TableHead>
              <TableHead>{t('invitations.invited_by')}</TableHead>
              <TableHead>{t('invitations.expires')}</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {t('invitations.no_invitations')}
                </TableCell>
              </TableRow>
            ) : (
              invitations.map((invitation) => {
                const status = statusConfig[invitation.status]
                const StatusIcon = status.icon
                const expired = invitation.status === 'pending' && isExpired(invitation.expires_at)

                return (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      {invitation.role?.name ?? (
                        <span className="text-muted-foreground">{tCommon('labels.none')}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={expired ? 'secondary' : status.variant} className="gap-1">
                        <StatusIcon className={`h-3 w-3 ${expired ? 'text-muted-foreground' : status.color}`} />
                        {expired ? t('invitations.status_expired') : t(`invitations.status_${invitation.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invitation.invited_by_user
                        ? `${invitation.invited_by_user.first_name} ${invitation.invited_by_user.last_name}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {invitation.status === 'pending' ? (
                        <span className={expired ? 'text-destructive' : ''}>
                          {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}
                        </span>
                      ) : invitation.status === 'accepted' && invitation.accepted_at ? (
                        <span className="text-muted-foreground">
                          {t('invitations.accepted_at', {
                            date: formatDistanceToNow(new Date(invitation.accepted_at), { addSuffix: true }),
                          })}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {(invitation.status === 'pending' || invitation.status === 'expired') && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isPending}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {invitation.status === 'pending' && !expired && (
                              <DropdownMenuItem onClick={() => handleCopyLink(invitation)}>
                                <Copy className="mr-2 h-4 w-4" />
                                {t('invitations.copy_link')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleResend(invitation)}>
                              <Send className="mr-2 h-4 w-4" />
                              {t('invitations.resend')}
                            </DropdownMenuItem>
                            {invitation.status === 'pending' && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedInvitation(invitation)
                                  setRevokeDialogOpen(true)
                                }}
                              >
                                <X className="mr-2 h-4 w-4" />
                                {t('invitations.revoke')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {t('invitations.showing', {
              start: (currentPage - 1) * pageSize + 1,
              end: Math.min(currentPage * pageSize, totalCount),
              total: totalCount,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              {tCommon('pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              {tCommon('pagination.next')}
            </Button>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('invitations.revoke_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('invitations.revoke_message', { email: selectedInvitation?.email ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{tCommon('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('invitations.revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
