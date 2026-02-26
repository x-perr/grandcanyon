/**
 * Utilities for normalizing Supabase join results
 *
 * Supabase returns joined data in various formats depending on the relation type:
 * - Single relations (belongsTo): returns object or null
 * - Many relations (hasMany): returns array
 * - Aggregates with .select('count'): returns array with single count object
 *
 * These utilities provide type-safe access to these patterns.
 */

/**
 * Safely unwrap a single relation that might be returned as an array
 *
 * @example
 * // Supabase might return client as Client | Client[] | null
 * const clientName = unwrapSingle(invoice.client)?.name ?? 'Unknown'
 */
export function unwrapSingle<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

/**
 * Get a property from a potentially wrapped relation
 *
 * @example
 * const clientName = getRelationProp(invoice.client, 'name', 'Unknown')
 */
export function getRelationProp<T, K extends keyof NonNullable<T>>(
  relation: T | T[] | null | undefined,
  key: K,
  defaultValue: NonNullable<T>[K]
): NonNullable<T>[K] {
  const unwrapped = unwrapSingle(relation)
  if (!unwrapped) return defaultValue
  return (unwrapped as NonNullable<T>)[key] ?? defaultValue
}

/**
 * Get count from a Supabase aggregate relation
 *
 * @example
 * // Supabase: .select('*, projects(count)')
 * // Returns: { projects: [{ count: 5 }] }
 * const projectCount = getAggregateCount(client.projects)
 */
export function getAggregateCount(
  relation: Array<{ count: number }> | null | undefined
): number {
  if (!relation || !Array.isArray(relation) || relation.length === 0) return 0
  return relation[0]?.count ?? 0
}

/**
 * Normalize a full name from first_name and last_name
 *
 * @example
 * const userName = formatFullName(user, 'Unknown')
 */
export function formatFullName(
  user: { first_name?: string | null; last_name?: string | null } | null | undefined,
  defaultValue = 'Unknown'
): string {
  if (!user) return defaultValue
  const parts = [user.first_name, user.last_name].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : defaultValue
}

/**
 * Type guard to check if a relation result is not null/undefined
 *
 * @example
 * if (hasRelation(invoice.client)) {
 *   console.log(invoice.client.name) // TypeScript knows it's not null
 * }
 */
export function hasRelation<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Transform a Supabase row with joins into a normalized shape
 *
 * @example
 * const normalized = normalizeRow(invoice, {
 *   clientName: (row) => row.client?.name ?? 'Unknown',
 *   projectCode: (row) => row.project?.code ?? '',
 * })
 */
export function normalizeRow<T extends object, R extends Record<string, unknown>>(
  row: T,
  transforms: { [K in keyof R]: (row: T) => R[K] }
): T & R {
  const result = { ...row } as T & R
  for (const [key, transform] of Object.entries(transforms)) {
    (result as Record<string, unknown>)[key] = (transform as (row: T) => unknown)(row)
  }
  return result
}

/**
 * Transform an array of Supabase rows
 *
 * @example
 * const normalized = normalizeRows(invoices, {
 *   clientName: (row) => row.client?.name ?? 'Unknown',
 * })
 */
export function normalizeRows<T extends object, R extends Record<string, unknown>>(
  rows: T[],
  transforms: { [K in keyof R]: (row: T) => R[K] }
): (T & R)[] {
  return rows.map(row => normalizeRow(row, transforms))
}
