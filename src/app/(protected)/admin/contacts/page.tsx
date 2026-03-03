import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { Contact } from 'lucide-react'
import { getContacts, type ContactType } from '../actions'
import { ContactsPageClient } from '@/components/admin/contacts-page-client'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type SearchParams = {
  search?: string
  type?: ContactType
  inactive?: string
  page?: string
}

function ContactsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-64 mt-1" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

async function ContactsContent({ searchParams }: { searchParams: SearchParams }) {
  const pageSize = 25
  const currentPage = searchParams.page ? parseInt(searchParams.page, 10) : 1
  const offset = (currentPage - 1) * pageSize

  const { contacts, count } = await getContacts({
    search: searchParams.search,
    contactType: searchParams.type,
    showInactive: searchParams.inactive === 'true',
    limit: pageSize,
    offset,
  })

  return (
    <ContactsPageClient
      contacts={contacts}
      totalCount={count}
      currentPage={currentPage}
      pageSize={pageSize}
      searchQuery={searchParams.search ?? ''}
      contactType={searchParams.type ?? null}
      showInactive={searchParams.inactive === 'true'}
    />
  )
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const t = await getTranslations('admin')
  const params = await searchParams

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Contact className="h-8 w-8" />
          {t('contacts.title')}
        </h1>
        <p className="text-muted-foreground">{t('contacts.subtitle')}</p>
      </div>

      <Suspense fallback={<ContactsLoading />}>
        <ContactsContent searchParams={params} />
      </Suspense>
    </div>
  )
}
