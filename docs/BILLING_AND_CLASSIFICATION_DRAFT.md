# Billing Model & CCQ Classification System — Design Draft

**Status**: DRAFT v2 — incorporating owner input on rate tiers + apprenti progression
**Date**: 2026-03-12 (v2), 2026-03-11 (v1)
**App**: Systemes Interieurs Grand Canyon (interior systems: drywall, acoustic ceilings, painting, joints)
**Company size**: 15-40 employees

### Owner Input (2026-03-12)
- **Rate tiers confirmed**: A ($89/hr compagnon), B ($86 closer clients), Custom ($84 one client)
- **Apprenti progression**: Track hours → auto-detect level change → adjust rate AND salary
- **Future auto-tiering**: Promote/demote client tiers based on hours YTD, payment speed, or mix
- **Scalability**: Design for other construction businesses, not just GC
- **Billing methods**: Hourly is primary (~98%), keep others for broader market

---

## Table of Contents

- [Part 1: Billing Model](#part-1-billing-model)
  - [1.1 Current Schema Analysis](#11-current-schema-analysis)
  - [1.2 Problems & Gaps](#12-problems--gaps)
  - [1.3 Proposed Schema Changes](#13-proposed-schema-changes)
  - [1.4 Rate Hierarchy](#14-rate-hierarchy)
  - [1.5 Billing Workflows by Type](#15-billing-workflows-by-type)
  - [1.6 Retainage / Holdback](#16-retainage--holdback)
  - [1.7 Impact on Timesheet Entry](#17-impact-on-timesheet-entry)
  - [1.8 Impact on Invoice Generation](#18-impact-on-invoice-generation)
  - [1.9 Migration Plan](#19-migration-plan)
- [Part 2: CCQ Classification System](#part-2-ccq-classification-system)
  - [2.1 Current State](#21-current-state)
  - [2.2 CCQ Background](#22-ccq-background)
  - [2.3 Proposed Schema](#23-proposed-schema)
  - [2.4 Rate Structure](#24-rate-structure)
  - [2.5 Classification History & Progression](#25-classification-history--progression)
  - [2.6 Connection to Billing](#26-connection-to-billing)
  - [2.7 Card Expiry Tracking](#27-card-expiry-tracking)
  - [2.8 UI Concepts](#28-ui-concepts)
  - [2.9 Migration Plan](#29-migration-plan)
- [Open Questions](#open-questions)

---

# Part 1: Billing Model

## 1.1 Current Schema Analysis

### Existing Tables

**`projects`** — main project record
| Column | Type | Notes |
|--------|------|-------|
| `billing_type` | enum: `hourly`, `fixed`, `per_unit` | Mapped from legacy H/F/P |
| `hourly_rate` | numeric | Project-level default hourly rate |
| `fixed_price` | numeric | Total fixed price (for `fixed` type) |
| `per_unit_rate` | numeric | Rate per unit (for `per_unit` type) |
| `default_billing_role_id` | FK → project_billing_roles | Default role for new members |

**`project_billing_roles`** — per-project billing roles
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `project_id` | FK → projects | |
| `name` | text | e.g., "Journalier", "Apprenti 1", "Compagnon" |
| `rate` | numeric | Hourly billing rate to client |

**`project_members`** — employees assigned to projects
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | FK → profiles | |
| `project_id` | FK → projects | |
| `billing_role_id` | FK → project_billing_roles | Which rate applies |

**`timesheet_entries`** — individual time entries
| Column | Type | Notes |
|--------|------|-------|
| `hours` | numeric[] | 7-element array (Mon-Sun) |
| `billing_role_id` | FK → project_billing_roles | Rate at time of entry |
| `is_billable` | boolean | |

**`invoices`** — generated invoices
| Column | Type | Notes |
|--------|------|-------|
| `subtotal` | numeric | Before taxes |
| `gst_amount` | numeric | 5% GST |
| `qst_amount` | numeric | 9.975% QST (compound) |
| `total` | numeric | |
| `period_start` / `period_end` | date | Billing period |

**`invoice_lines`** — line items
| Column | Type | Notes |
|--------|------|-------|
| `description` | text | e.g., "Journalier - Jean Tremblay (Week of 2026-02-24)" |
| `quantity` | numeric | Hours |
| `unit_price` | numeric | Rate |
| `amount` | numeric | quantity x unit_price |
| `timesheet_entry_id` | FK → timesheet_entries | Link to source |

### Legacy Data Insights (from raw migration data)

- **5,291 projects** were Hourly (H), **112** were Fixed (F), **1** was Per-unit (P)
- Billing roles are highly inconsistent in naming: "apprenti", "Apprenti", "apprenti 1", "apprenti-1", "Apprenti 1er", "Apprentie 1er annee" all mean the same thing
- Rates range from $39-$93/hr for regular time, $109-$170/hr for overtime roles (named "Temps double", "Temps et demi")
- Some roles are hacks: rates of $0, $1, $300, $500, $9999.99 suggest workarounds
- Overtime was handled by creating separate billing roles (e.g., "Compagnon Temps Double" at 2x rate) rather than a proper overtime system

### Current Invoice Flow

```
Timesheets → Approve → Invoice Wizard
  Step 1: Select client + project
  Step 2: Select approved timesheet entries (by period)
  Step 3: Review lines (grouped by billing_role + user), set dates → Create

Invoice lines: "{RoleName} - {EmployeeName} (Week of {date})"
  quantity = sum of hours, unit_price = billing_role.rate
```

## 1.2 Problems & Gaps

| # | Problem | Impact |
|---|---------|--------|
| 1 | **No billing phases** — A project can only have one `billing_type` | Can't handle "demo at hourly, finish at fixed" |
| 2 | **No change orders** — No way to add fixed-price extras to a T&M project | Workaround: manual invoice lines (error-prone) |
| 3 | **No unit tracking** — `per_unit` type exists but there's no UI or table to record units completed | Per-unit billing is unusable |
| 4 | **No retainage/holdback** — Standard 10% in Quebec construction | Manual tracking outside system |
| 5 | **No progress billing** — Fixed-price projects need % complete or milestone billing | No way to partially bill a fixed-price project |
| 6 | **Overtime as separate roles** — "Compagnon Temps Double" is a separate role, not a multiplier | Role explosion, inconsistent naming, no real OT tracking |
| 7 | **No rate history** — When a billing role rate changes, all future AND historical calculations use new rate | Can't audit what rate was in effect when |
| 8 | **No client-negotiated rates** — Rate hierarchy is flat (just project_billing_roles.rate) | No distinction between company standard rate and client-specific rate |

## 1.3 Proposed Schema Changes

### New Tables

#### `billing_phases`
Allows a project to have multiple billing phases, each with its own type and rules.

```sql
CREATE TABLE billing_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  name text NOT NULL,                    -- "Phase 1 - Demo", "Phase 2 - Finish"
  billing_type project_billing_type NOT NULL, -- hourly, fixed, per_unit
  fixed_price numeric,                   -- for fixed phases
  per_unit_rate numeric,                 -- for per_unit phases
  unit_label text,                       -- "pi lin", "pi2", "feuille", etc.
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**[DECISION NEEDED]**: Do we need billing phases at all for v1? Or can we get by with:
- Project = one billing type (the common case)
- Change orders as a separate mechanism (see below)

If most projects are simple hourly, phases might be over-engineering for a 15-40 person company. We could start with change orders only and add phases later.

#### `change_orders`
Track scope changes with their own pricing, independent of the project's base billing type.

```sql
CREATE TABLE change_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  code text NOT NULL,                    -- "CO-001", auto-generated per project
  title text NOT NULL,                   -- "Additional drywall work - 3rd floor"
  description text,
  billing_type project_billing_type NOT NULL,
  fixed_price numeric,                   -- if fixed
  per_unit_rate numeric,                 -- if per_unit
  unit_label text,
  estimated_hours numeric,               -- for hourly, optional estimate
  status text NOT NULL DEFAULT 'pending',-- pending, approved, completed, cancelled
  approved_at timestamptz,
  approved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enum for change order status
-- [DECISION NEEDED]: Use enum or text + check constraint?
```

#### `unit_entries`
Track per-unit work completed. Could also be used for fixed-price progress tracking.

```sql
CREATE TABLE unit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  change_order_id uuid REFERENCES change_orders(id), -- null = base scope
  entry_date date NOT NULL,
  quantity numeric NOT NULL,             -- units completed
  unit_label text NOT NULL,              -- "pi lin", "pi2", etc.
  location text,                         -- "3rd floor east wing"
  entered_by uuid NOT NULL REFERENCES profiles(id),
  notes text,
  created_at timestamptz DEFAULT now()
);
```

#### `billing_rate_history`
Track rate changes for audit purposes. When a billing role rate changes, record the old rate.

```sql
CREATE TABLE billing_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_role_id uuid NOT NULL REFERENCES project_billing_roles(id),
  rate numeric NOT NULL,
  effective_from date NOT NULL,
  effective_to date,                     -- null = current rate
  changed_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
```

#### `rate_tiers` *(NEW — replaces flat rate hierarchy)*
Named pricing tables that define what a client is charged per classification/period.
Replaces the ad-hoc project_billing_roles naming and the "Rate Template System" concept.

```sql
CREATE TABLE rate_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                    -- "Standard", "Preferred", "Custom - Béton Plus"
  code text NOT NULL UNIQUE,             -- "A", "B", "CUSTOM-BETON-PLUS"
  description text,
  is_default boolean DEFAULT false,      -- only one can be default (Tier A)
  is_active boolean DEFAULT true,
  auto_rules jsonb,                      -- future: { min_ytd_hours: 500, max_avg_payment_days: 30 }
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Current Grand Canyon rate tiers:
-- A "Standard"  → $89/hr compagnon (default, most clients)
-- B "Preferred" → $86/hr (closer/loyal clients)
-- Custom per-client (e.g., $84/hr for one specific client)
```

#### `rate_tier_lines`
Per-classification/period rates within a tier. When an apprenti advances, the new rate
is looked up automatically from the tier line matching their new classification.

```sql
CREATE TABLE rate_tier_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id uuid NOT NULL REFERENCES rate_tiers(id),
  classification_id uuid NOT NULL REFERENCES ccq_classifications(id),
  hourly_rate numeric NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (tier_id, classification_id, effective_date)
);

-- Example: Tier A (Standard) lines for Platrier trade
-- tier_id = :tier_a
-- Platrier Apprenti 1  → $62.00
-- Platrier Apprenti 2  → $72.00
-- Platrier Apprenti 3  → $78.00
-- Platrier Compagnon    → $89.00
```

#### `client_rate_tiers`
Assigns a rate tier to a client. A client with no assignment uses the default tier (A).

```sql
CREATE TABLE client_rate_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id),
  tier_id uuid NOT NULL REFERENCES rate_tiers(id),
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES profiles(id),
  notes text,                            -- "Volume discount for 2026"
  UNIQUE (client_id)                     -- one tier per client
);
```

#### `project_rate_overrides`
Per-project rate exceptions that override the client's tier for specific classifications.

```sql
CREATE TABLE project_rate_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  classification_id uuid REFERENCES ccq_classifications(id), -- null = all classifications
  hourly_rate numeric NOT NULL,
  reason text,                           -- "Negotiated for this contract"
  created_at timestamptz DEFAULT now(),
  UNIQUE (project_id, classification_id)
);
```

### Modified Tables

#### `projects` — add retainage fields
```sql
ALTER TABLE projects ADD COLUMN retainage_percent numeric DEFAULT 0;  -- 0-100
ALTER TABLE projects ADD COLUMN retainage_amount numeric DEFAULT 0;   -- running total held
ALTER TABLE projects ADD COLUMN retainage_released numeric DEFAULT 0; -- total released
```

**[RESOLVED — B3/B4]**: Retainage on subtotal (QC standard). Owner doesn't currently
use retainage — bills full amount, client holds informally until job release. Feature
is opt-in (retainage_percent defaults to 0). Low priority for v1 — schema ready, UI deferred.

#### `invoices` — add retainage and type tracking
```sql
ALTER TABLE invoices ADD COLUMN retainage_amount numeric DEFAULT 0;
ALTER TABLE invoices ADD COLUMN retainage_released numeric DEFAULT 0;
ALTER TABLE invoices ADD COLUMN is_retainage_release boolean DEFAULT false;
ALTER TABLE invoices ADD COLUMN change_order_id uuid REFERENCES change_orders(id);
ALTER TABLE invoices ADD COLUMN billing_phase_id uuid REFERENCES billing_phases(id);
```

#### `invoice_lines` — add unit entry link
```sql
ALTER TABLE invoice_lines ADD COLUMN unit_entry_id uuid REFERENCES unit_entries(id);
ALTER TABLE invoice_lines ADD COLUMN change_order_id uuid REFERENCES change_orders(id);
```

#### `timesheet_entries` — add change order link
```sql
ALTER TABLE timesheet_entries ADD COLUMN change_order_id uuid REFERENCES change_orders(id);
```

This allows time to be logged against a specific change order, so it can be billed separately.

### Schema Diagram (Simplified)

```
projects
  ├── billing_phases[]          (optional, for multi-phase)
  ├── change_orders[]           (extras / scope changes)
  ├── project_billing_roles[]   (rate cards)
  │     └── billing_rate_history[]
  ├── project_members[]
  │     └── billing_role_id → project_billing_roles
  ├── timesheet_entries[]
  │     ├── billing_role_id → project_billing_roles
  │     └── change_order_id → change_orders (optional)
  ├── unit_entries[]
  │     └── change_order_id → change_orders (optional)
  └── invoices[]
        ├── invoice_lines[]
        │     ├── timesheet_entry_id
        │     └── unit_entry_id
        ├── retainage_amount
        └── change_order_id (optional)
```

## 1.4 Rate Hierarchy

**RESOLVED** (owner input 2026-03-12): Full 5-level hierarchy with Rate Schedules.

Rates flow from general to specific. The most specific rate wins.

```
Level 1: CCQ Base Rate (regulatory minimum — COST floor)
   │  e.g., Compagnon platrier: $42.78/hr (2025-2026)
   │  Stored in: ccq_rates
   │  Purpose: payroll minimum, margin calculation
   │
Level 2: Company Standard Rate = Rate Schedule "A" (default)
   │  e.g., Compagnon platrier billed at $89/hr
   │  Stored in: rate_tiers + rate_tier_lines
   │  Purpose: default billing rate for most clients
   │
Level 3: Client Tier Rate (Palier tarifaire)
   │  e.g., Tier B client → Compagnon at $86/hr
   │  e.g., Custom tier → Compagnon at $84/hr
   │  Stored in: client_rate_tiers → rate_tier_lines
   │  Purpose: relationship/volume pricing
   │
Level 4: Project-Specific Override
   │  e.g., This project negotiated Compagnon at $82/hr
   │  Stored in: project_rate_overrides
   │  Purpose: per-contract negotiation
   │
Level 5: Change Order Override
      e.g., Change order premium at $95/hr
      Stored in: change_orders (rate fields)
      Purpose: scope change pricing
```

### Rate Resolution Logic

```typescript
function resolveHourlyRate(
  employeeClassificationId: string,
  projectId: string,
  changeOrderId: string | null
): number {
  // Level 5: Change order override
  if (changeOrderId) {
    const coRate = getChangeOrderRate(changeOrderId, employeeClassificationId)
    if (coRate) return coRate
  }

  // Level 4: Project-specific override
  const projectOverride = getProjectRateOverride(projectId, employeeClassificationId)
  if (projectOverride) return projectOverride

  // Level 3.5: Employee rate override (learning phase, temp discounts)
  const employeeOverride = getEmployeeRateOverride(employeeId, employeeClassificationId)
  if (employeeOverride) return employeeOverride

  // Level 3: Client's rate tier
  const clientTier = getClientTier(projectId) // via project → client → tier
  if (clientTier) {
    const tierLine = getTierLine(clientTier.id, employeeClassificationId)
    if (tierLine) return tierLine.hourly_rate
  }

  // Level 2: Default tier (A)
  const defaultTier = getDefaultTier()
  const defaultLine = getTierLine(defaultTier.id, employeeClassificationId)
  if (defaultLine) return defaultLine.hourly_rate

  // Fallback: existing project_billing_roles.rate (backward compat during migration)
  return getProjectBillingRoleRate(projectId, employeeClassificationId)
}
```

### Current Grand Canyon Rate Tiers (Real Data)

**RESOLVED** (owner input 2026-03-12): Current pricing is non-uniform across levels.

| Tier | Code | Compagnon | App. 3 | App. 2 | App. 1 | Notes |
|------|------|-----------|--------|--------|--------|-------|
| Standard | A | $89.00 | $89.00* | $72.00 | $72.00 | *3rd year = compagnon rate |
| Preferred | B | $86.00 | $86.00* | $72.00 | $72.00 | *same pattern |
| Custom | C-xxx | $84.00 | varies | $72.00 | $72.00 | 1 client, 3rd year may differ |

**Key patterns from owner:**
- Apprenti 1 & 2 = flat $72/hr for most clients (regardless of period)
- Apprenti 3 = same as compagnon rate for most clients (treated as near-journeyman)
- ~1 client has 3rd year at a different rate than compagnon
- Fresh/brand new apprentices may be billed at $55-60 for first few weeks/months
  depending on skill level (temporary discount, not a permanent tier rate)
- Owner wants to move toward more predictable/structured pricing but can't change yet

**Design implication**: The rate tier model handles this well — just set the line values
per classification level. For the "all apprenti = $72" case, set App.1 = $72, App.2 = $72.
For "3rd year = compagnon", set App.3 = $89. The system doesn't care if values happen
to be the same across levels.

**[DECISION NEEDED — B19]**: How to handle the "fresh apprenti at $55-60 for first
few weeks" temporary discount? See Open Questions.

### Future: Auto-Tiering Rules

The `auto_rules` field on `rate_tiers` supports future auto-promotion:

```jsonc
// Tier B auto-promotion rules (future, not v1)
{
  "min_ytd_hours": 500,           // client must have 500+ hours billed this year
  "max_avg_payment_days": 30,     // average payment within 30 days
  "evaluation_period": "ytd",     // yearly evaluation cycle
  "action": "suggest"             // "suggest" (admin approves) or "auto" (immediate)
}
```

A monthly background job would evaluate clients against these rules and surface
promotion/demotion candidates in an admin dashboard. **Not for v1** — design schema
to support it, build the job later.

### Rate Schedule vs Rate Template vs Project Billing Role

The Rate Schedule system **supersedes** both the "Rate Template" concept and the flat
`project_billing_roles` approach:

| Old Concept | New Concept | What Changed |
|-------------|-------------|--------------|
| `billing_role_templates` (proposed) | `rate_tiers` + `rate_tier_lines` | Templates were naming-only. Schedules are full pricing tables per classification. |
| `project_billing_roles.rate` | `rate_tier_lines.hourly_rate` + `project_rate_overrides` | Rate source moves from project-level to tier-level. Project can still override. |
| Flat "Company rate" concept | Tier "A" (default) | The default tier IS the company standard rate. |
| No client-level rates | `client_rate_tiers` | Clients get assigned a tier. |

**[RESOLVED — B12]**: Employee carries their default classification. Rate is resolved from
employee classification + client tier. Project can override the employee's role (rare).
See "Employee-Carried Classification" model below in Open Questions.

## 1.5 Billing Workflows by Type

### Hourly (T&M) — Current Flow (98% of projects)

```
                   ┌─────────────┐
                   │  Employee    │
                   │  logs time   │
                   └──────┬──────┘
                          │
                   ┌──────▼──────┐
                   │  Timesheet  │  hours[] per project/role
                   │  submitted  │
                   └──────┬──────┘
                          │
                   ┌──────▼──────┐
                   │  Manager    │
                   │  approves   │
                   └──────┬──────┘
                          │
                   ┌──────▼──────┐
                   │  Invoice    │  Select entries → group by role/user
                   │  wizard     │  line: hours x billing_role.rate
                   └──────┬──────┘
                          │
                   ┌──────▼──────┐
                   │  Invoice    │  Subtotal → GST → QST (compound)
                   │  + taxes    │  - retainage (if applicable)
                   └─────────────┘
```

No changes needed to core flow. Additions:
- Optional retainage deduction line
- Optional change order grouping

### Fixed-Price (Forfait) — New Flow

```
                   ┌─────────────────┐
                   │  Set up project  │  fixed_price = $150,000
                   │  with milestones │  or progress billing schedule
                   └───────┬─────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼───┐  ┌────▼────┐  ┌────▼────┐
     │ Milestone  │  │ Monthly │  │ % Done  │
     │ billing    │  │ billing │  │ billing │
     └────────┬───┘  └────┬────┘  └────┬────┘
              │            │            │
              └────────────┼────────────┘
                           │
                   ┌───────▼──────┐
                   │  Admin sets  │  This period: 25% complete
                   │  progress %  │  Invoice = 25% x $150,000
                   └───────┬──────┘
                           │
                   ┌───────▼──────┐
                   │  Invoice:    │  "Progress billing - 25%"
                   │  $37,500     │  Less: previous billings
                   │  - retainage │  Less: 10% retainage
                   └──────────────┘
```

**[DECISION NEEDED]**: Milestone-based or percentage-based progress billing?

**Option A — Percentage-based (simpler)**:
- Admin enters cumulative % complete each billing period
- Invoice = (% complete x fixed_price) - previously billed - retainage

**Option B — Milestone-based**:
- Define milestones upfront (e.g., "Demolition complete" = 15%)
- Mark milestones as complete → auto-calculates invoice amount

**Recommendation**: Percentage-based for v1. Milestones are nice but require more setup.

#### Fixed-Price Progress Table

```sql
CREATE TABLE fixed_price_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  billing_phase_id uuid REFERENCES billing_phases(id),
  period_date date NOT NULL,             -- "as of" date
  percent_complete numeric NOT NULL,     -- 0-100, cumulative
  description text,                      -- "Drywall installation complete"
  entered_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT percent_range CHECK (percent_complete >= 0 AND percent_complete <= 100)
);
```

### Per-Unit (au pied) — New Flow

```
                   ┌─────────────────┐
                   │  Set up project  │  per_unit_rate = $X.XX / pi lin
                   │  with unit type  │  unit_label = "pieds lineaires"
                   └───────┬─────────┘
                           │
                   ┌───────▼──────┐
                   │  Workers     │  Record units daily/weekly
                   │  log units   │  "3rd floor east: 450 pi lin"
                   └───────┬──────┘
                           │
                   ┌───────▼──────┐
                   │  Manager     │  Review + approve units
                   │  approves    │  (similar to timesheet approval)
                   └───────┬──────┘
                           │
                   ┌───────▼──────┐
                   │  Invoice     │  units x per_unit_rate
                   │  generated   │  - retainage
                   └──────────────┘
```

**UI for unit entry**: Needs a new page/component — not part of timesheets.

**[DECISION NEEDED]**: Unit entry cadence?
- Daily (like timesheets)? Heavy for 1 project type.
- Weekly summary? Easier but less granular.
- Per-area/location? Most natural for construction ("3rd floor east wing done").
- Recommendation: weekly summary with optional location breakdown.

**[DECISION NEEDED]**: Does per-unit replace timesheets or run alongside?
- Workers still log time for payroll purposes even on per-unit projects
- Billing uses units, payroll uses hours
- Both exist in parallel — unit_entries for billing, timesheets for payroll

## 1.6 Retainage / Holdback

Quebec construction law (Code civil du Quebec + Loi sur les maitres electriciens / plombiers) requires:

- **10% holdback** standard on construction contracts
- Retained for **35 days** after project completion (or acceptance)
- Published in the Registre des droits personnels et reels mobiliers (RDPRM) for legal hypothec

### Implementation

```
Invoice subtotal:        $10,000.00
GST (5%):                  $500.00
QST (9.975% compound):    $1,047.38
Gross total:             $11,547.38
Retainage (10%):         -$1,000.00    ← on subtotal, before tax
Net payable:             $10,547.38

[DECISION NEEDED]: Retainage on subtotal or on total (incl. taxes)?
  Quebec practice: typically on subtotal (before taxes)
  But some GCs hold on the total. Need to confirm with company.
```

### Retainage Release

When project completes:
1. Admin marks project complete
2. 35-day timer starts (or custom hold period)
3. System generates retainage release invoice
4. Special invoice type: `is_retainage_release = true`

```sql
-- Example retainage release invoice
INSERT INTO invoices (
  project_id, client_id, invoice_number,
  subtotal, gst_amount, qst_amount, total,
  is_retainage_release, retainage_released
) VALUES (
  :project_id, :client_id, 'GC-2026-0150',
  10000, 500, 1047.38, 11547.38,
  true, 10000
);
```

**[DECISION NEEDED]**: Should the system auto-generate retainage release invoices or just alert the admin?

## 1.7 Impact on Timesheet Entry

### Current Timesheet Grid

```
| Project    | Role        | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Total |
|------------|-------------|-----|-----|-----|-----|-----|-----|-----|-------|
| PRJ-001    | Journalier  | 8   | 8   | 8   | 8   | 8   | 0   | 0   | 40    |
```

### Proposed Changes

1. **Add change order column** (optional):
   - If project has active change orders, show a CO dropdown
   - Default = base scope (null change_order_id)
   - Allows time to be attributed to a specific CO

2. **Per-unit projects**: Timesheets remain for hours tracking (payroll), but a separate "Unit Log" section appears for billing entries.

3. **Overtime handling** (future — see Part 2 CCQ rates for base rates):
   - System calculates OT based on weekly hours (>40hr = 1.5x, >50hr = 2x)
   - No more separate "Temps Double" billing roles
   - **[DECISION NEEDED]**: Auto-calculate OT billing rate, or keep manual OT roles?
   - Note: OT rules in Quebec construction are complex (sector-dependent). Manual may be safer for v1.

### Updated Timesheet Entry Schema

```typescript
// Addition to existing timesheetEntrySchema
const timesheetEntrySchemaV2 = z.object({
  // ... existing fields ...
  project_id: z.string().uuid(),
  billing_role_id: z.string().uuid().optional().nullable(),
  hours: hoursArraySchema,
  is_billable: z.boolean().default(true),

  // New fields
  change_order_id: z.string().uuid().optional().nullable(),
})
```

## 1.7b Company Billing Settings (Admin UI)

**Added** (owner input 2026-03-12): All business-configurable billing settings must be
adjustable from the GC admin settings page. Each business using the system should be
able to customize these without code changes.

### Settings Schema

```sql
-- Extend existing company_settings or create billing_settings
-- (stored as jsonb in company_settings, or a dedicated table)

-- Rate & Tier Defaults
default_rate_tier_id        uuid       -- which tier is the default (Tier A)
rate_tier_versioning        text       -- "annual_may" | "annual_jan" | "on_change"

-- Overtime Billing Defaults
ot_default_mode             text       -- "flat" | "standard" | "custom"
ot_standard_multiplier_1_5x numeric   -- default 1.5
ot_standard_multiplier_2x   numeric   -- default 2.0
ot_custom_multiplier_1_5x   numeric   -- business custom (e.g., 1.8 or 1.9)
ot_custom_multiplier_2x     numeric   -- business custom
ot_approval_default         text       -- "pre_approved" | "per_instance" | "never"

-- Retainage Defaults
retainage_default_percent   numeric   -- default 0 (GC doesn't use it)
retainage_on_subtotal       boolean   -- true = subtotal, false = total
retainage_hold_days         int       -- default 35 (QC standard)

-- Invoice Defaults
invoice_number_prefix       text       -- "GC-" or "FAC-"
invoice_tax_gst_rate        numeric   -- 5.0
invoice_tax_qst_rate        numeric   -- 9.975
invoice_default_payment_days int      -- 30

-- Learning Phase Defaults
learning_phase_default_weeks int      -- default duration for new hire overrides
learning_phase_alert_days    int      -- alert X days before expiry
```

### Admin Settings UI

```
┌─────────────────────────────────────────────────────────┐
│  Billing Settings                                       │
│                                                         │
│  Rate Tiers (Paliers tarifaires)                        │
│  Default tier: [Standard (A) ▼]                         │
│  Rate versioning: [Annual - May 1 ▼]                    │
│                                                         │
│  Overtime Billing                                       │
│  Default mode: [● Flat  ○ Standard  ○ Custom]           │
│  Standard: Time-and-half [1.5x]  Double [2.0x]         │
│  Custom:   Time-and-half [___x]  Double [___x]          │
│  Default approval: [Pre-approved ▼]                     │
│                                                         │
│  Retainage / Holdback                                   │
│  Default: [0] %   On: [● Subtotal ○ Total]             │
│  Hold period: [35] days                                 │
│                                                         │
│  Learning Phase (New Hires)                              │
│  Default duration: [4] weeks                            │
│  Alert before expiry: [7] days                          │
│                                                         │
│  [Save Settings]                                        │
└─────────────────────────────────────────────────────────┘
```

These settings provide the **company-level defaults**. Rate tiers, projects, and clients
can override specific values. The hierarchy is: Company Setting → Tier Default → Project Override.

## 1.8 Impact on Invoice Generation

### Current Invoice Wizard (3 steps)

1. Select client + project
2. Select approved timesheet entries by period
3. Review + create

### Proposed Invoice Wizard (updated)

**Step 1**: Select client + project (unchanged)

**Step 2**: Select billing source
- **Tab: Time entries** (current flow — select approved timesheet entries)
- **Tab: Unit entries** (new — select approved unit entries for per-unit projects)
- **Tab: Progress billing** (new — for fixed-price, enter/confirm % complete)
- **Tab: Change orders** (new — select COs to bill, with their entries or fixed amounts)

**Step 3**: Review + create (enhanced)
- Show grouped line items by source type
- Show retainage deduction if applicable
- Show previous billings for fixed-price (to-date tracking)

### Invoice Line Generation

```typescript
// Hourly (existing, enhanced)
{
  description: "Journalier - Jean Tremblay (Week of 2026-02-24)",
  quantity: 40,
  unit_price: 61.00,
  amount: 2440.00,
  timesheet_entry_id: "...",
  change_order_id: null,  // base scope
}

// Change order hourly
{
  description: "CO-001: Journalier - Jean Tremblay (Week of 2026-02-24)",
  quantity: 8,
  unit_price: 65.00,    // CO rate may differ
  amount: 520.00,
  timesheet_entry_id: "...",
  change_order_id: "...",
}

// Per-unit
{
  description: "Tirage de joints - 3rd floor (450 pi lin)",
  quantity: 450,
  unit_price: 1.25,
  amount: 562.50,
  unit_entry_id: "...",
}

// Fixed-price progress
{
  description: "Progress billing - 25% complete ($150,000 contract)",
  quantity: 1,
  unit_price: 37500.00,  // 25% of $150K
  amount: 37500.00,
}

// Retainage deduction
{
  description: "Holdback / Retenue (10%)",
  quantity: 1,
  unit_price: -340.25,
  amount: -340.25,
}
```

## 1.9 Migration Plan

### Phase 1 — Non-breaking additions (can ship immediately)
1. Add `retainage_percent` to `projects` (default 0 — opt-in)
2. Add `retainage_amount`, `retainage_released`, `is_retainage_release` to `invoices`
3. Create `billing_rate_history` table
4. Create `change_orders` table
5. Add `change_order_id` to `timesheet_entries` (nullable)
6. Add `change_order_id` to `invoice_lines` (nullable)

**Impact**: Zero breaking changes. All new columns nullable or have defaults. Existing flow unchanged.

### Phase 2 — Unit tracking
1. Create `unit_entries` table
2. Add `unit_entry_id` to `invoice_lines`
3. Build unit entry UI
4. Update invoice wizard with unit entry tab

### Phase 3 — Fixed-price progress billing
1. Create `fixed_price_progress` table
2. Build progress entry UI
3. Update invoice wizard with progress billing tab

### Phase 4 — Billing phases (if needed)
1. Create `billing_phases` table
2. Add `billing_phase_id` to `invoices`
3. Build phase management UI

### Phase 5 — Rate templates (if needed)
1. Create `billing_role_templates` table
2. Build template management admin UI
3. Update project billing role creation to use templates

---

# Part 2: CCQ Classification System

## 2.1 Current State

### What Exists

**`classifications` table** — 4 rows with placeholder data:

| code | name_fr | name_en | hourly_rate | sort_order |
|------|---------|---------|-------------|------------|
| apprenti_1 | Apprenti 1ere annee | Apprentice Year 1 | $25.00 | 1 |
| apprenti_2 | Apprenti 2ieme annee | Apprentice Year 2 | $30.00 | 2 |
| apprenti_3 | Apprenti 3ieme annee | Apprentice Year 3 | $35.00 | 3 |
| compagnon | Compagnon | Journeyman | $45.00 | 4 |

These rates are **placeholder values** (not real CCQ rates).

**`people.classification_id`** — exists as FK to `classifications`, but is NULL for all 541 records.

**`profiles` table** — CCQ card management:
- `ccq_card_number` (text, currently used)
- `ccq_card_expiry` (date, currently used)
- `ccq_card_url` (text, Supabase storage signed URL)
- `ccq_card_uploaded_at` (timestamptz)
- Full UI exists: `CcqCardSection` component with upload, status badges, expiry tracking

### What's Missing

- Real CCQ rates (current table has placeholders)
- Trade-specific rates (platrier vs tireur de joints vs peintre)
- Year versioning (rates change annually, typically May 1)
- Classification history (when did someone advance?)
- Overtime rate calculation tied to classification
- Connection between CCQ classification (employee cost) and billing role (client rate)

## 2.2 CCQ Background

The Commission de la construction du Quebec (CCQ) regulates:

- **Who can work** on construction sites (competency cards)
- **What they get paid** (minimum hourly rates by trade + classification)
- **Work conditions** (overtime rules, vacation, benefits)

### Trades Relevant to Grand Canyon

| CCQ Code | Trade (FR) | Trade (EN) | Relevant? |
|----------|-----------|------------|-----------|
| 16 | Platrier | Plasterer | Yes — drywall |
| 21 | Tireur de joints | Taper | Yes — joint finishing |
| 23 | Peintre | Painter | Yes — painting |
| -- | Manoeuvre | Labourer | Yes — general help |

**[DECISION NEEDED]**: Does the company also do acoustic ceiling work under a specific CCQ trade? Or is that covered under "platrier"?

### Classification Levels

| Level | Name (FR) | Name (EN) | Hours Required |
|-------|-----------|-----------|----------------|
| 1 | Apprenti 1ere periode | Apprentice Period 1 | 0-2000 hrs |
| 2 | Apprenti 2ieme periode | Apprentice Period 2 | 2000-4000 hrs |
| 3 | Apprenti 3ieme periode | Apprentice Period 3 | 4000-6000 hrs |
| 4 | Compagnon | Journeyman | 6000+ hrs (exam passed) |

Note: Some trades have only 3 apprentice periods, others have 4. Platrier has 3 periods.

**[DECISION NEEDED]**: How many apprentice periods for each trade the company uses? Need to verify against current CCQ regulations.

### Overtime Rules (Quebec Construction — Sector IC, Commercial/Institutional)

| Condition | Rate |
|-----------|------|
| First 40 hours/week | Regular (1.0x) |
| 40-50 hours/week | Time and a half (1.5x) |
| Over 50 hours/week | Double time (2.0x) |
| Saturday (first 8 hrs) | Time and a half (1.5x) |
| Saturday (after 8 hrs) | Double time (2.0x) |
| Sunday | Double time (2.0x) |
| Statutory holidays | Double time (2.0x) |

**[RESOLVED — C4]**: Grand Canyon works across ALL sectors (IC, R, GC). Since they bill
labor only, OT rules are per-project/client configurable:
- Some clients don't pay overtime at all (billed at regular rate)
- Some employees work OT at same rate to "bank hours"
- Some clients pay premium for weekends/difficult conditions even under 40hrs
- The 1.5x/2x automation should exist but be toggle-able per project
- CCQ sector determines the cost-side OT rules (mandatory for payroll), but billing-side
  OT is independently configurable per project

## 2.3 Proposed Schema

### Replace `classifications` with trade-aware, versioned system

#### `ccq_trades`
```sql
CREATE TABLE ccq_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,           -- "16", "21", "23"
  name_fr text NOT NULL,               -- "Platrier"
  name_en text NOT NULL,               -- "Plasterer"
  apprentice_periods int NOT NULL DEFAULT 3,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Seed data
INSERT INTO ccq_trades (code, name_fr, name_en, apprentice_periods, sort_order) VALUES
  ('16', 'Platrier', 'Plasterer', 3, 1),
  ('21', 'Tireur de joints', 'Taper', 3, 2),
  ('23', 'Peintre', 'Painter', 3, 3),
  ('MAN', 'Manoeuvre', 'Labourer', 0, 4);
```

#### `ccq_classifications`
Replace the current 4-row `classifications` table.

```sql
CREATE TABLE ccq_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES ccq_trades(id),
  level text NOT NULL,                 -- "apprenti_1", "apprenti_2", "apprenti_3", "compagnon"
  name_fr text NOT NULL,               -- "Apprenti 1ere periode"
  name_en text NOT NULL,               -- "Apprentice Period 1"
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (trade_id, level)
);

-- Example seed: Platrier classifications
-- (One set per trade — 3 apprenti + 1 compagnon for most Grand Canyon trades)
INSERT INTO ccq_classifications (trade_id, level, name_fr, name_en, sort_order)
SELECT t.id, v.level, v.name_fr, v.name_en, v.sort_order
FROM ccq_trades t
CROSS JOIN (VALUES
  ('apprenti_1', 'Apprenti 1ere periode', 'Apprentice Period 1', 1),
  ('apprenti_2', 'Apprenti 2ieme periode', 'Apprentice Period 2', 2),
  ('apprenti_3', 'Apprenti 3ieme periode', 'Apprentice Period 3', 3),
  ('compagnon', 'Compagnon', 'Journeyman', 4)
) AS v(level, name_fr, name_en, sort_order)
WHERE t.code IN ('16', '21', '23');

-- Manoeuvre has no apprentice levels
INSERT INTO ccq_classifications (trade_id, level, name_fr, name_en, sort_order)
SELECT t.id, 'manoeuvre', 'Manoeuvre', 'Labourer', 1
FROM ccq_trades t WHERE t.code = 'MAN';
```

#### `ccq_rates`
Versioned rate table — new rows each year when CCQ publishes new rates.

```sql
CREATE TABLE ccq_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id uuid NOT NULL REFERENCES ccq_classifications(id),
  effective_from date NOT NULL,        -- "2025-05-01" (CCQ rates change ~May 1)
  effective_to date,                   -- "2026-04-30", null = current
  hourly_rate numeric NOT NULL,        -- base hourly wage
  vacation_percent numeric,            -- typically 13%
  benefit_rate numeric,                -- employer portion of benefits
  total_hourly_cost numeric,           -- hourly_rate + benefits (employer total cost)
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (classification_id, effective_from)
);
```

##### Sample Rate Data (2025-2026 placeholder structure)

**[DECISION NEEDED]**: These need real CCQ rates. Below are approximate/placeholder values for structure illustration.

```sql
-- Platrier rates (approximate — verify against CCQ decret)
INSERT INTO ccq_rates (classification_id, effective_from, effective_to, hourly_rate, vacation_percent, total_hourly_cost)
VALUES
  -- 2025-2026 (May 1, 2025 to April 30, 2026)
  (:platrier_apprenti_1, '2025-05-01', '2026-04-30', 22.89, 13, 33.50),
  (:platrier_apprenti_2, '2025-05-01', '2026-04-30', 30.52, 13, 40.20),
  (:platrier_apprenti_3, '2025-05-01', '2026-04-30', 34.33, 13, 44.80),
  (:platrier_compagnon,  '2025-05-01', '2026-04-30', 42.78, 13, 55.60),

  -- 2024-2025 (historical)
  (:platrier_apprenti_1, '2024-05-01', '2025-04-30', 22.10, 13, 32.40),
  (:platrier_apprenti_2, '2024-05-01', '2025-04-30', 29.47, 13, 38.90),
  (:platrier_apprenti_3, '2024-05-01', '2025-04-30', 33.15, 13, 43.30),
  (:platrier_compagnon,  '2024-05-01', '2025-04-30', 41.30, 13, 53.70);
```

#### `employee_classifications`
Link employees to their CCQ classification with history tracking.

```sql
CREATE TABLE employee_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES people(id),
  classification_id uuid NOT NULL REFERENCES ccq_classifications(id),
  effective_from date NOT NULL,
  effective_to date,                   -- null = current classification
  ccq_hours_accumulated numeric,       -- hours logged toward next level
  notes text,                          -- "Passed compagnon exam 2025-06-15"
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for current classification lookup
CREATE INDEX idx_employee_classifications_current
  ON employee_classifications (person_id)
  WHERE effective_to IS NULL;
```

### Modified Tables

#### `people` — replace classification_id with trade
```sql
-- Keep classification_id for backward compat during migration, but deprecate
ALTER TABLE people ADD COLUMN primary_trade_id uuid REFERENCES ccq_trades(id);
-- Current classification determined by employee_classifications WHERE effective_to IS NULL
```

**[DECISION NEEDED]**: Can an employee work in multiple trades simultaneously?
- If yes: `employee_classifications` already supports it (multiple rows with effective_to IS NULL)
- If no: add a UNIQUE constraint on (person_id) WHERE effective_to IS NULL
- Reality: Some workers are multi-trade (e.g., platrier who also does joints). The system should support it.

## 2.4 Rate Structure

### CCQ Rate vs Billing Rate — Two Different Things

```
CCQ Rate (what you PAY the worker)     Billing Rate (what you CHARGE the client)
─────────────────────────────────     ──────────────────────────────────────────
Compagnon platrier: $42.78/hr          Project billing role: $65.00/hr
+ vacation 13%:     $5.56/hr           (includes company markup for:
+ benefits:         $7.26/hr             - overhead, profit, equipment,
────────────────────────────            - supervision, insurance, etc.)
Total employer cost: $55.60/hr          Margin: $65.00 - $55.60 = $9.40/hr
```

The CCQ rate is the **cost floor**. The billing rate is the **revenue**. The system needs both to calculate margins but they live in separate tables.

### Margin Calculation (future report)

```sql
-- Per-employee margin report (future)
SELECT
  p.first_name, p.last_name,
  cr.hourly_rate AS ccq_rate,
  cr.total_hourly_cost AS employer_cost,
  pbr.rate AS billing_rate,
  pbr.rate - cr.total_hourly_cost AS margin_per_hour,
  SUM(hours_total) * (pbr.rate - cr.total_hourly_cost) AS total_margin
FROM timesheet_entries te
JOIN ...
```

## 2.5 Classification History & Progression

**UPGRADED** (owner input 2026-03-12): Progression tracking is a **core v1 requirement**, not a future enhancement. The system must track apprenti hours and detect when they reach advancement thresholds, adjusting both billing rates and salary accordingly.

### Tracking Progression

When an employee advances (e.g., Apprenti 2 to Apprenti 3):

```sql
-- Close current classification
UPDATE employee_classifications
SET effective_to = '2026-03-01', updated_at = now()
WHERE person_id = :person_id AND effective_to IS NULL;

-- Open new classification
INSERT INTO employee_classifications (person_id, classification_id, effective_from, notes)
VALUES (:person_id, :apprenti_3_id, '2026-03-01', 'Advanced based on CCQ hours');
```

### Progression Cascade Effects

When a classification advances, the following must happen:

1. **Billing rate update**: The employee's rate on all active projects changes.
   - If using rate tier resolution (Level 3): automatic — new classification
     resolves to a different tier line.
   - If using project_billing_roles: need to update each project's role assignment.

2. **Salary adjustment**: Employee's pay rate changes per CCQ rate table.
   - New `ccq_rates` lookup for the new classification.
   - **[DECISION NEEDED — C11]**: Is salary/payroll management in scope for this module,
     or just the billing side? If salary: need `employee_pay_rates` table or integration
     with payroll export.

3. **Audit trail**: `employee_classifications` history records the change with
   `effective_from` date, accumulated hours, and reason.

### Auto-Detection System (v1 — Core Requirement)

The system tracks cumulative hours per employee per trade and alerts when
approaching advancement thresholds:

```
Apprenti 1 → Apprenti 2:  2,000 hours
Apprenti 2 → Apprenti 3:  4,000 hours (cumulative)
Apprenti 3 → Compagnon:   6,000 hours (cumulative) + exam
```

#### Hour Accumulation

```sql
-- View: accumulated hours per employee per trade
CREATE VIEW employee_trade_hours AS
SELECT
  pm.user_id AS person_id,
  p.primary_trade_id AS trade_id,
  ec.classification_id,
  ec.effective_from AS classification_since,
  SUM(
    COALESCE(te.hours[1],0) + COALESCE(te.hours[2],0) + COALESCE(te.hours[3],0) +
    COALESCE(te.hours[4],0) + COALESCE(te.hours[5],0) + COALESCE(te.hours[6],0) +
    COALESCE(te.hours[7],0)
  ) AS total_hours,
  cc.level AS current_level,
  CASE cc.level
    WHEN 'apprenti_1' THEN 2000
    WHEN 'apprenti_2' THEN 4000
    WHEN 'apprenti_3' THEN 6000
    ELSE NULL
  END AS next_threshold
FROM employee_classifications ec
JOIN ccq_classifications cc ON ec.classification_id = cc.id
JOIN people p ON ec.person_id = p.id
LEFT JOIN project_members pm ON pm.user_id = p.user_id
LEFT JOIN timesheet_entries te ON te.user_id = pm.user_id AND te.project_id = pm.project_id
WHERE ec.effective_to IS NULL
GROUP BY pm.user_id, p.primary_trade_id, ec.classification_id, ec.effective_from, cc.level;
```

#### Advancement Alerts

```
┌─────────────────────────────────────────────────────────┐
│  ⚠ Classification Advancement Alerts                    │
│                                                         │
│  Marc Gagnon (Platrier)                                 │
│  Current: Apprenti 2ieme periode                        │
│  Hours: 3,847 / 4,000 (96.2%)  ████████████████░░ │
│  Estimated advancement: ~3 weeks                        │
│  [Advance Now]  [Dismiss]  [View History]               │
│                                                         │
│  Luc Roy (Tireur de joints)                             │
│  Current: Apprenti 3ieme periode                        │
│  Hours: 5,920 / 6,000 (98.7%)  █████████████████░ │
│  ⚠ Requires compagnon exam                              │
│  [Mark Exam Passed]  [Dismiss]  [View History]          │
└─────────────────────────────────────────────────────────┘
```

#### Workflow: Admin-Confirmed Advancement

1. System detects hours threshold reached → creates alert
2. Admin reviews (may check with CCQ for official hour count)
3. Admin confirms advancement → system updates:
   - `employee_classifications`: close old, open new
   - Billing rates: cascade via rate tier resolution
   - Salary: adjust per CCQ rate table (if payroll in scope)
4. Notification to employee (optional)
5. Audit log entry

**Note**: Compagnon advancement requires passing the CCQ exam — the system
can only detect hours, not exam completion. Admin must confirm exam status.

## 2.6 Connection to Billing

### How CCQ Classification Connects to Rate Schedules

**Updated flow with rate tiers** (replaces flat billing role approach):

```
Employee: Jean Tremblay
  └── CCQ Classification: Compagnon Platrier (employee_classifications)
        └── CCQ Rate: $42.78/hr (ccq_rates, 2025-2026)
        └── Employer Cost: $55.60/hr (with benefits)

Client: ABC Construction
  └── Rate Schedule: Tier B "Preferred" (client_rate_tiers)

Rate Resolution for Jean on ABC's project:
  1. Check project_rate_overrides → none
  2. Check client tier (Tier B) → Compagnon Platrier line → $86.00/hr
  3. Billing rate = $86.00/hr

Invoice line:
  └── hours x $86.00 (from Tier B rate tier)

Margin:
  └── $86.00 - $55.60 = $30.40/hr (visible in reports, not on invoice)
```

### Classification Advancement → Rate Change

```
Marc Gagnon advances: Apprenti 2 → Apprenti 3 (Platrier)

Before (Apprenti 2):
  Client ABC (Tier B) → Apprenti 2 Platrier line → $69.00/hr
  CCQ cost: $30.52/hr → margin: $38.48/hr

After (Apprenti 3):
  Client ABC (Tier B) → Apprenti 3 Platrier line → $75.00/hr  ← automatic
  CCQ cost: $34.33/hr → margin: $40.67/hr

What changed: Only employee_classifications. Rate tier resolves
the new rate automatically because Marc now matches a different tier line.
```

### Rate Validation (v1)

System warns if a billing rate is set below employer cost:

```
⚠ Warning: Billing rate ($50.00) is below employer cost ($55.60)
for Compagnon Platrier. You will lose $5.60/hr on this role.
```

This validation applies to rate_tier_lines AND project_rate_overrides.
Requires accurate benefit/cost data in `ccq_rates.total_hourly_cost`.

## 2.7 Card Expiry Tracking

### Current State (Already Built)

The CCQ card management UI already exists:
- `CcqCardSection` component: card image upload, number, expiry date
- Status badges: valid, expiring_soon (30 days), expired, missing
- Admin dashboard: `getEmployeeDocuments()` with status filtering + summary counts
- Storage: Supabase Storage (`employee-documents/ccq-cards/{userId}/card.{ext}`)

### Proposed Enhancements

1. **Email alerts** for expiring cards (30 days, 14 days, 7 days before expiry)
2. **Dashboard widget** on admin home: "3 cards expiring this month"
3. **Block timesheet submission** if card is expired (configurable via settings)

**[DECISION NEEDED]**: Block timesheet submission for expired CCQ cards?
- Pro: Ensures compliance
- Con: Workers may have renewed but not yet uploaded — blocks their work
- Recommendation: Warning only, not blocking. Admin alert for follow-up.

## 2.8 UI Concepts

### Admin: CCQ Rate Management

```
┌─────────────────────────────────────────────────┐
│  CCQ Rates                              2025-2026│
│  ┌─────────────────────────────────────────────┐│
│  │ Trade: [Platrier ▼]                         ││
│  │                                             ││
│  │ Classification    │ Hourly  │ Benefits │ Total│
│  │ ─────────────────┼─────────┼──────────┼──────│
│  │ Apprenti 1       │ $22.89  │ $10.61   │$33.50│
│  │ Apprenti 2       │ $30.52  │  $9.68   │$40.20│
│  │ Apprenti 3       │ $34.33  │ $10.47   │$44.80│
│  │ Compagnon        │ $42.78  │ $12.82   │$55.60│
│  │                                             ││
│  │ [Edit Rates]  [Import from CCQ]  [History]  ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Year selector: [◀ 2024-2025] [2025-2026 ▶]    │
└─────────────────────────────────────────────────┘
```

### Employee Profile: Classification Section

```
┌─────────────────────────────────────────────────┐
│  Classification & CCQ                           │
│  ┌─────────────────────────────────────────────┐│
│  │ Current:                                    ││
│  │   Trade: Platrier                           ││
│  │   Level: Compagnon            ● Active      ││
│  │   Since: 2023-06-15                         ││
│  │   CCQ Rate: $42.78/hr (2025-2026)           ││
│  │                                             ││
│  │ CCQ Card:                                   ││
│  │   Number: 123-456-789      Exp: 2027-03-15  ││
│  │   [Card image thumbnail]    ● Valid          ││
│  │                                             ││
│  │ History:                                    ││
│  │   2023-06-15  Compagnon (exam passed)       ││
│  │   2021-09-01  Apprenti 3ieme periode        ││
│  │   2019-09-01  Apprenti 2ieme periode        ││
│  │   2017-09-01  Apprenti 1ere periode         ││
│  │                                             ││
│  │ [Change Classification] [View Full History] ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### Admin: Bulk Classification Dashboard

```
┌─────────────────────────────────────────────────┐
│  Employee Classifications                       │
│                                                 │
│  Summary: 8 Compagnon │ 5 App.3 │ 3 App.2 │ 2 App.1│
│                                                 │
│  ┌──────────────────────────────────────────────┐
│  │ Filter: [All Trades ▼] [All Levels ▼]       │
│  │                                             ││
│  │ Name          │ Trade     │ Level    │Card  ││
│  │ ──────────────┼───────────┼──────────┼──────││
│  │ J. Tremblay   │ Platrier  │ Compagnon│ ●   ││
│  │ M. Gagnon     │ Platrier  │ App. 3   │ ●   ││
│  │ P. Bouchard   │ Peintre   │ Compagnon│ ⚠   ││
│  │ L. Roy        │ Tir.joints│ App. 2   │ ●   ││
│  │                                             ││
│  │ ● = valid card  ⚠ = expiring  ✕ = expired  ││
│  └──────────────────────────────────────────────┘
└─────────────────────────────────────────────────┘
```

## 2.9 Migration Plan

### Phase 1 — Schema Migration

1. Create `ccq_trades` table + seed data
2. Create `ccq_classifications` table + seed per-trade
3. Create `ccq_rates` table + seed with placeholder rates
4. Create `employee_classifications` table
5. Add `primary_trade_id` to `people`

**Keep old `classifications` table** temporarily for backward compatibility.

### Phase 2 — Data Migration

1. Map existing `classifications` rows to new `ccq_classifications`:
   - `apprenti_1` → Apprenti 1ere periode (need trade context — default to Platrier?)
   - `apprenti_2` → Apprenti 2ieme periode
   - `apprenti_3` → Apprenti 3ieme periode
   - `compagnon` → Compagnon

2. For each `people` record with `classification_id`:
   - Create `employee_classifications` row with `effective_from = created_at`
   - Currently all NULL, so this step is a no-op

3. **Manual data entry needed**: Someone needs to assign trade + classification to each active employee. This is a business task, not a technical one.

**[DECISION NEEDED]**: Who will do the initial data entry for employee classifications? Does the company have this info in spreadsheets or CCQ records?

### Phase 3 — Real CCQ Rates

1. Obtain official CCQ rate decree ("decret de la construction") for current year
2. Enter real rates into `ccq_rates` table
3. Enter historical rates (at least 1-2 previous years) for accurate margin reporting

**[DECISION NEEDED]**: Where to get official rates?
- CCQ website: https://www.ccq.org (decrets section)
- Company may have the physical decret book
- Rates are public information but complex (many trades, sectors)

### Phase 4 — UI Updates

1. Build CCQ rate management admin page
2. Update employee profile with classification section
3. Build classification dashboard
4. Connect classification to billing role creation (suggest rates)

### Phase 5 — Drop Legacy Table

1. Migrate any remaining references from `classifications` to `ccq_classifications`
2. Update `people.classification_id` to use new system
3. Eventually drop old `classifications` table

---

# Open Questions

Summary of all [DECISION NEEDED] items. Items marked ✅ are resolved by owner input.

### Billing Model

| # | Status | Question | Options | Resolution / Recommendation |
|---|--------|----------|---------|----------------------------|
| B1 | ✅ | Need billing phases for v1? | Yes / No | **No for v1** — use change orders only |
| B2 | ✅ | Change order status: enum or check constraint? | Enum / Check | **Deferred** — change orders deferred (B21) |
| B3 | ✅ | Retainage on subtotal or total? | Subtotal / Total | **Subtotal** — owner confirmed, feature is low-priority (not used currently) |
| B4 | ✅ | Retainage at project level or invoice level? | Project / Invoice | **Project level** — opt-in (default 0%), deferred UI |
| B5 | ✅ | Auto-generate retainage release invoices? | Auto / Alert | **Defer** — retainage feature deprioritized |
| B6 | ✅ | Progress billing: % or milestones? | % / Milestones | **Percentage for v1** |
| B7 | ✅ | Unit entry cadence? | Daily / Weekly | **Weekly with location breakdown** |
| B8 | ✅ | Per-unit: units alongside timesheets? | Replace / Parallel | **Parallel** (units=billing, hours=payroll) |
| B9 | ✅ | Auto-calculate OT billing rates? | Auto / Manual / Per-client | **Per-project/client** — configurable multipliers (owner confirmed) |
| B10 | ✅ | Rate hierarchy: how many levels? | 2 / 5 | **5 levels** with rate tiers / paliers tarifaires (owner confirmed) |
| B11 | ✅ | Implement billing role templates? | Yes / Later | **Superseded by rate tiers** |

#### New Questions (from rate tier + OT design)

| # | Status | Question | Options | Recommendation |
|---|--------|----------|---------|----------------|
| B12 | ✅ | How do rate tiers interact with project_billing_roles? | 3 options | **Employee-carried classification** — resolved (owner confirmed) |
| B13 | ✅ | What are the apprenti tier rates? | Various | **Answered**: App1&2=$72 flat, App3=compagnon rate, fresh=$55-60 temp |
| B14 | ✅ | Rate tier line date versioning — aligned with CCQ year? | Annual / On-change | **Annual (May 1)** — confirmed |
| B15 | ✅ | OT billing multipliers — actual values? | Various | **Admin-configurable** from GC settings page, defaults 1.5/2.0 |
| B16 | ✅ | OT config: default on tier or project? | Tier / Project | **Tier default + project override** — all business settings in admin UI |
| B17 | ✅ | Special work condition rates — how to model? | Multipliers / Lines | **Premiums in OT config** — weekend, conditions, etc. |
| B19 | ✅ | Fresh apprenti temp discount — how to model? | 3 options | **Employee rate override with expiry** — learning phase tracking |
| B20 | ✅ | OT invoice line splitting — auto or manual? | 3 options | **Hybrid** — employee flags, system suggests, admin approves |
| B21 | ✅ | Change orders — needed for v1? | Yes / Defer | **Defer** — hourly billing, charge what you do. Later phase. |

### CCQ Classification

| # | Status | Question | Options | Resolution / Recommendation |
|---|--------|----------|---------|----------------------------|
| C1 | ✅ | Which CCQ trades? | — | **Platrier, Tireur de joints, Peintre, Manoeuvre** |
| C2 | ✅ | Acoustic ceiling — which trade? | Platrier / Other | **Verify via CCQ docs** — "systèmes intérieurs" scope |
| C3 | ✅ | Apprentice periods per trade? | 3 or 4 | **3 for most GC trades**, electrician=4. Verify via CCQ docs |
| C4 | ✅ | Construction sector? | IC / R / GC | **All sectors** — OT rules per-project, toggle-able |
| C5 | ✅ | Multi-trade employees? | Allow / Restrict | **Allow** |
| C6 | ✅ | Auto-detect classification advancement? | v1 / Later | **v1 — core requirement** (owner confirmed) |
| C7 | ✅ | Block timesheets for expired cards? | Block / Warn | **Warn only** |
| C8 | ✅ | Who enters initial classifications? | Admin / Import | **Admin** — business knowledge needed |
| C9 | ✅ | Where to get official CCQ rates? | Website / Decret | **CCQ scrape** — backlog task created, will populate from docs |
| C10 | ✅ | Rate validation warnings? | v1 / Later | **v1** — warn when billing < employer cost, low effort |
| C11 | ✅ | Is salary/payroll in scope? | Yes / Billing only | **Billing only** for now (owner confirmed) |

---

## Detailed Analysis: Critical Open Questions

### B12 — Employee-Carried Classification Model (RESOLVED)

**Resolution** (owner input 2026-03-12): Employees carry their default classification.
Rate is resolved dynamically from employee classification + client tier. Project-level
override is available but rare.

#### How It Works

```
Employee: Marc Gagnon
  └── Default Classification: Compagnon Platrier (from employee_classifications)
  └── This IS his identity — a plasterer is always a plasterer

Project: PRJ-123 (Client: ABC Construction, Tier B)
  └── Marc assigned to project
  └── No role selection needed — he's a Compagnon Platrier
  └── Rate resolved: Tier B + Compagnon Platrier = $86.00/hr

Rare override: Marc does cleanup work on one project
  └── project_member_role_override: Marc on PRJ-456 = Manoeuvre
  └── Rate resolved: Tier A + Manoeuvre = $55.00/hr
```

#### Schema Change: `project_members`

```sql
-- Add optional role override (null = use employee's default classification)
ALTER TABLE project_members
  ADD COLUMN classification_override_id uuid REFERENCES ccq_classifications(id);

-- The override is the RARE case — "this plasterer is doing laborer work on this project"
-- When null (99% of cases): use employee_classifications WHERE effective_to IS NULL
```

#### Timesheet Entry Flow (New)

```
1. Employee opens timesheet for the week
2. For each project row, system shows their role:
   - Default: "Compagnon Platrier" (from classification) — no selection needed
   - Override: "Manoeuvre" (from project_member.classification_override_id)
3. Employee logs hours — rate NOT shown (that's admin/billing concern)
4. At invoice time: resolveHourlyRate(classification, project) → tier line → rate
```

#### Migration from project_billing_roles

```
Phase 1: Add classification_id to project_billing_roles (backfill from name matching)
Phase 2: Add classification_override_id to project_members
Phase 3: Rate resolution reads from tier lines, falls back to project_billing_roles.rate
Phase 4: Once all projects migrated, deprecate project_billing_roles for new projects
Phase 5: Eventually drop project_billing_roles (keep for historical invoice auditing)
```

#### What About project_billing_roles?

`project_billing_roles` becomes a **legacy/migration table**. New projects won't use it.
The employee's classification + client tier replaces the concept entirely.
Historical invoices still reference their original `billing_role_id` for audit integrity.

**Key insight from owner**: "It should be employee choice by default" — the employee IS
their classification. The system shouldn't ask them to pick a role every time. Override
at project level only when the employee is genuinely doing different work.

### B9 — Overtime Billing (RESOLVED — Per-Project/Client)

**Resolution** (owner input 2026-03-12): OT billing varies by project and client.

**The two sides of OT:**

| Side | Rate | Who determines | Example |
|------|------|----------------|---------|
| **Cost** (payroll) | CCQ base × multiplier | CCQ regulations (mandatory) | $42.78 × 1.5 = $64.17/hr |
| **Billing** (invoice) | Configurable per project | Client agreement | Varies — see below |

**Owner's input on OT billing (2026-03-12):**
- Sometimes: **same rate as regular** (flat — most common, client doesn't pay OT)
- Sometimes: **"double"** — a specific % (TBD, maybe ~90% or ~80%)
- Sometimes: **"half"** — also a specific % (TBD)
- Sometimes: **premium for special conditions** — client pays extra even under 40hrs
  (weekends, difficult conditions, urgent work)
- Some employees work OT at regular rate to "bank hours" — informal arrangement
- OT on the **cost side** (CCQ payroll) is mandatory. OT on the **billing side** is negotiable.

#### Proposed: OT Billing Config on Project

```sql
ALTER TABLE projects ADD COLUMN ot_billing_config jsonb DEFAULT '{"mode": "flat"}';

-- Mode: "flat" = all hours billed at regular rate (most common for GC)
-- Mode: "multiplied" = auto-split invoice lines at OT rates
-- Mode: "off" = no OT tracking on billing side (identical to flat, explicit intent)

-- Examples:
-- Flat (default, most projects):
--   {"mode": "flat"}
--
-- Standard OT multipliers:
--   {"mode": "multiplied", "ot_1_5x": 1.5, "ot_2x": 2.0}
--
-- Custom OT rates (owner's "double" and "half"):
--   {"mode": "multiplied", "ot_1_5x": 1.8, "ot_2x": 1.9}
--
-- Premium conditions (client pays extra even under 40hrs):
--   {"mode": "multiplied", "ot_1_5x": 1.5, "ot_2x": 2.0,
--    "premiums": [
--      {"label": "Fin de semaine", "multiplier": 1.5},
--      {"label": "Conditions difficiles", "multiplier": 1.3}
--    ]}
```

**[DECISION NEEDED — B15]**: Exact OT billing multiplier values. Owner said ~90% or ~80%
as placeholder — need actual values before build. Not blocking for schema design.

**[DECISION NEEDED — B20]**: How should the invoice wizard handle OT line splitting?
See Open Questions for options.

### B19 — Fresh Apprenti Temporary Discount (RESOLVED — Option A)

**Resolution** (owner input 2026-03-12): Employee-level rate override with expiry.
Owner wants to track the learning phase progression and adjust timeframe if needed.
Acts as an automation that can be monitored.

```sql
CREATE TABLE employee_rate_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES people(id),
  classification_id uuid REFERENCES ccq_classifications(id), -- null = all classifications
  hourly_rate numeric NOT NULL,          -- $55 or $60
  reason text,                           -- "New hire, skill assessment period"
  effective_from date NOT NULL,
  effective_to date,                     -- null = until manually removed
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Rate resolution order becomes:
-- 1. Change order override
-- 2. Project rate override
-- 3. Employee rate override (NEW — learning phase, temp discounts)
-- 4. Client rate tier
-- 5. Default rate tier (A)
-- 6. Fallback: project_billing_roles.rate (legacy)
```

#### Learning Phase Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  Learning Phase Overrides                               │
│                                                         │
│  Marc Dupont (Apprenti 1 — Platrier)                    │
│  Override: $55.00/hr (standard: $72.00)                 │
│  Period: 2026-03-01 → 2026-04-15 (15 days remaining)   │
│  Reason: New hire assessment                            │
│  Progress: ██████████░░░░░░░░░░ 53%                     │
│  [Extend 2 weeks]  [End Early]  [View Hours]            │
│                                                         │
│  Luc Tremblay (Apprenti 1 — Tireur de joints)           │
│  Override: $60.00/hr (standard: $72.00)                 │
│  Period: 2026-02-15 → 2026-03-30 (18 days remaining)   │
│  [Extend 2 weeks]  [End Early]  [View Hours]            │
└─────────────────────────────────────────────────────────┘
```

When the override expires, the employee automatically bills at their tier rate.
Admin gets a notification before expiry to review and extend if needed.

### B20 — OT Invoice Line Splitting (RESOLVED — Hybrid + Approval Flow)

**Resolution** (owner input 2026-03-12): Hybrid approach with employee request →
client confirmation → admin approval workflow. Toggle between standard and custom OT.

#### OT Workflow

```
1. Employee flags hours as OT in timesheet
   └── Can flag: individual days, specific hour ranges, or special conditions
   └── Flag types: "standard_ot" (>40hrs), "weekend", "conditions", "custom"

2. Manager reviews timesheet
   └── Sees OT flags, can approve/reject/adjust
   └── System auto-suggests OT for hours >40/week (toggle-able)

3. Admin confirms with client (if needed)
   └── Some clients pre-approve OT, others need per-instance confirmation
   └── Project setting: ot_approval = "pre_approved" | "per_instance" | "never"

4. Invoice wizard generates lines
   └── OT-approved hours → separate invoice lines at OT rate
   └── Non-approved OT hours → billed at regular rate (or excluded)
   └── Toggle: "standard" (1.5x/2x) vs "custom" multipliers per project
```

#### Timesheet Entry Schema Update

```sql
ALTER TABLE timesheet_entries ADD COLUMN ot_flags jsonb;

-- ot_flags structure:
-- null = no OT (most entries)
-- {
--   "days": {
--     "4": {"type": "standard_ot", "status": "pending"},     -- Thursday
--     "5": {"type": "weekend", "status": "approved"},        -- Friday (special case)
--   },
--   "approved_by": "uuid",
--   "approved_at": "2026-03-12T..."
-- }
```

#### Invoice Line Output (when OT approved)

```
Compagnon Platrier - Marc Gagnon (Week of 2026-03-09)          40 hrs × $89.00 = $3,560.00
Compagnon Platrier - Marc Gagnon (Week of 2026-03-09) — T.sup  5 hrs × $133.50 =   $667.50
```

**Toggle**: Project `ot_billing_config.mode`:
- `"flat"` → all hours at regular rate (no OT lines, regardless of flags)
- `"standard"` → 1.5x / 2.0x multipliers
- `"custom"` → custom multipliers from `ot_billing_config`

### C11 — Salary/Payroll Scope (RESOLVED — Billing Only)

**Resolution** (owner input 2026-03-12): **Billing only for now.** Get billing right first,
payroll integration later.

The billing module calculates what to CHARGE the client. Payroll/salary is handled
externally. The system provides:
- CCQ rate lookup for reference (what you must pay the worker)
- Classification history for HR
- When classification advances, show the new CCQ rate so admin can update payroll externally
- Future: payroll export integration (Phase 2 of the larger system)

---

## Implementation Priority

Updated order reflecting rate tiers, progression tracking, OT workflow, and deferred items.

```
Sprint 1 — Foundation (schema + data model):
  ├── rate_tiers + rate_tier_lines tables
  ├── client_rate_tiers + project_rate_overrides tables
  ├── employee_rate_overrides table (learning phase)
  ├── ccq_trades + ccq_classifications + ccq_rates tables
  ├── employee_classifications table
  ├── project_members.classification_override_id column
  ├── Seed GC data: 3 tiers (A/B/Custom), 4 trades, classifications
  ├── Billing rate history table
  └── Migration: backfill employee classifications from existing data

Sprint 2 — Core Billing + Rate Tiers:
  ├── Rate resolution logic (6-level cascade incl. employee overrides)
  ├── Admin: rate tier management page (paliers tarifaires)
  ├── Invoice wizard: rate tier integration (replace project_billing_roles path)
  ├── Learning phase dashboard (employee rate overrides)
  └── Employee-carried classification in timesheet flow

Sprint 3 — Classification & Progression:
  ├── Employee profile: classification section + history
  ├── Admin: CCQ rate management page
  ├── Progression tracking: hour accumulation view
  ├── Advancement alerts dashboard
  └── Admin: bulk classification dashboard

Sprint 4 — Overtime Workflow:
  ├── Timesheet OT flagging (employee flags, system suggests)
  ├── OT approval workflow (manager → admin → client confirmation)
  ├── Project OT config (flat/standard/custom toggle)
  ├── Invoice wizard: OT line splitting
  └── Margin reports (billing rate vs employer cost)

Sprint 5 — Extended Features (DEFERRED):
  ├── Change orders table + UI (deferred — not used currently)
  ├── Retainage fields + UI (deferred — not used currently)
  ├── Unit entries + per-unit billing
  ├── Fixed-price progress billing
  ├── Auto-tiering rule evaluation (background job)
  └── Rate validation warnings + CCQ card expiry alerts
```

### CCQ Knowledge Base (New — Research Phase)

Scrape and index CCQ/Quebec government documentation into the XPERR Library:
- CCQ rate decrees (décrets de la construction)
- Sector rules (IC, R, GC)
- Trade classifications and apprentice progression requirements
- Overtime rules by sector
- Convention collective documentation

Indexed via GraphRAG for querying during feature design and compliance validation.
See research findings for feasibility and approach.
