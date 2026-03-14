'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  createRateTier,
  updateRateTier,
  deleteRateTier,
} from '@/app/(protected)/admin/rate-tiers/actions'
import { RateTierLinesTable } from './rate-tier-lines-table'
import type { RateTier, RateTierLine, ClientRateTier, CcqClassification } from '@/types/billing'

interface RateTiersClientProps {
  tiers: RateTier[]
  clientTiers: ClientRateTier[]
  classifications: CcqClassification[]
}

export function RateTiersClient({
  tiers,
  clientTiers,
  classifications,
}: RateTiersClientProps) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const [expandedTierId, setExpandedTierId] = useState<string | null>(null)
  const [editingTier, setEditingTier] = useState<RateTier | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deletingTierId, setDeletingTierId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const toggleExpand = (tierId: string) => {
    setExpandedTierId((prev) => (prev === tierId ? null : tierId))
  }

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createRateTier(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('billing.tierCreated'))
        setIsCreateOpen(false)
      }
    })
  }

  const handleUpdate = (formData: FormData) => {
    if (!editingTier) return
    startTransition(async () => {
      const result = await updateRateTier(editingTier.id, formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('billing.tierUpdated'))
        setEditingTier(null)
      }
    })
  }

  const handleDelete = () => {
    if (!deletingTierId) return
    startTransition(async () => {
      const result = await deleteRateTier(deletingTierId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('billing.tierDeleted'))
        setDeletingTierId(null)
      }
    })
  }

  const getClientCountForTier = (tierId: string) => {
    return clientTiers.filter((ct) => ct.tier_id === tierId).length
  }

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex justify-end">
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('billing.addTier')}
        </Button>
      </div>

      {/* Tiers Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('billing.rateTiers')}</CardTitle>
          <CardDescription>{t('billing.rateTiersDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {tiers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t('billing.noTiers')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>{t('billing.tierName')}</TableHead>
                  <TableHead>{t('billing.tierCode')}</TableHead>
                  <TableHead>{t('billing.tierDescription')}</TableHead>
                  <TableHead className="text-center">{t('billing.tierStatus')}</TableHead>
                  <TableHead className="text-center">{t('billing.tierClients')}</TableHead>
                  <TableHead className="text-right">{tCommon('labels.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map((tier) => (
                  <>
                    <TableRow key={tier.id}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => toggleExpand(tier.id)}
                          className="p-1 hover:bg-muted rounded"
                        >
                          {expandedTierId === tier.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {tier.name}
                          {tier.is_default && (
                            <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {tier.code}
                        </code>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {tier.description || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={tier.is_active ? 'default' : 'secondary'}>
                          {tier.is_active ? tCommon('status.active') : tCommon('status.inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {getClientCountForTier(tier.id)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingTier(tier)}
                            title={tCommon('actions.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingTierId(tier.id)}
                            title={tCommon('actions.delete')}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedTierId === tier.id && (
                      <TableRow key={`${tier.id}-lines`}>
                        <TableCell colSpan={7} className="bg-muted/30 p-4">
                          <RateTierLinesTable
                            tierId={tier.id}
                            lines={(tier.lines ?? []) as RateTierLine[]}
                            classifications={classifications}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('billing.createTier')}</DialogTitle>
            <DialogDescription>{t('billing.createTierDescription')}</DialogDescription>
          </DialogHeader>
          <form action={handleCreate}>
            <TierFormFields />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                {tCommon('actions.cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tCommon('actions.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingTier} onOpenChange={() => setEditingTier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('billing.editTier')}</DialogTitle>
            <DialogDescription>{t('billing.editTierDescription')}</DialogDescription>
          </DialogHeader>
          {editingTier && (
            <form action={handleUpdate}>
              <TierFormFields tier={editingTier} />
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setEditingTier(null)}>
                  {tCommon('actions.cancel')}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tCommon('actions.save')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTierId} onOpenChange={() => setDeletingTierId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('billing.deleteTierTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('billing.deleteTierMessage')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// Tier Form Fields (shared between create and edit)
// ============================================================

function TierFormFields({ tier }: { tier?: RateTier }) {
  const t = useTranslations('admin')

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tier-name">{t('billing.tierName')}</Label>
          <Input
            id="tier-name"
            name="name"
            defaultValue={tier?.name ?? ''}
            required
            maxLength={100}
            placeholder={t('billing.tierNamePlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tier-code">{t('billing.tierCode')}</Label>
          <Input
            id="tier-code"
            name="code"
            defaultValue={tier?.code ?? ''}
            required
            maxLength={20}
            placeholder={t('billing.tierCodePlaceholder')}
            className="uppercase"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tier-description">{t('billing.tierDescription')}</Label>
        <Textarea
          id="tier-description"
          name="description"
          defaultValue={tier?.description ?? ''}
          maxLength={500}
          placeholder={t('billing.tierDescriptionPlaceholder')}
          rows={2}
        />
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="tier-is-active"
            name="is_active"
            defaultChecked={tier?.is_active ?? true}
            value="true"
          />
          <Label htmlFor="tier-is-active" className="text-sm font-normal">
            {t('billing.tierActive')}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="tier-is-default"
            name="is_default"
            defaultChecked={tier?.is_default ?? false}
            value="true"
          />
          <Label htmlFor="tier-is-default" className="text-sm font-normal">
            {t('billing.tierDefault')}
          </Label>
        </div>
      </div>
    </div>
  )
}
