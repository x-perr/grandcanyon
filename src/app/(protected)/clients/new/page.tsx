import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { ClientForm } from '@/components/clients/client-form'

export default async function NewClientPage() {
  const permissions = await getUserPermissions()

  if (!hasPermission(permissions, 'clients.edit')) {
    redirect('/clients')
  }

  const t = await getTranslations('clients')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('new_client')}</h1>
        <p className="text-muted-foreground">{t('form.basic_info_desc')}</p>
      </div>

      <ClientForm mode="create" />
    </div>
  )
}
