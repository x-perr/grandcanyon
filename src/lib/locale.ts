'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { type Locale, isValidLocale, defaultLocale } from '@/i18n/config'

const LOCALE_COOKIE = 'NEXT_LOCALE'

/**
 * Get the current locale from cookie
 */
export async function getLocaleFromCookie(): Promise<Locale> {
  const cookieStore = await cookies()
  const locale = cookieStore.get(LOCALE_COOKIE)?.value
  return locale && isValidLocale(locale) ? locale : defaultLocale
}

/**
 * Set the locale in cookie and optionally update user profile
 */
export async function setLocale(locale: Locale) {
  if (!isValidLocale(locale)) {
    return { error: 'Invalid locale' }
  }

  // Set cookie
  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  })

  // Update user profile if logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    await supabase
      .from('profiles')
      .update({ preferred_locale: locale })
      .eq('id', user.id)
  }

  // Revalidate all pages to reflect new locale
  revalidatePath('/', 'layout')

  return { success: true }
}

/**
 * Get user's preferred locale from profile (for initial load)
 */
export async function getUserPreferredLocale(): Promise<Locale | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('preferred_locale')
    .eq('id', user.id)
    .single()

  const locale = profile?.preferred_locale
  return locale && isValidLocale(locale) ? locale : null
}
