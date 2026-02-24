'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { DollarSign, MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BillingRoleDialog } from './billing-role-dialog'
import { deleteBillingRoleAction } from '@/app/(protected)/projects/[id]/billing-roles/actions'

interface BillingRole {
  id: string
  name: string
  rate: number
  created_at: string | null
}

interface BillingRoleListProps {
  projectId: string
  billingRoles: BillingRole[]
  canEdit: boolean
}

export function BillingRoleList({ projectId, billingRoles, canEdit }: BillingRoleListProps) {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<BillingRole | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const roleToDelete = billingRoles.find((r) => r.id === deleteId)

  const handleEdit = (role: BillingRole) => {
    setEditingRole(role)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingRole(null)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteBillingRoleAction(projectId, deleteId)
      if (result?.error) {
        setDeleteError(result.error)
      } else {
        setDeleteId(null)
      }
    } catch {
      setDeleteError(tCommon('errors.unexpected'))
    } finally {
      setIsDeleting(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{t('billing_roles.title')} ({billingRoles.length})</h3>
          <p className="text-sm text-muted-foreground">
            {t('billing_roles.description')}
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {t('billing_roles.add_role')}
          </Button>
        )}
      </div>

      {/* Role List */}
      {billingRoles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <DollarSign className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">{t('billing_roles.no_roles')}</p>
            {canEdit && (
              <Button size="sm" variant="outline" className="mt-4" onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" />
                {t('billing_roles.add_first')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {billingRoles.map((role) => (
            <Card key={role.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                    <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="font-medium">{role.name}</div>
                    <p className="text-sm text-muted-foreground">
                      {t('billing_roles.per_hour', { rate: formatCurrency(role.rate) })}
                    </p>
                  </div>
                </div>
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">{tCommon('labels.actions')}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(role)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {tCommon('actions.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteId(role.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {tCommon('actions.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Billing Role Dialog */}
      <BillingRoleDialog
        projectId={projectId}
        role={editingRole}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => { setDeleteId(null); setDeleteError(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('billing_roles.delete_title')}</DialogTitle>
            <DialogDescription>
              {t('billing_roles.delete_message', { name: roleToDelete?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteId(null); setDeleteError(null); }} disabled={isDeleting}>
              {tCommon('actions.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? tCommon('actions.deleting') : tCommon('actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
