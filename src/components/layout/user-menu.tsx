'use client'

import Link from 'next/link'
import { LogOut, User, Globe, Sun, Moon, Monitor } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import { logout } from '@/app/(auth)/login/actions'
import { setLocale } from '@/lib/locale'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { ProfileWithRole } from '@/lib/auth'
import type { Locale } from '@/i18n/config'

interface UserMenuProps {
  profile: ProfileWithRole
}

export function UserMenu({ profile }: UserMenuProps) {
  const t = useTranslations()
  const locale = useLocale()
  const { theme, setTheme } = useTheme()
  const initials = `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
  const fullName = `${profile.first_name} ${profile.last_name}`

  const handleLocaleChange = async (newLocale: Locale) => {
    await setLocale(newLocale)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{fullName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {profile.email}
            </p>
            {profile.role && (
              <p className="text-xs leading-none text-muted-foreground mt-1">
                Role: {profile.role.name}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            {t('auth.profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Globe className="mr-2 h-4 w-4" />
            {t('language.title')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              onClick={() => handleLocaleChange('fr')}
              className={locale === 'fr' ? 'bg-accent' : ''}
            >
              {t('language.french')}
              {locale === 'fr' && ' ✓'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleLocaleChange('en')}
              className={locale === 'en' ? 'bg-accent' : ''}
            >
              {t('language.english')}
              {locale === 'en' && ' ✓'}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun className="mr-2 h-4 w-4" />
            {t('theme.title')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              onClick={() => setTheme('light')}
              className={theme === 'light' ? 'bg-accent' : ''}
            >
              <Sun className="mr-2 h-4 w-4" />
              {t('theme.light')}
              {theme === 'light' && ' ✓'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme('dark')}
              className={theme === 'dark' ? 'bg-accent' : ''}
            >
              <Moon className="mr-2 h-4 w-4" />
              {t('theme.dark')}
              {theme === 'dark' && ' ✓'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme('system')}
              className={theme === 'system' ? 'bg-accent' : ''}
            >
              <Monitor className="mr-2 h-4 w-4" />
              {t('theme.system')}
              {theme === 'system' && ' ✓'}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={logout} className="w-full">
            <button type="submit" className="flex w-full items-center">
              <LogOut className="mr-2 h-4 w-4" />
              {t('auth.logout')}
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
