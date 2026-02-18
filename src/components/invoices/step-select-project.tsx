'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, FolderKanban } from 'lucide-react'
import type { ClientForSelect, ProjectForSelect } from '@/app/(protected)/invoices/actions'

interface StepSelectProjectProps {
  clients: ClientForSelect[]
  projects: ProjectForSelect[]
  clientId: string
  projectId: string
  onClientChange: (clientId: string) => void
  onProjectChange: (projectId: string) => void
}

export function StepSelectProject({
  clients,
  projects,
  clientId,
  projectId,
  onClientChange,
  onProjectChange,
}: StepSelectProjectProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Step 1: Select Project</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose the client and project you want to invoice
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Client Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Client
            </CardTitle>
            <CardDescription>Select the client to bill</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={clientId} onValueChange={onClientChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    <div className="flex flex-col">
                      <span>{client.name}</span>
                      <span className="text-xs text-muted-foreground">{client.code}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {clientId && (
              <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
                <div className="font-medium">Tax Settings</div>
                <div className="text-muted-foreground mt-1">
                  {(() => {
                    const client = clients.find((c) => c.id === clientId)
                    const taxes = []
                    if (client?.charges_gst !== false) taxes.push('GST (5%)')
                    if (client?.charges_qst !== false) taxes.push('QST (9.975%)')
                    return taxes.length > 0 ? taxes.join(' + ') : 'No taxes'
                  })()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="h-4 w-4" />
              Project
            </CardTitle>
            <CardDescription>Select the project to invoice</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={projectId}
              onValueChange={onProjectChange}
              disabled={!clientId || projects.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !clientId
                      ? 'Select a client first...'
                      : projects.length === 0
                        ? 'No active projects'
                        : 'Select a project...'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex flex-col">
                      <span>{project.name}</span>
                      <span className="text-xs text-muted-foreground">{project.code}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!clientId && (
              <p className="mt-4 text-sm text-muted-foreground">
                Select a client to see their projects
              </p>
            )}

            {clientId && projects.length === 0 && (
              <p className="mt-4 text-sm text-amber-600">
                This client has no active projects. Create a project first.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {clientId && projectId && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-green-700">
            Ready to continue. Click <strong>Continue</strong> to select time entries.
          </p>
        </div>
      )}
    </div>
  )
}
