'use client'

import { useState, useActionState } from 'react'
import Link from 'next/link'
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
            Back to {project ? 'Project' : 'Projects'}
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
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Project identification and client assignment</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="client_id">Client *</Label>
            <Select
              name="client_id"
              value={selectedClientId}
              onValueChange={setSelectedClientId}
              required
              disabled={mode === 'edit'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
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
              <p className="text-xs text-muted-foreground">Client cannot be changed after creation</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Project Code</Label>
            <Input
              value={mode === 'edit' ? project?.code ?? '' : generatedCode}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              {mode === 'create' ? 'Auto-generated from client' : 'Cannot be changed'}
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              name="name"
              placeholder="Phase 1 - Foundation Work"
              defaultValue={project?.name ?? ''}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Detailed description of the project..."
              defaultValue={project?.description ?? ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            <Select name="status" defaultValue={project?.status ?? 'draft'}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
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
            <Label htmlFor="project_manager_id">Project Manager</Label>
            <Select name="project_manager_id" defaultValue={project?.project_manager_id ?? ''}>
              <SelectTrigger>
                <SelectValue placeholder="Select PM (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
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
          <CardTitle>Billing Settings</CardTitle>
          <CardDescription>Configure how this project is billed</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="billing_type">Billing Type *</Label>
            <Select
              name="billing_type"
              value={billingType}
              onValueChange={(value) => setBillingType(value as typeof billingType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select billing type" />
              </SelectTrigger>
              <SelectContent>
                {billingTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {billingTypes.find((t) => t.value === billingType)?.description}
            </p>
          </div>

          {billingType === 'hourly' && (
            <div className="space-y-2">
              <Label htmlFor="hourly_rate">Default Hourly Rate *</Label>
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
              <p className="text-xs text-muted-foreground">Per hour rate</p>
            </div>
          )}

          {billingType === 'fixed' && (
            <div className="space-y-2">
              <Label htmlFor="fixed_price">Fixed Price *</Label>
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
              <p className="text-xs text-muted-foreground">Total project cost</p>
            </div>
          )}

          {billingType === 'per_unit' && (
            <div className="space-y-2">
              <Label htmlFor="per_unit_rate">Per Unit Rate *</Label>
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
              <p className="text-xs text-muted-foreground">Rate per unit of work</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Project Timeline</CardTitle>
          <CardDescription>Start and end dates for the project</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              name="start_date"
              type="date"
              defaultValue={project?.start_date?.split('T')[0] ?? ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end_date">End Date</Label>
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
          <CardTitle>Additional Details</CardTitle>
          <CardDescription>Optional project information</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Project Address</Label>
            <Input
              id="address"
              name="address"
              placeholder="123 Construction Site Dr, Montreal, QC"
              defaultValue={project?.address ?? ''}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="po_number">PO Number</Label>
            <Input
              id="po_number"
              name="po_number"
              placeholder="PO-2024-001"
              defaultValue={project?.po_number ?? ''}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="work_type">Work Type</Label>
            <Input
              id="work_type"
              name="work_type"
              placeholder="Residential Construction"
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
              Global Project (visible to all users)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" asChild>
          <Link href={project ? `/projects/${project.id}` : '/projects'}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={isPending || (mode === 'create' && !selectedClientId)}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Create Project' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
