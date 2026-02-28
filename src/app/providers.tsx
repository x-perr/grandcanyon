'use client'

import { ThemeProvider } from 'next-themes'
import { NextIntlClientProvider, AbstractIntlMessages } from 'next-intl'
import { Toaster } from '@/components/ui/sonner'

interface ProvidersProps {
  children: React.ReactNode
  locale: string
  messages: AbstractIntlMessages
}

export function Providers({ children, locale, messages }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
        <Toaster richColors position="top-right" />
      </NextIntlClientProvider>
    </ThemeProvider>
  )
}
