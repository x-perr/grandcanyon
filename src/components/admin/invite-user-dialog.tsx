'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, UserPlus, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { createInvitation } from '@/app/(protected)/admin/actions'

interface InviteUserDialogProps {
  roles: { id: string; name: string }[]
  trigger?: React.ReactNode
}

export function InviteUserDialog({ roles, trigger }: InviteUserDialogProps) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Form state
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState<string>('')

  const resetForm = () => {
    setEmail('')
    setRoleId('')
    setError(null)
    setInviteUrl(null)
    setCopied(false)
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      resetForm()
    }
  }

  const handleCopyLink = async () => {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    toast.success(t('invitations.toast.copied'))
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    try {
      const result = await createInvitation({
        email,
        role_id: roleId || null,
      })

      if (result.error) {
        setError(result.error)
      } else {
        toast.success(t('invitations.toast.created'))
        if (result.inviteUrl) {
          setInviteUrl(result.inviteUrl)
        }
      }
    } catch {
      setError(tCommon('errors.generic'))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            {t('invitations.invite_user')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {inviteUrl ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('invitations.invite_sent_title')}</DialogTitle>
              <DialogDescription>{t('invitations.invite_sent_desc')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('invitations.invite_link')}</Label>
                <div className="flex gap-2">
                  <Input value={inviteUrl} readOnly className="font-mono text-sm" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('invitations.link_expires')}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => resetForm()} variant="outline">
                {t('invitations.invite_another')}
              </Button>
              <Button onClick={() => handleOpenChange(false)}>
                {tCommon('actions.done')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{t('invitations.dialog_title')}</DialogTitle>
              <DialogDescription>{t('invitations.dialog_desc')}</DialogDescription>
            </DialogHeader>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('invitations.email')} *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">{t('invitations.role')}</Label>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('invitations.select_role')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{tCommon('labels.none')}</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('invitations.role_help')}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                {tCommon('actions.cancel')}
              </Button>
              <Button type="submit" disabled={isPending || !email}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('invitations.send_invitation')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
