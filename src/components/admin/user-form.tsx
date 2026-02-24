'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, Key, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { UserWithRole } from '@/app/(protected)/admin/actions'
import { updateUser, sendPasswordReset } from '@/app/(protected)/admin/actions'

interface UserFormProps {
  user: UserWithRole
  roles: { id: string; name: string; description: string | null }[]
  potentialManagers: UserWithRole[]
}

type FormState = { error?: string } | void

export function UserForm({ user, roles, potentialManagers }: UserFormProps) {
  const router = useRouter()
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_, formData) => {
      const result = await updateUser(user.id, formData)
      if (result.error) {
        return result
      }
      toast.success(t('users.save_success'))
      router.push('/admin/users')
      return undefined
    },
    undefined
  )

  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, startResetTransition] = useTransition()

  const handleSendPasswordReset = () => {
    startResetTransition(async () => {
      const result = await sendPasswordReset(user.email)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('users.password_reset_sent', { email: user.email }))
      }
      setShowResetDialog(false)
    })
  }

  return (
    <form action={formAction} className="space-y-6">
      {/* Error display */}
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t('users.user_info')}</CardTitle>
          <CardDescription>{t('users.user_info_description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first_name">{t('users.first_name')} *</Label>
            <Input
              id="first_name"
              name="first_name"
              defaultValue={user.first_name}
              required
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="last_name">{t('users.last_name')} *</Label>
            <Input
              id="last_name"
              name="last_name"
              defaultValue={user.last_name}
              required
              maxLength={50}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="email">{tCommon('labels.email')}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="email"
                type="email"
                value={user.email}
                disabled
                className="bg-muted"
              />
              <Badge variant="secondary">{t('users.managed_by_auth')}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('users.email_readonly')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{tCommon('labels.phone')}</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={user.phone ?? ''}
              maxLength={20}
            />
          </div>
        </CardContent>
      </Card>

      {/* Role & Manager */}
      <Card>
        <CardHeader>
          <CardTitle>{t('users.role_assignment')}</CardTitle>
          <CardDescription>{t('users.role_assignment_description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="role_id">{t('users.role')}</Label>
            <Select name="role_id" defaultValue={user.role_id ?? ''}>
              <SelectTrigger>
                <SelectValue placeholder={t('users.select_role')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('users.no_role')}</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager_id">{t('users.manager')}</Label>
            <Select name="manager_id" defaultValue={user.manager_id ?? ''}>
              <SelectTrigger>
                <SelectValue placeholder={t('users.select_manager')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('users.no_manager')}</SelectItem>
                {potentialManagers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.first_name} {manager.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Account Status */}
      <Card>
        <CardHeader>
          <CardTitle>{t('users.account_status')}</CardTitle>
          <CardDescription>{t('users.account_status_description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              name="is_active"
              defaultChecked={user.is_active ?? true}
            />
            <Label htmlFor="is_active" className="font-normal">
              {t('users.is_active_label')}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('users.is_active_description')}
          </p>

          <div className="pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowResetDialog(true)}
            >
              <Key className="mr-2 h-4 w-4" />
              {t('users.send_password_reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/users')}
          disabled={isPending}
        >
          {tCommon('actions.cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tCommon('actions.save_changes')}
        </Button>
      </div>

      {/* Password Reset Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.password_reset_title')}</DialogTitle>
            <DialogDescription>
              {t('users.password_reset_message', { email: user.email })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(false)}
              disabled={isResetting}
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={handleSendPasswordReset} disabled={isResetting}>
              <Mail className="mr-2 h-4 w-4" />
              {isResetting ? tCommon('actions.loading') : t('users.send_email')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
