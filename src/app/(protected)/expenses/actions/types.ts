import type { Enums, Tables } from '@/types/database'

export type ExpenseStatus = Enums<'expense_status'>

export type ExpenseWithUser = Tables<'expenses'> & {
  user: {
    id: string
    first_name: string
    last_name: string
    email: string
  } | null
  total_amount?: number
  entry_count?: number
}

export type ExpenseEntryWithRelations = Tables<'expense_entries'> & {
  expense_type: {
    id: string
    code: string
    name: string
    default_rate: number | null
  } | null
  project: {
    id: string
    code: string
    name: string
  } | null
  task: {
    id: string
    code: string
    name: string
  } | null
}

export type ExpenseType = {
  id: string
  code: string
  name: string
  default_rate: number | null
  is_active: boolean
}

export type ProjectForExpense = {
  id: string
  code: string
  name: string
  tasks: { id: string; code: string; name: string }[]
}
