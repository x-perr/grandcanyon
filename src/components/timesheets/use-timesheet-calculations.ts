import { useMemo } from 'react'
import { formatWeekRangeLocale, parseDateISO } from '@/lib/date'
import type { getTimesheetById } from '@/app/(protected)/timesheets/actions'

type TimesheetDetail = Awaited<ReturnType<typeof getTimesheetById>>

export function useTimesheetCalculations(
  data: TimesheetDetail | null,
  weekStart: string,
  locale: 'en' | 'fr'
) {
  const { entries, dailyTotals, grandTotal } = useMemo(() => {
    if (!data?.entries) {
      return { entries: [] as NonNullable<typeof data>['entries'], dailyTotals: [0, 0, 0, 0, 0, 0, 0], grandTotal: 0 }
    }

    const dailyTotals = [0, 0, 0, 0, 0, 0, 0]
    let grandTotal = 0

    data.entries.forEach((entry: { hours?: (number | null)[] | null }) => {
      const hours = entry.hours ?? [0, 0, 0, 0, 0, 0, 0]
      hours.forEach((h: number | null, i: number) => {
        const val = h ?? 0
        dailyTotals[i] += val
        grandTotal += val
      })
    })

    return { entries: data.entries, dailyTotals, grandTotal }
  }, [data])

  const user = useMemo(() => {
    if (!data?.user) return null
    return Array.isArray(data.user) ? data.user[0] : data.user
  }, [data])

  const weekRange = useMemo(
    () => formatWeekRangeLocale(parseDateISO(weekStart), locale),
    [weekStart, locale]
  )

  return { entries, dailyTotals, grandTotal, user, weekRange }
}
