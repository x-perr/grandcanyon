import { getTranslations } from 'next-intl/server'
import { User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getMyProfile } from './actions'
import { ProfileContactForm } from '@/components/profile/profile-contact-form'
import { ProfilePreferencesForm } from '@/components/profile/profile-preferences-form'
import { ChangePasswordForm } from '@/components/profile/change-password-form'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const [profile, t] = await Promise.all([
    getMyProfile(),
    getTranslations('profile'),
  ])

  if (!profile) {
    redirect('/login')
  }

  const initials = `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()
  const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
  const managerName = profile.manager
    ? `${profile.manager.first_name} ${profile.manager.last_name}`
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <User className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Header Card */}
        <Card className="md:col-span-2">
          <CardContent className="flex flex-col items-center gap-6 pt-6 sm:flex-row sm:items-start">
            <Avatar className="h-24 w-24 text-2xl">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-bold">{fullName}</h2>
              <p className="text-muted-foreground">{profile.email}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge variant="secondary">{profile.role?.name || 'Employee'}</Badge>
                {managerName && (
                  <Badge variant="outline">{t('manager')}: {managerName}</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('contact.title')}</CardTitle>
            <CardDescription>{t('contact.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileContactForm
              phone={profile.phone || ''}
              email={profile.email || ''}
            />
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>{t('preferences.title')}</CardTitle>
            <CardDescription>{t('preferences.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfilePreferencesForm
              currentLocale={profile.preferred_locale as 'en' | 'fr' | null}
            />
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle>{t('security.title')}</CardTitle>
            <CardDescription>{t('security.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
