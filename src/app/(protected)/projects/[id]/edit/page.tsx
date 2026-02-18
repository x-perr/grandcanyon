import { notFound, redirect } from 'next/navigation'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getProject, getClientsForSelect, getUsersForSelect } from '../../actions'
import { ProjectForm } from '@/components/projects/project-form'

interface EditProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const { id } = await params
  const permissions = await getUserPermissions()

  if (!hasPermission(permissions, 'projects.edit')) {
    redirect('/projects')
  }

  const [project, clients, users] = await Promise.all([
    getProject(id),
    getClientsForSelect(),
    getUsersForSelect(),
  ])

  if (!project) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Project</h1>
        <p className="text-muted-foreground">
          Update project information for {project.code} - {project.name}
        </p>
      </div>

      <ProjectForm project={project} mode="edit" clients={clients} users={users} />
    </div>
  )
}
