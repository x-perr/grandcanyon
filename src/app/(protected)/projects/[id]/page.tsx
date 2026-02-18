import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  FolderKanban,
  Calendar,
  DollarSign,
  MapPin,
  Pencil,
  Building2,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { TeamList } from '@/components/projects/team-list'
import { TaskList } from '@/components/projects/task-list'
import { BillingRoleList } from '@/components/projects/billing-role-list'
import { getProject, getUsersForSelect } from '../actions'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { billingTypes } from '@/lib/validations/project'

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params
  const [project, permissions, users] = await Promise.all([
    getProject(id),
    getUserPermissions(),
    getUsersForSelect(),
  ])

  if (!project) {
    notFound()
  }

  const canEdit = hasPermission(permissions, 'projects.edit')

  const formatDate = (date: string | null) => {
    if (!date) return 'Not set'
    return new Date(date).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-'
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount)
  }

  const billingTypeLabel = billingTypes.find((t) => t.value === project.billing_type)?.label ?? project.billing_type

  const getBillingRate = () => {
    switch (project.billing_type) {
      case 'hourly':
        return project.hourly_rate !== null ? `${formatCurrency(project.hourly_rate)}/hr` : '-'
      case 'fixed':
        return project.fixed_price !== null ? formatCurrency(project.fixed_price) : '-'
      case 'per_unit':
        return project.per_unit_rate !== null ? `${formatCurrency(project.per_unit_rate)}/unit` : '-'
      default:
        return '-'
    }
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
            <FolderKanban className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-semibold text-muted-foreground">
                {project.code}
              </span>
              {project.status && <StatusBadge status={project.status} />}
            </div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.client && (
              <Link
                href={`/clients/${project.client.id}`}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <Building2 className="h-3.5 w-3.5" />
                {project.client.name}
              </Link>
            )}
          </div>
        </div>
        {canEdit && (
          <Button asChild>
            <Link href={`/projects/${project.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Project
            </Link>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="team">Team ({project.members?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({project.tasks?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="billing">Billing Roles ({project.billing_roles?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Project Info */}
            <Card>
              <CardHeader>
                <CardTitle>Project Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {project.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Description</p>
                    <p className="whitespace-pre-wrap">{project.description}</p>
                  </div>
                )}
                {project.project_manager && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Project Manager</span>
                    <span>
                      {project.project_manager.first_name} {project.project_manager.last_name}
                    </span>
                  </div>
                )}
                {project.work_type && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Work Type</span>
                    <span>{project.work_type}</span>
                  </div>
                )}
                {project.is_global && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Visibility</span>
                    <Badge variant="secondary">Global</Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Billing Info */}
            <Card>
              <CardHeader>
                <CardTitle>Billing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Billing Type</span>
                  <Badge variant="outline">{billingTypeLabel}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-medium">{getBillingRate()}</span>
                </div>
                {project.po_number && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-muted-foreground">PO Number</span>
                    <span className="font-mono">{project.po_number}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Start Date</p>
                    <p className="text-sm text-muted-foreground">{formatDate(project.start_date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">End Date</p>
                    <p className="text-sm text-muted-foreground">{formatDate(project.end_date)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location */}
            <Card>
              <CardHeader>
                <CardTitle>Location</CardTitle>
              </CardHeader>
              <CardContent>
                {project.address ? (
                  <div className="flex gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    <address className="not-italic">{project.address}</address>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No address specified</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <TeamList
            projectId={project.id}
            members={project.members ?? []}
            billingRoles={project.billing_roles ?? []}
            availableUsers={users}
            canEdit={canEdit}
          />
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <TaskList projectId={project.id} tasks={project.tasks ?? []} canEdit={canEdit} />
        </TabsContent>

        {/* Billing Roles Tab */}
        <TabsContent value="billing">
          <BillingRoleList
            projectId={project.id}
            billingRoles={project.billing_roles ?? []}
            canEdit={canEdit}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
