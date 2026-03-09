-- ============================================================================
-- Performance Indexes for Common Filter/Sort Patterns
-- ============================================================================
-- Migration: 20260309120000_add_performance_indexes
-- Date: 2026-03-09
-- Purpose: Add indexes targeting the most frequent query patterns in the app
--          to improve response times on list views, dashboards, and RLS checks.
-- Safety: All indexes use CREATE INDEX IF NOT EXISTS for idempotent execution.
-- ============================================================================

-- ============================================================================
-- Projects: filtered by active status and sorted
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_deleted ON projects(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- Clients: filtered by active/deleted
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_deleted ON clients(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_code ON clients(code);

-- ============================================================================
-- Invoices: commonly filtered by client + status
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_invoices_client_status ON invoices(client_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ============================================================================
-- Expenses: looked up by user + week
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_expenses_user_week ON expenses(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

-- ============================================================================
-- Expense entries: looked up by expense_id for aggregation
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_expense_entries_expense ON expense_entries(expense_id);

-- ============================================================================
-- Timesheets: looked up by user + week
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_timesheets_user_week ON timesheets(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON timesheets(status);

-- ============================================================================
-- Timesheet entries: looked up by timesheet_id
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheet ON timesheet_entries(timesheet_id);
