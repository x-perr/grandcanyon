import { redirect } from 'next/navigation'
import { getProfile, getUserPermissions } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getProfile()

  if (!profile) {
    redirect('/login')
  }

  const permissions = await getUserPermissions()

  return (
    <AppShell profile={profile} permissions={permissions}>
      {children}
    </AppShell>
  )
}
