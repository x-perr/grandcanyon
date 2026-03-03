'use client'

import { useState, useTransition, useRef, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Contact,
  Building2,
  HardHat,
  Users,
  MoreHorizontal,
  Pencil,
  Mail,
  Phone,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent } from '@/components/ui/card'
import type { Contact as ContactType, ContactType as ContactTypeEnum } from '@/app/(protected)/admin/actions'

interface ContactsPageClientProps {
  contacts: ContactType[]
  totalCount: number
  currentPage: number
  pageSize: number
  searchQuery: string
  contactType: ContactTypeEnum | null
  showInactive: boolean
}

const CONTACT_TYPE_ICONS: Record<string, typeof Contact> = {
  employee: HardHat,
  client_contact: Building2,
  subcontractor: Users,
  external: Contact,
}

export function ContactsPageClient({
  contacts,
  totalCount,
  currentPage,
  pageSize,
  searchQuery,
  contactType,
  showInactive,
}: ContactsPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(searchQuery)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const updateSearch = useCallback((value: string) => {
    setSearch(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('search', value)
      } else {
        params.delete('search')
      }
      params.delete('page')
      startTransition(() => {
        router.push(`/admin/contacts?${params.toString()}`)
      })
    }, 300)
  }, [searchParams, router])

  const updateFilter = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    startTransition(() => {
      router.push(`/admin/contacts?${params.toString()}`)
    })
  }, [searchParams, router])

  const toggleInactive = useCallback((checked: boolean) => {
    updateFilter('inactive', checked ? 'true' : null)
  }, [updateFilter])

  const goToPage = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    startTransition(() => {
      router.push(`/admin/contacts?${params.toString()}`)
    })
  }, [searchParams, router])

  const getContactTypeBadge = useCallback((type: ContactTypeEnum | null) => {
    const Icon = type ? CONTACT_TYPE_ICONS[type] || Contact : Contact
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      employee: 'default',
      client_contact: 'secondary',
      subcontractor: 'outline',
      external: 'outline',
    }
    return (
      <Badge variant={type ? variants[type] : 'outline'} className="gap-1">
        <Icon className="h-3 w-3" />
        {type ? t(`contacts.types.${type}`) : t('contacts.types.unknown')}
      </Badge>
    )
  }, [t])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <SearchInput
            placeholder={t('contacts.search_placeholder')}
            value={search}
            onChange={updateSearch}
            className="w-full sm:w-64"
          />
          <Select
            value={contactType ?? 'all'}
            onValueChange={(value) => updateFilter('type', value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder={t('contacts.filter_type')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('contacts.all_types')}</SelectItem>
              <SelectItem value="employee">{t('contacts.types.employee')}</SelectItem>
              <SelectItem value="client_contact">{t('contacts.types.client_contact')}</SelectItem>
              <SelectItem value="subcontractor">{t('contacts.types.subcontractor')}</SelectItem>
              <SelectItem value="external">{t('contacts.types.external')}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={toggleInactive}
            />
            <label
              htmlFor="show-inactive"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {t('contacts.show_inactive')}
            </label>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('contacts.total_count', { count: totalCount })}
        </p>
      </div>

      {/* Table */}
      {contacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Contact className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">{t('contacts.no_contacts')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchQuery ? t('contacts.search_empty') : t('contacts.no_contacts_message')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tCommon('labels.name')}</TableHead>
                <TableHead>{t('contacts.type')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('contacts.contact_info')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('contacts.client')}</TableHead>
                <TableHead>{tCommon('labels.status')}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {contact.first_name} {contact.last_name}
                        {contact.is_primary && (
                          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      {contact.title && (
                        <div className="text-sm text-muted-foreground">{contact.title}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getContactTypeBadge(contact.contact_type)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex flex-col gap-1 text-sm">
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {contact.phone}
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {contact.client ? (
                      <Link
                        href={`/clients/${contact.client.id}`}
                        className="text-primary hover:underline"
                      >
                        {contact.client.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={contact.is_active ? 'default' : 'secondary'}>
                      {contact.is_active ? tCommon('status.active') : tCommon('status.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">{tCommon('labels.actions')}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {contact.contact_type === 'client_contact' && contact.client && (
                          <DropdownMenuItem asChild>
                            <Link href={`/clients/${contact.client.id}`}>
                              <Building2 className="mr-2 h-4 w-4" />
                              {t('contacts.view_client')}
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {contact.email && (
                          <DropdownMenuItem asChild>
                            <a href={`mailto:${contact.email}`}>
                              <Mail className="mr-2 h-4 w-4" />
                              {t('contacts.send_email')}
                            </a>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {tCommon('pagination.showing', {
              start: (currentPage - 1) * pageSize + 1,
              end: Math.min(currentPage * pageSize, totalCount),
              total: totalCount,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1 || isPending}
            >
              {tCommon('actions.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || isPending}
            >
              {tCommon('actions.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
