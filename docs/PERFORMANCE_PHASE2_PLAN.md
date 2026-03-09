# Performance Optimization — Phase 2 Plan

Phase 1 (completed 2026-03-09) addressed all low-risk, no-brainer optimizations.
Phase 2 covers items that require more design, have security tradeoffs, or need validation before deployment.

---

## P2: Migrate from revalidatePath to revalidateTag

**Current state**: 93 `revalidatePath()` calls. Every mutation invalidates entire route caches (e.g., `/projects` clears all project list data).

**Goal**: Granular cache invalidation using `revalidateTag()` so only affected data is re-fetched.

**Design considerations**:
- Supabase JS client doesn't use Next.js `fetch()` directly, so tags must be applied via a wrapper
- Pattern: Create a `taggedQuery()` helper that wraps Supabase queries with `unstable_cache()` + tags
- Tag naming convention: `entity:id` (e.g., `project:abc123`, `client:xyz`, `invoices-list`)
- Every mutation calls `revalidateTag('project:abc123')` instead of `revalidatePath('/projects')`
- Risk: Missing a tag means stale data persists. Requires discipline and testing.

**Effort**: ~4-6 hours (touch every actions.ts file + create query wrapper)

**Recommendation**: Implement incrementally — start with projects, validate behavior, then expand to other entities.

---

## M1 Full: Cookie/Session-Based Auth Caching

**Current state (Phase 1)**: `getProfile()` and `getUserPermissions()` wrapped with React `cache()` — deduplicates within a single request but still hits DB on every navigation.

**Goal**: Cache profile/permissions across navigations to eliminate the 2-query auth waterfall on every page load.

**Options (ranked by complexity)**:

### Option A: Short-TTL Cookie (Recommended)
- Store permissions array in an encrypted, signed cookie (5-min TTL)
- On each request: check cookie first, fallback to DB if expired/missing
- Refresh cookie on any DB hit
- **Security tradeoff**: Up to 5-min window where revoked permissions still work
- **Mitigation**: Add a "force refresh" mechanism for admin role changes
- **Cookie size concern**: Permissions array is small (~200 bytes typically)
- **Effort**: ~3-4 hours

### Option B: Supabase JWT Custom Claims
- Use Supabase Auth hooks to embed permissions in the JWT
- Permissions refresh on token refresh (~1 hour)
- **Security tradeoff**: 1-hour staleness window (too long for permission revocation)
- **Effort**: ~2 hours (Supabase config + code changes)

### Option C: Edge Middleware Cache
- Cache profile in middleware using `cookies()` or edge KV
- Only works on Vercel with Edge Runtime
- **Effort**: ~2 hours but platform-locked

**Recommendation**: Option A. Implement with AES-256-GCM encryption on the cookie value. Add an admin "revoke session" action that clears the cookie for a specific user.

---

## M2 Full: PostgreSQL RPCs for Report Aggregation

**Current state (Phase 1)**: Report queries have `MAX_REPORT_ROWS = 10000` limits and use `Promise.all()` for parallelism. But aggregation still happens in JS.

**Goal**: Move heavy aggregation (SUM, COUNT, AVG over thousands of rows) to PostgreSQL functions.

**RPCs to create**:

### `report_timesheet_summary(filters)`
```sql
CREATE FUNCTION report_timesheet_summary(
  p_start_date date, p_end_date date,
  p_user_id uuid DEFAULT NULL, p_project_id uuid DEFAULT NULL
) RETURNS TABLE(
  user_id uuid, project_id uuid, project_code text,
  total_hours numeric, billable_hours numeric, non_billable_hours numeric,
  entry_count int
)
```

### `report_profitability(filters)`
```sql
CREATE FUNCTION report_profitability(
  p_start_date date, p_end_date date,
  p_client_id uuid DEFAULT NULL, p_project_id uuid DEFAULT NULL
) RETURNS TABLE(
  project_id uuid, project_code text, project_name text, client_name text,
  total_hours numeric, total_expenses numeric, total_invoiced numeric,
  profit numeric, margin_pct numeric
)
```

### `report_invoice_summary(filters)`
```sql
CREATE FUNCTION report_invoice_summary(
  p_start_date date, p_end_date date,
  p_client_id uuid DEFAULT NULL, p_status text DEFAULT NULL
) RETURNS TABLE(
  total_count int, total_amount numeric,
  paid_count int, paid_amount numeric,
  outstanding_count int, outstanding_amount numeric
)
```

### `client_financial_summary(client_id)`
```sql
-- Replaces the double invoice fetch in getClient360()
CREATE FUNCTION client_financial_summary(p_client_id uuid)
RETURNS TABLE(
  total_billed numeric, total_paid numeric, total_outstanding numeric,
  invoice_count int
)
```

**Validation approach**:
1. Create RPCs in a migration
2. Run both old JS aggregation and new RPC in parallel for a sample set
3. Compare outputs programmatically
4. Swap to RPC once validated

**Effort**: ~6-8 hours (4 RPCs + validation + action refactor)

---

## M5: RLS Policy Optimization

**Current state**: RLS policies call `has_permission()` function per row. This joins `profiles → role_permissions → permissions` for every row returned.

**Problem**: A query returning 100 rows triggers 100+ nested permission lookups.

**Options**:

### Option A: Simplify Policies (Recommended first step)
Most queries are user-scoped (`user_id = auth.uid()`). The `has_permission()` call is only needed for admin/manager cross-user access.

Refactor pattern:
```sql
-- Before (slow):
CREATE POLICY "select" ON timesheets FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE manager_id = auth.uid() ...)
  OR has_permission('timesheets.view_all')
);

-- After (fast):
CREATE POLICY "select_own" ON timesheets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "select_managed" ON timesheets FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = timesheets.user_id AND manager_id = auth.uid())
);
CREATE POLICY "select_admin" ON timesheets FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.role_id = (SELECT role_id FROM profiles WHERE id = auth.uid())
    AND p.code = 'timesheets.view_all'
  )
);
```

PostgreSQL evaluates policies with OR — if the first policy matches, others are skipped. User-scoped policy hits first for 95% of queries.

### Option B: Materialized Permission View
```sql
CREATE MATERIALIZED VIEW user_permission_codes AS
SELECT p.id as user_id, perm.code
FROM profiles p
JOIN role_permissions rp ON rp.role_id = p.role_id
JOIN permissions perm ON perm.id = rp.permission_id;

-- Refresh on role changes
CREATE TRIGGER refresh_permissions AFTER INSERT OR UPDATE OR DELETE
ON role_permissions FOR EACH STATEMENT
EXECUTE FUNCTION refresh_user_permission_codes();
```

**Security risk**: Stale materialized view = security gap. Must be refreshed on every role change.

### Option C: Session-scoped permission cache
Use `set_config('app.permissions', ...)` in middleware to cache permissions for the current transaction.

**Recommendation**: Start with Option A (separate policies, user-scoped first). Measure improvement. Only pursue B/C if still slow.

**Effort**: Option A: ~3-4 hours. Option B: ~4-6 hours.

---

## Skeleton Component Library

**Current state**: Skeleton loaders are duplicated across 14 `loading.tsx` files with similar patterns.

**Goal**: Extract common skeleton patterns into reusable components.

**Components to create** (in `src/components/ui/skeletons/`):
- `TableSkeleton` — configurable rows/columns, with optional header
- `CardGridSkeleton` — grid of card placeholders (for dashboard stats)
- `FormSkeleton` — labeled fields with input placeholders
- `DetailPageSkeleton` — header + tabs + content area
- `ListPageSkeleton` — search bar + filter row + table

**Usage**:
```tsx
// Before (loading.tsx):
export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-[400px]" />
    </div>
  )
}

// After:
export default function Loading() {
  return <ListPageSkeleton title cards={4} tableRows={10} />
}
```

**Effort**: ~2-3 hours

**Priority**: Low — functional improvement only, no performance impact. Nice-to-have for consistency.
