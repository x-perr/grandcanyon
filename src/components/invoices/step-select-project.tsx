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
import { useTranslations } from 'next-intl'

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
  const t = useTranslations('invoices')

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">{t('wizard.step1_title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('wizard.step1_desc')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Client Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              {t('detail.client')}
            </CardTitle>
            <CardDescription>{t('wizard.select_client_to_bill')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={clientId} onValueChange={onClientChange}>
              <SelectTrigger>
                <SelectValue placeholder={t('wizard.select_client_placeholder')} />
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
                <div className="font-medium">{t('detail.tax_settings')}</div>
                <div className="text-muted-foreground mt-1">
                  {(() => {
                    const client = clients.find((c) => c.id === clientId)
                    const taxes = []
                    if (client?.charges_gst !== false) taxes.push(t('detail.gst'))
                    if (client?.charges_qst !== false) taxes.push(t('detail.qst'))
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
              {t('detail.project')}
            </CardTitle>
            <CardDescription>{t('wizard.select_project_to_invoice')}</CardDescription>
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
                      ? t('wizard.select_client_first')
                      : projects.length === 0
                        ? t('wizard.no_active_projects')
                        : t('wizard.select_project_placeholder')
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
                {t('wizard.select_client_to_see_projects')}
              </p>
            )}

            {clientId && projects.length === 0 && (
              <p className="mt-4 text-sm text-amber-600">
                {t('wizard.no_projects_warning')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {clientId && projectId && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-green-700">
            {t('wizard.ready_to_continue')}
          </p>
        </div>
      )}
    </div>
  )
}
