'use client'

import { useState, useActionState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { projectStatuses, billingTypes } from '@/lib/validations/project'
import { createProjectAction, updateProjectAction } from '@/app/(protected)/projects/actions'
import type { Tables } from '@/types/database'

type Project = Tables<'projects'>

interface ClientOption {
  id: string
  code: string
  name: string
  next_project_number: number | null
}

interface UserOption {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface ProjectFormProps {
  project?: Project | null
  clients: ClientOption[]
  users: UserOption[]
  mode: 'create' | 'edit'
}

type FormState = { error?: string } | void

export function ProjectForm({ project, clients, users, mode }: ProjectFormProps) {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  const [billingType, setBillingType] = useState(project?.billing_type ?? 'hourly')
  const [selectedClientId, setSelectedClientId] = useState(project?.client_id ?? '')

  const selectedClient = clients.find((c) => c.id === selectedClientId)
  const generatedCode = selectedClient
    ? `${selectedClient.code}-${String(selectedClient.next_project_number ?? 1).padStart(3, '0')}`
    : ''

  const action =
    mode === 'create' ? createProjectAction : updateProjectAction.bind(null, project?.id ?? '')

  const [state, formAction, isPending] = useActionState<FormState, FormData>(async (_, formData) => {
    const result = await action(formData)
    return result
  }, undefined)

  return (
    <form action={formAction} className="space-y-6">
      {/* Back link */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={project ? `/projects/${project.id}` : '/projects'}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {project ? t('back_to_project') : t('back_to_projects')}
          </Link>
        </Button>
      </div>

      {/* Error display */}
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t('form.basic_info')}</CardTitle>
          <CardDescription>{t('form.basic_info_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="client_id">{t('form.client')} *</Label>
            <Select
              name="client_id"
              value={selectedClientId}
              onValueChange={setSelectedClientId}
              required
              disabled={mode === 'edit'}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('form.select_client')} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.code} - {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mode === 'edit' && (
              <p className="text-xs text-muted-foreground">{t('form.client_locked')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('form.project_code')}</Label>
            <Input
              value={mode === 'edit' ? project?.code ?? '' : generatedCode}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              {mode === 'create' ? t('form.project_code_help') : t('form.code_locked')}
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">{t('form.name')} *</Label>
            <Input
              id="name"
              name="name"
              placeholder={t('form.name_placeholder')}
              defaultValue={project?.name ?? ''}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">{t('form.description')}</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              placeholder={t('form.description_placeholder')}
              defaultValue={project?.description ?? ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">{t('form.status')} *</Label>
            <Select name="status" defaultValue={project?.status ?? 'draft'}>
              <SelectTrigger>
                <SelectValue placeholder={t('form.select_status')} />
              </SelectTrigger>
              <SelectContent>
                {projectStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project_manager_id">{t('form.project_manager')}</Label>
            <Select name="project_manager_id" defaultValue={project?.project_manager_id ?? ''}>
              <SelectTrigger>
                <SelectValue placeholder={t('form.select_pm')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{tCommon('labels.none')}</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Billing */}
      <Card>
        <CardHeader>
          <CardTitle>{t('form.billing_info')}</CardTitle>
          <CardDescription>{t('form.billing_info_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="billing_type">{t('form.billing_type')} *</Label>
            <Select
              name="billing_type"
              value={billingType}
              onValueChange={(value) => setBillingType(value as typeof billingType)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('form.select_billing_type')} />
              </SelectTrigger>
              <SelectContent>
                {billingTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {t(`form.billing_types.${type.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {billingTypes.find((bt) => bt.value === billingType)?.description}
            </p>
          </div>

          {billingType === 'hourly' && (
            <div className="space-y-2">
              <Label htmlFor="hourly_rate">{t('form.hourly_rate')} *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="hourly_rate"
                  name="hourly_rate"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  defaultValue={project?.hourly_rate ?? ''}
                  className="pl-7"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">{t('form.per_hour_rate')}</p>
            </div>
          )}

          {billingType === 'fixed' && (
            <div className="space-y-2">
              <Label htmlFor="fixed_price">{t('form.fixed_price')} *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="fixed_price"
                  name="fixed_price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  defaultValue={project?.fixed_price ?? ''}
                  className="pl-7"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">{t('form.total_project_cost')}</p>
            </div>
          )}

          {billingType === 'per_unit' && (
            <div className="space-y-2">
              <Label htmlFor="per_unit_rate">{t('form.per_unit_rate')} *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="per_unit_rate"
                  name="per_unit_rate"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  defaultValue={project?.per_unit_rate ?? ''}
                  className="pl-7"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">{t('form.rate_per_unit')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle>{t('form.timeline')}</CardTitle>
          <CardDescription>{t('form.timeline_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="start_date">{t('form.start_date')}</Label>
            <Input
              id="start_date"
              name="start_date"
              type="date"
              defaultValue={project?.start_date?.split('T')[0] ?? ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end_date">{t('form.end_date')}</Label>
            <Input
              id="end_date"
              name="end_date"
              type="date"
              defaultValue={project?.end_date?.split('T')[0] ?? ''}
            />
          </div>
        </CardContent>
      </Card>

      {/* Additional Details */}
      <Card>
        <CardHeader>
          <CardTitle>{t('form.additional')}</CardTitle>
          <CardDescription>{t('form.additional_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">{t('form.address')}</Label>
            <Input
              id="address"
              name="address"
              placeholder={t('form.address_placeholder')}
              defaultValue={project?.address ?? ''}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="po_number">{t('form.po_number')}</Label>
            <Input
              id="po_number"
              name="po_number"
              placeholder={t('form.po_placeholder')}
              defaultValue={project?.po_number ?? ''}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="work_type">{t('form.work_type')}</Label>
            <Input
              id="work_type"
              name="work_type"
              placeholder={t('form.work_type_placeholder')}
              defaultValue={project?.work_type ?? ''}
              maxLength={100}
            />
          </div>

          <div className="flex items-center space-x-2 sm:col-span-2">
            <Checkbox
              id="is_global"
              name="is_global"
              defaultChecked={project?.is_global ?? false}
            />
            <Label htmlFor="is_global" className="cursor-pointer">
              {t('form.is_global')}
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" asChild>
          <Link href={project ? `/projects/${project.id}` : '/projects'}>
            {tCommon('actions.cancel')}
          </Link>
        </Button>
        <Button type="submit" disabled={isPending || (mode === 'create' && !selectedClientId)}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create' ? t('form.create') : t('form.save_changes')}
        </Button>
      </div>
    </form>
  )
}
