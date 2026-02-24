import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { defaultLocale, isValidLocale, type Locale } from './config'

export default getRequestConfig(async () => {
  // 1. Check cookie first (user preference)
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value

  if (cookieLocale && isValidLocale(cookieLocale)) {
    return {
      locale: cookieLocale,
      messages: (await import(`../messages/${cookieLocale}.json`)).default,
    }
  }

  // 2. Check Accept-Language header
  const headerStore = await headers()
  const acceptLanguage = headerStore.get('accept-language')
  if (acceptLanguage) {
    // Parse Accept-Language: fr-CA,fr;q=0.9,en;q=0.8
    const preferredLocale = acceptLanguage
      .split(',')
      .map((lang) => lang.split(';')[0].trim().substring(0, 2))
      .find((lang) => isValidLocale(lang)) as Locale | undefined

    if (preferredLocale) {
      return {
        locale: preferredLocale,
        messages: (await import(`../messages/${preferredLocale}.json`)).default,
      }
    }
  }

  // 3. Fall back to default (French)
  return {
    locale: defaultLocale,
    messages: (await import(`../messages/${defaultLocale}.json`)).default,
  }
})
