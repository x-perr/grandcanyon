/**
 * Date utilities for timesheet week handling
 */

/**
 * Get the Monday of the week for a given date
 */
export function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // If Sunday (0), go back 6 days; otherwise go back (day - 1) days
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get the Sunday (week end) from a Monday start date
 */
export function getSunday(weekStart: Date): Date {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Format a date as ISO date string (YYYY-MM-DD) for database queries
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Parse an ISO date string to a Date object (handles timezone correctly)
 */
export function parseDateISO(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Format a week range as "Feb 10-16, 2024"
 */
export function formatWeekRange(weekStart: Date): string {
  const weekEnd = getSunday(weekStart)

  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
  const startDay = weekStart.getDate()
  const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' })
  const endDay = weekEnd.getDate()
  const year = weekStart.getFullYear()

  // If same month: "Feb 10-16, 2024"
  // If different months: "Feb 26 - Mar 4, 2024"
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}, ${year}`
  } else {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`
  }
}

/**
 * Get array of day labels for the week
 */
export function getWeekDayLabels(): string[] {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
}

/**
 * Get array of full day names
 */
export function getWeekDayNames(): string[] {
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
}

/**
 * Get the dates for each day of the week starting from Monday
 */
export function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

/**
 * Format a single date as "Mon 10" or "10"
 */
export function formatDayShort(date: Date, includeDay = true): string {
  const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' })
  const dayNum = date.getDate()
  return includeDay ? `${dayLabel} ${dayNum}` : `${dayNum}`
}

/**
 * Get the Monday of the current week
 */
export function getCurrentWeekStart(): Date {
  return getMonday(new Date())
}

/**
 * Get the Monday of the previous week from a given week start
 */
export function getPreviousWeekStart(weekStart: Date): Date {
  const d = new Date(weekStart)
  d.setDate(d.getDate() - 7)
  return d
}

/**
 * Get the Monday of the next week from a given week start
 */
export function getNextWeekStart(weekStart: Date): Date {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 7)
  return d
}

/**
 * Check if a week start date is the current week
 */
export function isCurrentWeek(weekStart: Date): boolean {
  const currentWeek = getCurrentWeekStart()
  return formatDateISO(weekStart) === formatDateISO(currentWeek)
}

/**
 * Check if a week is in the future
 */
export function isFutureWeek(weekStart: Date): boolean {
  const currentWeek = getCurrentWeekStart()
  return weekStart > currentWeek
}

/**
 * Calculate total hours from a 7-element array
 */
export function sumHours(hours: (number | null)[]): number {
  return hours.reduce((sum: number, h: number | null) => sum + (h ?? 0), 0)
}
