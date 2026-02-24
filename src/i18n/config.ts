export const locales = ['fr', 'en'] as const
export const defaultLocale = 'fr' as const
export type Locale = (typeof locales)[number]

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale)
}
