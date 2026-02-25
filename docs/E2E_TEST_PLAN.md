# Grand Canyon E2E Test Plan

**Version**: 1.0
**Created**: 2026-02-24 (Session 19)
**Status**: Ready for Implementation
**Total Tests**: 114

---

## Table of Contents

1. [Test Infrastructure](#1-test-infrastructure)
2. [Test Data Requirements](#2-test-data-requirements)
3. [Module Test Cases](#3-module-test-cases)
   - [3.1 Authentication](#31-authentication-5-tests)
   - [3.2 Clients](#32-clients-12-tests)
   - [3.3 Projects](#33-projects-16-tests)
   - [3.4 Timesheets](#34-timesheets-15-tests)
   - [3.5 Expenses](#35-expenses-14-tests)
   - [3.6 Invoices](#36-invoices-18-tests)
   - [3.7 Reports](#37-reports-9-tests)
   - [3.8 Dashboard](#38-dashboard-5-tests)
   - [3.9 Admin](#39-admin-14-tests)
   - [3.10 i18n](#310-i18n-6-tests)
4. [Implementation Priority](#4-implementation-priority)
5. [Test Execution](#5-test-execution)

---

## 1. Test Infrastructure

### 1.1 Environment Setup

| Setting | Value |
|---------|-------|
| Base URL | `http://localhost:3000` |
| Test Directory | `tests/e2e/` |
| Primary Browser | Chromium |
| Timeout | 30 seconds |
| Retries | 2 on CI |

### 1.2 Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 1.3 Test File Structure

```
tests/e2e/
├── fixtures/
│   ├── auth.fixture.ts          # Login/session helpers
│   ├── data.fixture.ts          # Test data creation
│   └── page-objects/
│       ├── login.page.ts
│       ├── client.page.ts
│       ├── project.page.ts
│       ├── timesheet.page.ts
│       ├── expense.page.ts
│       ├── invoice.page.ts
│       ├── report.page.ts
│       ├── dashboard.page.ts
│       └── admin.page.ts
├── auth/
│   └── auth.spec.ts             # AUTH-01 to AUTH-05
├── clients/
│   └── clients.spec.ts          # CLI-01 to CLI-12
├── projects/
│   └── projects.spec.ts         # PRJ-01 to PRJ-16
├── timesheets/
│   └── timesheets.spec.ts       # TS-01 to TS-15
├── expenses/
│   └── expenses.spec.ts         # EXP-01 to EXP-14
├── invoices/
│   └── invoices.spec.ts         # INV-01 to INV-18
├── reports/
│   └── reports.spec.ts          # RPT-01 to RPT-09
├── dashboard/
│   └── dashboard.spec.ts        # DASH-01 to DASH-05
├── admin/
│   └── admin.spec.ts            # ADM-01 to ADM-14
└── i18n/
    └── i18n.spec.ts             # I18N-01 to I18N-06
```

---

## 2. Test Data Requirements

### 2.1 Entity Dependency Hierarchy

Entities must be created in this order due to foreign key dependencies:

```
Level 0 (Independent)
├── Roles
├── Permissions
├── Expense Types
└── People

Level 1 (Depends on Level 0)
└── Profiles (3 test users)

Level 2 (Depends on Level 1)
└── Clients (2 test clients)

Level 3 (Depends on Level 2)
├── Projects (3 test projects)
└── Client Contacts

Level 4 (Depends on Level 3)
├── Project Billing Roles
├── Project Tasks
└── Project Members

Level 5 (Depends on Level 4)
├── Timesheets (various statuses)
├── Expenses (various statuses)
└── Timesheet Entries

Level 6 (Depends on Level 5)
├── Invoices (draft/sent/paid)
└── Invoice Lines
```

### 2.2 Test Users

| User | Email | Role | Purpose |
|------|-------|------|---------|
| Admin | `admin-test@xperr.win` | Admin | Full access, settings management |
| Manager | `manager-test@xperr.win` | Manager | Approval workflows, team management |
| Employee | `employee-test@xperr.win` | Employee | Basic entry, cannot approve |

### 2.3 Test Clients

| Code | Name | GST | QST |
|------|------|-----|-----|
| `TEST1` | Test Client One | Yes | Yes |
| `TEST2` | Test Client Two | Yes | No |

### 2.4 Test Projects

| Code | Client | Status | Billing Type |
|------|--------|--------|--------------|
| `TEST1-001` | TEST1 | Active | Hourly ($150/hr) |
| `TEST1-002` | TEST1 | Draft | Fixed ($10,000) |
| `TEST2-001` | TEST2 | Active | Per Unit ($25/unit) |

### 2.5 Enum Values Reference

| Enum | Values |
|------|--------|
| Project Status | `draft`, `active`, `on_hold`, `completed`, `cancelled` |
| Project Billing Type | `hourly`, `fixed`, `per_unit` |
| Timesheet Status | `draft`, `submitted`, `approved`, `rejected`, `locked` |
| Expense Status | `draft`, `submitted`, `approved`, `rejected` |
| Invoice Status | `draft`, `sent`, `paid`, `void` |

---

## 3. Module Test Cases

### 3.1 Authentication (5 tests)

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| AUTH-01 | Login with valid credentials | 1. Navigate to /login<br>2. Enter email: `admin-test@xperr.win`<br>3. Enter password<br>4. Click Submit | Redirect to /dashboard | Critical |
| AUTH-02 | Login with invalid credentials | 1. Navigate to /login<br>2. Enter wrong password<br>3. Click Submit | Error alert displayed: "Invalid login credentials" | Critical |
| AUTH-03 | Session persistence | 1. Login successfully<br>2. Refresh page | Still on dashboard, user still authenticated | Critical |
| AUTH-04 | Logout | 1. Login<br>2. Click user menu (top right)<br>3. Click "Logout" | Redirect to /login, session cleared | Critical |
| AUTH-05 | Protected route without auth | 1. Clear cookies/session<br>2. Navigate directly to /dashboard | Redirect to /login | Critical |

**Selectors**:
```typescript
const selectors = {
  emailInput: 'input[name="email"]',
  passwordInput: 'input[name="password"]',
  submitButton: 'button[type="submit"]',
  errorAlert: '[data-testid="login-error"]',
  userMenu: '[data-testid="user-menu"]',
  logoutButton: '[data-testid="logout-btn"]',
};
```

---

### 3.2 Clients (12 tests)

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| CLI-01 | View client list | Navigate to /clients | Table displays clients with columns: Code, Name, Email, Projects | High |
| CLI-02 | Search clients | 1. Navigate to /clients<br>2. Type "TEST" in search | Only clients matching "TEST" shown | High |
| CLI-03 | Create client | 1. Click "Add Client"<br>2. Fill: code=NEWCLI, name=New Client<br>3. Submit | Client appears in list | High |
| CLI-04 | Create client validation | 1. Click "Add Client"<br>2. Submit empty form | Validation errors for required fields | Medium |
| CLI-05 | Edit client | 1. Click client row → Edit<br>2. Change name<br>3. Save | Name updated in list | High |
| CLI-06 | View client detail | Click client row | Detail page with tabs: Details, Contacts, Projects | High |
| CLI-07 | Add contact | 1. Open client detail<br>2. Go to Contacts tab<br>3. Click "Add Contact"<br>4. Fill form<br>5. Save | Contact appears in list | Medium |
| CLI-08 | Edit contact | 1. Click contact edit<br>2. Change email<br>3. Save | Email updated | Medium |
| CLI-09 | Delete contact | 1. Click contact delete<br>2. Confirm | Contact removed | Medium |
| CLI-10 | Set primary contact | Toggle "Primary" checkbox on contact | Only one primary contact at a time | Low |
| CLI-11 | Soft delete client | 1. Click client actions → Delete<br>2. Confirm | Client removed from list | Medium |
| CLI-12 | Pagination | 1. Have >10 clients<br>2. Click "Next" | Second page displayed | Low |

**Component Files**:
- `src/components/clients/client-form.tsx`
- `src/components/clients/client-list.tsx`
- `src/components/clients/contact-dialog.tsx`
- `src/components/clients/contact-list.tsx`

**Selectors**:
```typescript
const selectors = {
  searchInput: '[data-testid="client-search"]',
  addButton: '[data-testid="client-add-btn"]',
  table: '[data-testid="client-list-table"]',
  row: (id: string) => `[data-testid="client-row-${id}"]`,
  codeInput: '#code',
  nameInput: '#name',
  submitButton: 'button[type="submit"]',
  contactDialog: '[data-testid="contact-dialog"]',
  pagination: {
    prev: '[data-testid="pagination-prev"]',
    next: '[data-testid="pagination-next"]',
  },
};
```

---

### 3.3 Projects (16 tests)

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| PRJ-01 | View project list | Navigate to /projects | Table with projects displayed | High |
| PRJ-02 | Search projects | Type in search input | Filtered results | High |
| PRJ-03 | Filter by status | Select "Active" from dropdown | Only active projects shown | Medium |
| PRJ-04 | Create project | 1. Click "Add Project"<br>2. Select client<br>3. Fill name<br>4. Submit | Project created with auto-code (CLIENT-001) | High |
| PRJ-05 | Edit project | Change name, save | Changes persisted | High |
| PRJ-06 | View project tabs | Open detail page | 4 tabs: Details, Team, Tasks, Billing Roles | High |
| PRJ-07 | Add team member | 1. Go to Team tab<br>2. Click Add<br>3. Select user<br>4. Save | Member appears in list | High |
| PRJ-08 | Assign billing role | Select role for team member | Role displayed next to member | Medium |
| PRJ-09 | Remove team member | Click remove, confirm | Member removed | Medium |
| PRJ-10 | Create task | 1. Go to Tasks tab<br>2. Click Add<br>3. Enter name<br>4. Save | Task created with auto-code T001 | High |
| PRJ-11 | Edit task | Change description, save | Updated | Medium |
| PRJ-12 | Delete task | Click delete, confirm | Task removed | Medium |
| PRJ-13 | Create billing role | 1. Go to Billing Roles tab<br>2. Enter name + rate<br>3. Save | Role in list | High |
| PRJ-14 | Edit billing role | Change rate, save | Rate updated | Medium |
| PRJ-15 | Delete billing role (blocked) | Try to delete role assigned to member | Error: "Role is in use" | Medium |
| PRJ-16 | Delete billing role (allowed) | Delete role not in use | Role removed | Medium |

**Component Files**:
- `src/components/projects/project-form.tsx`
- `src/components/projects/project-list.tsx`
- `src/components/projects/team-list.tsx`
- `src/components/projects/team-member-dialog.tsx`
- `src/components/projects/task-list.tsx`
- `src/components/projects/task-dialog.tsx`
- `src/components/projects/billing-role-list.tsx`
- `src/components/projects/billing-role-dialog.tsx`

**Selectors**:
```typescript
const selectors = {
  searchInput: '[data-testid="project-search"]',
  statusFilter: '[data-testid="project-status-filter"]',
  addButton: '[data-testid="project-add-btn"]',
  table: '[data-testid="project-list-table"]',
  clientSelect: '#client_id',
  nameInput: '#name',
  billingTypeSelect: '#billing_type',
  tabs: {
    details: '[data-testid="tab-details"]',
    team: '[data-testid="tab-team"]',
    tasks: '[data-testid="tab-tasks"]',
    billingRoles: '[data-testid="tab-billing-roles"]',
  },
};
```

---

### 3.4 Timesheets (15 tests)

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| TS-01 | View timesheet list | Navigate to /timesheets | "My Timesheets" tab active, list displayed | High |
| TS-02 | Navigate to current week | Click current week in list | Week entry page loads with correct dates | High |
| TS-03 | Navigate weeks | Click prev/next arrows | Correct week displayed | Medium |
| TS-04 | Add entry row | 1. Click "Add Entry"<br>2. Select project<br>3. Save | New row appears in grid | Critical |
| TS-05 | Enter hours | Type hours in Mon-Sun fields | Values auto-save | Critical |
| TS-06 | Edit entry hours | Change existing hours | Auto-saves (debounced) | High |
| TS-07 | Delete entry | Click delete on row, confirm | Row removed | High |
| TS-08 | Row total calculation | Enter hours across days | Row total updates automatically | High |
| TS-09 | Day total calculation | Multiple rows with hours | Column totals correct | High |
| TS-10 | Submit timesheet | Click "Submit" button | Status changes to "Submitted" | Critical |
| TS-11 | Cannot edit submitted | Try to type in submitted timesheet | Inputs are disabled | Critical |
| TS-12 | Copy previous week | Click "Copy Previous Week" | Entries duplicated from last week | Medium |
| TS-13 | Manager: View approvals | Click "Team Approvals" tab | Pending timesheets from direct reports | Critical |
| TS-14 | Manager: Approve | Click approve button | Status = Approved, disappears from queue | Critical |
| TS-15 | Manager: Reject | Click reject, enter reason | Status = Draft, employee notified | Critical |

**Component Files**:
- `src/components/timesheets/timesheet-grid.tsx`
- `src/components/timesheets/entry-row.tsx`
- `src/components/timesheets/entry-dialog.tsx`
- `src/components/timesheets/hour-input.tsx`
- `src/components/timesheets/week-picker.tsx`
- `src/components/timesheets/timesheet-actions.tsx`
- `src/components/timesheets/approval-queue.tsx`
- `src/components/timesheets/review-actions.tsx`

**Selectors**:
```typescript
const selectors = {
  tabs: {
    myTimesheets: '[data-testid="tab-my-timesheets"]',
    teamApprovals: '[data-testid="tab-team-approvals"]',
  },
  weekPicker: {
    prev: '[data-testid="week-prev"]',
    next: '[data-testid="week-next"]',
    display: '[data-testid="week-display"]',
  },
  grid: '[data-testid="timesheet-grid"]',
  addEntryBtn: '[data-testid="add-entry-btn"]',
  entryRow: (id: string) => `[data-testid="entry-row-${id}"]`,
  hourInput: (day: number) => `[data-testid="hour-input-${day}"]`,
  rowTotal: '[data-testid="row-total"]',
  dayTotals: '[data-testid="day-totals"]',
  submitBtn: '[data-testid="submit-btn"]',
  copyWeekBtn: '[data-testid="copy-week-btn"]',
  approvalQueue: '[data-testid="approval-queue"]',
  approveBtn: (id: string) => `[data-testid="approve-btn-${id}"]`,
  rejectBtn: (id: string) => `[data-testid="reject-btn-${id}"]`,
};
```

---

### 3.5 Expenses (14 tests)

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| EXP-01 | View expense list | Navigate to /expenses | "My Expenses" tab active | High |
| EXP-02 | Navigate to week | Click week row | Entry page loads | High |
| EXP-03 | Add expense entry | 1. Click "Add Expense"<br>2. Fill form<br>3. Save | Entry appears in grid | Critical |
| EXP-04 | Tax calculation | Enter quantity=1, unit_price=100 | Subtotal=$100, GST=$5, QST=$9.98, Total=$114.98 | Critical |
| EXP-05 | Edit expense | Change description, save | Updated | High |
| EXP-06 | Delete expense | Click delete, confirm | Entry removed | High |
| EXP-07 | Mark billable | Toggle billable checkbox | Flag saved, shown in grid | Medium |
| EXP-08 | Week total | Multiple entries | Total correct (sum of all entries) | High |
| EXP-09 | Submit expense | Click "Submit" | Status = Submitted | Critical |
| EXP-10 | Cannot edit submitted | Try to edit submitted expense | Inputs disabled | Critical |
| EXP-11 | Copy previous week | Click "Copy Previous Week" | Entries duplicated | Medium |
| EXP-12 | Manager: View approvals | Click "Team Approvals" tab | Pending expenses shown | Critical |
| EXP-13 | Manager: Approve | Click approve | Status = Approved | Critical |
| EXP-14 | Manager: Reject | Reject with reason | Status = Draft | Critical |

**Component Files**:
- `src/components/expenses/expense-list.tsx`
- `src/components/expenses/expense-grid.tsx`
- `src/components/expenses/entry-dialog.tsx`
- `src/components/expenses/expense-actions.tsx`
- `src/components/expenses/approval-queue.tsx`

**Selectors**:
```typescript
const selectors = {
  tabs: {
    myExpenses: '[data-testid="tab-my-expenses"]',
    teamApprovals: '[data-testid="tab-team-approvals"]',
  },
  addExpenseBtn: '[data-testid="add-expense-btn"]',
  entryDialog: '[data-testid="expense-entry-dialog"]',
  expenseTypeSelect: '#expense_type_id',
  projectSelect: '#project_id',
  quantityInput: '#quantity',
  unitPriceInput: '#unit_price',
  billableCheckbox: '#is_billable',
  subtotalDisplay: '[data-testid="subtotal"]',
  gstDisplay: '[data-testid="gst-amount"]',
  qstDisplay: '[data-testid="qst-amount"]',
  totalDisplay: '[data-testid="total"]',
  submitBtn: '[data-testid="submit-btn"]',
  approvalQueue: '[data-testid="expense-approval-queue"]',
};
```

---

### 3.6 Invoices (18 tests)

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| INV-01 | View invoice list | Navigate to /invoices | List with summary cards (Draft, Outstanding, Paid) | High |
| INV-02 | Filter by status | Select "Draft" | Only draft invoices shown | Medium |
| INV-03 | Filter by client | Select client | Only that client's invoices | Medium |
| INV-04 | Filter by year | Select 2026 | Only 2026 invoices | Low |
| INV-05 | Wizard Step 1 | 1. Click "New Invoice"<br>2. Select client<br>3. Select project | "Next" button enabled | Critical |
| INV-06 | Wizard Step 2 | 1. Set date range<br>2. Select timesheet entries | Entries checked, total displayed | Critical |
| INV-07 | Wizard Step 3 | Review totals | Tax calculated correctly per client settings | Critical |
| INV-08 | Create draft | Click "Save as Draft" | Invoice in list with status "Draft" | Critical |
| INV-09 | Edit draft | Change dates/notes, save | Changes persisted | High |
| INV-10 | Add manual line | Add line item manually | Line appears in invoice | Medium |
| INV-11 | Download PDF | Click "Download PDF" | PDF file downloads | High |
| INV-12 | Send invoice dialog | Click "Send" | Dialog shows email preview | High |
| INV-13 | Send invoice | Confirm send | Status = Sent, email record created | Critical |
| INV-14 | Email history | View sent invoice detail | Email history shown | Medium |
| INV-15 | Mark paid | Click "Mark Paid" | Status = Paid | High |
| INV-16 | Cancel invoice | Click "Cancel", confirm | Status = Void | Medium |
| INV-17 | Delete draft | Click "Delete", confirm | Invoice removed | Medium |
| INV-18 | Timesheet locking | Send invoice | Linked timesheets status = Locked | Critical |

**Component Files**:
- `src/components/invoices/invoice-list.tsx`
- `src/components/invoices/invoice-wizard.tsx`
- `src/components/invoices/step-select-project.tsx`
- `src/components/invoices/step-select-entries.tsx`
- `src/components/invoices/step-review.tsx`
- `src/components/invoices/invoice-actions.tsx`
- `src/components/invoices/send-invoice-dialog.tsx`
- `src/components/invoices/email-history.tsx`
- `src/components/invoices/invoice-pdf.tsx`

**Selectors**:
```typescript
const selectors = {
  summaryCards: {
    draft: '[data-testid="summary-draft"]',
    outstanding: '[data-testid="summary-outstanding"]',
    paid: '[data-testid="summary-paid"]',
  },
  filters: {
    search: '[data-testid="invoice-search"]',
    client: '[data-testid="invoice-client-filter"]',
    status: '[data-testid="invoice-status-filter"]',
    year: '[data-testid="invoice-year-filter"]',
  },
  newInvoiceBtn: '[data-testid="new-invoice-btn"]',
  wizard: {
    step: (n: number) => `[data-testid="wizard-step-${n}"]`,
    clientSelect: '[data-testid="wizard-client-select"]',
    projectSelect: '[data-testid="wizard-project-select"]',
    nextBtn: '[data-testid="wizard-next-btn"]',
    backBtn: '[data-testid="wizard-back-btn"]',
    saveDraftBtn: '[data-testid="wizard-save-draft-btn"]',
    createBtn: '[data-testid="wizard-create-btn"]',
  },
  actions: {
    download: '[data-testid="action-download-pdf"]',
    send: '[data-testid="action-send"]',
    markPaid: '[data-testid="action-mark-paid"]',
    cancel: '[data-testid="action-cancel"]',
    delete: '[data-testid="action-delete"]',
  },
  sendDialog: '[data-testid="send-invoice-dialog"]',
  emailHistory: '[data-testid="email-history"]',
};
```

---

### 3.7 Reports (9 tests)

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| RPT-01 | Timesheet report load | Navigate to /reports/timesheets | Report data displayed | High |
| RPT-02 | Date range filter | Select "This Month" preset | Data filtered to current month | High |
| RPT-03 | Project filter | Select specific project | Only that project's data | Medium |
| RPT-04 | Export timesheet CSV | Click "Export" | CSV file downloads | High |
| RPT-05 | Invoice report load | Navigate to /reports/invoices | Aging buckets displayed | High |
| RPT-06 | Invoice aging correct | Check aging categories | Correct: 0-30, 31-60, 61-90, 90+ days | High |
| RPT-07 | Export invoice CSV | Click "Export" | CSV file downloads | High |
| RPT-08 | Profitability report | Navigate to /reports/profitability | P&L data with margins | High |
| RPT-09 | Export profitability CSV | Click "Export" | CSV file downloads | High |

**Component Files**:
- `src/components/reports/report-filters.tsx`
- `src/components/reports/report-export-button.tsx`
- `src/components/reports/timesheet-report.tsx`
- `src/components/reports/invoice-report.tsx`
- `src/components/reports/profitability-report.tsx`

**Selectors**:
```typescript
const selectors = {
  filters: {
    presets: {
      thisWeek: '[data-testid="preset-this-week"]',
      lastWeek: '[data-testid="preset-last-week"]',
      thisMonth: '[data-testid="preset-this-month"]',
      lastMonth: '[data-testid="preset-last-month"]',
      thisQuarter: '[data-testid="preset-this-quarter"]',
      thisYear: '[data-testid="preset-this-year"]',
    },
    startDate: '[data-testid="start-date-input"]',
    endDate: '[data-testid="end-date-input"]',
    project: '[data-testid="report-project-filter"]',
    user: '[data-testid="report-user-filter"]',
    client: '[data-testid="report-client-filter"]',
    clearBtn: '[data-testid="clear-filters-btn"]',
  },
  exportBtn: '[data-testid="export-btn"]',
  reportTable: '[data-testid="report-table"]',
  agingBuckets: {
    current: '[data-testid="aging-0-30"]',
    days30to60: '[data-testid="aging-31-60"]',
    days60to90: '[data-testid="aging-61-90"]',
    over90: '[data-testid="aging-90-plus"]',
  },
};
```

---

### 3.8 Dashboard (5 tests)

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| DASH-01 | Stats cards load | Navigate to /dashboard | 4 stat cards visible | High |
| DASH-02 | Open timesheets count | Check card value | Matches DB count of draft timesheets | High |
| DASH-03 | Outstanding amount | Check card value | Matches sum of sent invoices | High |
| DASH-04 | Active projects count | Check card value | Matches DB count | Medium |
| DASH-05 | Activity feed | Scroll activity section | Recent items from timesheets, expenses, invoices | Medium |

**Component Files**:
- `src/components/dashboard/stats-cards.tsx`
- `src/components/dashboard/recent-activity.tsx`

**Selectors**:
```typescript
const selectors = {
  cards: {
    openTimesheets: '[data-testid="stat-open-timesheets"]',
    hoursThisWeek: '[data-testid="stat-hours-this-week"]',
    outstanding: '[data-testid="stat-outstanding"]',
    activeProjects: '[data-testid="stat-active-projects"]',
  },
  activityFeed: '[data-testid="activity-feed"]',
  activityItem: '[data-testid="activity-item"]',
};
```

---

### 3.9 Admin (14 tests)

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| ADM-01 | View user list | Navigate to /admin/users | Users displayed in table | High |
| ADM-02 | Search users | Type name in search | Filtered results | Medium |
| ADM-03 | Filter by role | Select role from dropdown | Only that role shown | Medium |
| ADM-04 | Filter inactive | Toggle "Show Inactive" | Inactive users visible | Low |
| ADM-05 | Edit user | Change role, save | Role updated | High |
| ADM-06 | Assign manager | Select manager from dropdown | Manager saved | Medium |
| ADM-07 | Toggle active | Click toggle, confirm | Status changed | Medium |
| ADM-08 | Send password reset | Click "Send Reset", confirm | Success message shown | High |
| ADM-09 | View roles page | Navigate to /admin/roles | Permissions matrix displayed | Medium |
| ADM-10 | Permissions matrix | Check role permissions | Checkmarks match role permissions | Medium |
| ADM-11 | Company settings | Edit company name, save | Name updated | High |
| ADM-12 | Upload logo | Select file, upload | Logo displayed in settings | Medium |
| ADM-13 | Delete logo | Click delete logo | Logo removed | Low |
| ADM-14 | Audit logs | Navigate to /admin/logs | Logs displayed with filters | High |

**Component Files**:
- `src/components/admin/user-list.tsx`
- `src/components/admin/user-form.tsx`
- `src/components/admin/role-permissions-matrix.tsx`
- `src/components/admin/company-settings-form.tsx`
- `src/components/admin/audit-log-list.tsx`
- `src/components/admin/audit-log-detail.tsx`

**Selectors**:
```typescript
const selectors = {
  users: {
    searchInput: '[data-testid="user-search"]',
    roleFilter: '[data-testid="user-role-filter"]',
    showInactive: '[data-testid="show-inactive"]',
    table: '[data-testid="user-list"]',
    row: (id: string) => `[data-testid="user-row-${id}"]`,
  },
  userForm: {
    firstName: '#first_name',
    lastName: '#last_name',
    roleSelect: '#role_id',
    managerSelect: '#manager_id',
    isActive: '#is_active',
    passwordResetBtn: '[data-testid="password-reset-btn"]',
    submitBtn: '[data-testid="user-submit-btn"]',
  },
  roles: {
    matrix: '[data-testid="permissions-matrix"]',
    roleHeader: (name: string) => `[data-testid="role-${name}"]`,
    permission: (role: string, perm: string) => `[data-testid="perm-${role}-${perm}"]`,
  },
  settings: {
    nameInput: '#name',
    addressInput: '#address',
    logoUpload: '[data-testid="logo-upload"]',
    logoPreview: '[data-testid="logo-preview"]',
    deleteLogo: '[data-testid="delete-logo"]',
    submitBtn: '[data-testid="settings-submit-btn"]',
  },
  logs: {
    table: '[data-testid="audit-logs"]',
    actionFilter: '[data-testid="log-action-filter"]',
    entityFilter: '[data-testid="log-entity-filter"]',
    userFilter: '[data-testid="log-user-filter"]',
    dateFrom: '[data-testid="log-date-from"]',
    dateTo: '[data-testid="log-date-to"]',
    detailModal: '[data-testid="log-detail-modal"]',
  },
};
```

---

### 3.10 i18n (6 tests)

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| I18N-01 | Default French | Load app fresh | UI in French (default locale) | High |
| I18N-02 | Switch to English | Click language toggle → English | UI changes to English | High |
| I18N-03 | Switch to French | Click language toggle → Français | UI changes to French | High |
| I18N-04 | Persist language | 1. Switch to English<br>2. Refresh page | Still in English | High |
| I18N-05 | Client form French | Open client form in French | All labels in French | Medium |
| I18N-06 | Invoice PDF French | Generate PDF in French | French text in PDF | Medium |

**Selectors**:
```typescript
const selectors = {
  languageToggle: '[data-testid="language-toggle"]',
  languageOption: (locale: string) => `[data-testid="lang-${locale}"]`,
  // Use visible text assertions for language verification
};
```

---

## 4. Implementation Priority

### Priority 1: Critical Path (Week 1)
*Must pass for basic functionality*

| Module | Tests | Reason |
|--------|-------|--------|
| Auth | AUTH-01 to AUTH-05 | Cannot test anything without login |
| Timesheets | TS-04, TS-05, TS-10, TS-14, TS-15 | Core business process |
| Invoices | INV-05 to INV-08, INV-11, INV-13 | Revenue generation |

### Priority 2: Core CRUD (Week 2)
*Essential data management*

| Module | Tests | Reason |
|--------|-------|--------|
| Clients | CLI-01 to CLI-07 | Foundation data |
| Projects | PRJ-01 to PRJ-10 | Required for timesheets |
| Expenses | EXP-01 to EXP-09 | Parallel to timesheets |

### Priority 3: Features (Week 3)
*Complete coverage*

| Module | Tests | Reason |
|--------|-------|--------|
| Reports | RPT-01 to RPT-09 | Business intelligence |
| Dashboard | DASH-01 to DASH-05 | User experience |
| Admin | ADM-01 to ADM-14 | System management |
| i18n | I18N-01 to I18N-06 | Localization |

---

## 5. Test Execution

### 5.1 Commands

```bash
# Install Playwright
npm install -D @playwright/test
npx playwright install

# Run all tests
npx playwright test

# Run specific module
npx playwright test tests/e2e/auth/
npx playwright test tests/e2e/timesheets/

# Run in headed mode (visible browser)
npx playwright test --headed

# Run specific test by ID
npx playwright test -g "AUTH-01"

# Generate report
npx playwright show-report
```

### 5.2 CI Integration

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on:
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### 5.3 Success Criteria

| Metric | Target |
|--------|--------|
| Pass Rate | 100% |
| Test Duration | < 5 minutes |
| Flaky Tests | 0 |
| Console Errors | 0 |

### 5.4 Debugging Failed Tests

1. **Screenshots**: Auto-captured on failure in `test-results/`
2. **Traces**: Run with `--trace on` for step-by-step replay
3. **Videos**: Enabled on first retry
4. **Debug Mode**: `npx playwright test --debug`

---

## Appendix: Test Count Summary

| Module | Tests |
|--------|-------|
| Authentication | 5 |
| Clients | 12 |
| Projects | 16 |
| Timesheets | 15 |
| Expenses | 14 |
| Invoices | 18 |
| Reports | 9 |
| Dashboard | 5 |
| Admin | 14 |
| i18n | 6 |
| **TOTAL** | **114** |

---

## Appendix: Excluded from Automated Testing

| Area | Reason | Alternative |
|------|--------|-------------|
| Email delivery | External service (Resend) | Mock API, verify DB record |
| PDF visual content | Complex verification | Check download only |
| Password reset flow | Supabase Auth external | Manual testing |
| Browser compatibility | Time consuming | Run Chromium primary |

---

*Document Version: 1.0*
*Last Updated: 2026-02-24*
*Author: Claude Code (Session 19)*
