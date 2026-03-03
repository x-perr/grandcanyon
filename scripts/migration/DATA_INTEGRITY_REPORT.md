# Data Integrity Report - Grand Canyon Migration

**Report Date**: 2026-03-03
**Purpose**: Document all data integrity issues discovered during migration for use when fully switching to the new app.

---

## Executive Summary

The current migration has several data integrity gaps that need to be addressed before full production switch:

| Issue | Impact | Priority |
|-------|--------|----------|
| Active/Inactive status not applied | 227 users shown as active instead of 45 | HIGH |
| Project members not imported | 5,036 team assignments missing | HIGH |
| Map coordinates missing | Dashboard map shows no locations | MEDIUM |
| Project status field wrong | Using boolean instead of status enum | MEDIUM |
| Projects need client addresses | Map queries project address, but data is in clients | MEDIUM |

---

## 1. Legacy Data Field Mappings

### Users (`users.json`)

**Important**: Legacy user data does NOT contain address fields. Employee addresses must be entered manually or imported from another source.

| Legacy Field | Legacy Values | Target Field | Target Type |
|--------------|---------------|--------------|-------------|
| `user_active` | `'1'`, `'0'` | `profiles.is_active` | boolean |
| `user_lname` | string | `profiles.last_name` | text |
| `user_fname` | string | `profiles.first_name` | text |
| `user_email` | string | `profiles.email` | text (unique) |
| `user_utid` | integer | `profiles.role_id` | uuid (via mapping) |
| `user_managerid` | integer | `profiles.manager_id` | uuid (via mapping) |

**Address fields NOT available in legacy data:**
- No `user_adresse`, `user_ville`, `user_province`, `user_codepostal` fields
- Employee addresses will need to be populated manually or via separate data source

**Data Counts:**
- Total users in raw data: 225
- Active users (`user_active = '1'`): 45
- Inactive users (`user_active = '0'`): 180

### Clients (`legacy_clients.json`)
| Legacy Field | Legacy Values | Target Field | Target Type |
|--------------|---------------|--------------|-------------|
| `client_actif` | `'O'` (active), `'N'` (inactive) | `clients.is_active` | boolean |
| `client_nom` | string | `clients.name` | text |
| `client_adresse` | string | `clients.address` | text |
| `client_ville` | string | `clients.city` | text |
| `client_province` | string | `clients.state` | text |
| `client_codepostal` | string | `clients.postal_code` | text |
| `client_tel` | string | `clients.phone` | text |

**Data Counts:**
- Total clients in raw data: 360
- Active clients (`client_actif = 'O'`): 228
- Inactive clients (`client_actif = 'N'`): 132

### Projects (`legacy_projects.json`)
| Legacy Field | Legacy Values | Target Field | Target Type |
|--------------|---------------|--------------|-------------|
| `proj_statut` | `2`, `3`, `4` | `projects.status` | enum |
| `proj_actif` | (UNUSED - do not use) | - | - |
| `proj_nom` | string | `projects.name` | text |
| `proj_numero` | string | `projects.number` | text |
| `proj_client_id` | integer | `projects.client_id` | uuid (via mapping) |

**Status Mapping:**
| Legacy `proj_statut` | Count | Target `projects.status` |
|---------------------|-------|--------------------------|
| `2` | 113 | `'active'` |
| `3` | 5,290 | `'completed'` |
| `4` | 1 | `'on_hold'` |

**Data Counts:**
- Total projects in raw data: 5,404

### Project Members (`legacy_user_roles.json`)
| Legacy Field | Target Field | Notes |
|--------------|--------------|-------|
| `role_user_id` | `project_members.user_id` | Map via user_id_mapping |
| `role_projet_id` | `project_members.project_id` | Map via project_id_mapping |
| `role_id` | `project_members.role` | Map role codes to names |

**Data Counts:**
- Total project user roles in raw data: 5,040
- Transformed project members: 5,036 (4 skipped due to missing mappings)
- **Currently in database: 0** (NOT IMPORTED)

### Contacts (`legacy_contacts.json`)
| Legacy Field | Target Field | Target Type |
|--------------|--------------|-------------|
| `contact_nom` | `people.last_name` | text |
| `contact_prenom` | `people.first_name` | text |
| `contact_email` | `people.email` | text |
| `contact_tel` | `people.phone` | text |
| `contact_titre` | `people.title` | text |
| `contact_client_id` | `people.client_id` | uuid (via mapping) |
| - | `people.contact_type` | Always `'client_contact'` |

---

## 2. Known Data Integrity Issues

### Issue 1: Active/Inactive Status Not Applied to Profiles

**Problem**: The database shows 227 active team members, but only 45 should be active.

**Root Cause**: The transformation script correctly generates `is_active` values, but the import script may be:
1. Setting all to `is_active: true` by default
2. Not reading the `is_active` field from transformed data
3. Upsert operation overwriting with defaults

**Verification Query:**
```sql
-- Check current state
SELECT is_active, COUNT(*) FROM profiles GROUP BY is_active;

-- Expected: is_active=true: 45, is_active=false: 180
-- Actual: is_active=true: 227
```

**Fix Required**: Review `3-import-data.js` to ensure `is_active` field is properly imported.

### Issue 2: Project Members Not Imported

**Problem**: 5,036 project member records exist in transformed data but are not in the database.

**File Location**: `scripts/migration/data/transformed/project_members_final2.json`

**Verification Query:**
```sql
SELECT COUNT(*) FROM project_members;
-- Expected: 5036
-- Actual: 0
```

**Fix Required**: Add project members import step to `3-import-data.js`.

### Issue 3: Map Shows No Locations

**Problem**: Dashboard map shows no employee or project locations.

**How Map Works**: The map component (`src/components/dashboard/montreal-map.tsx`) supports TWO methods:
1. **Direct coordinates**: Uses `lat`/`lng` from database if available
2. **Address geocoding**: Falls back to OpenStreetMap Nominatim geocoding using `address` + `city` fields

**Root Cause**: The `people` table has no address data populated. The map CAN work without lat/lng coordinates if addresses are imported.

**Data Source** (`src/app/(protected)/dashboard/actions.ts`):
```typescript
// Fetches employees with coordinates OR addresses
supabase
  .from('profiles')
  .select(`
    id, first_name, last_name,
    person:people!profiles_person_id_fkey(lat, lng, address, city)
  `)
  .eq('is_active', true)
```

**Fix Required**:
1. **Employees**: No address data in legacy system - must be added manually after go-live
2. **Projects**: No direct addresses in legacy system - consider inheriting from client address
3. **Clients**: Address data EXISTS and is being imported correctly to `clients` table
4. Geocoding happens automatically on client-side via Nominatim API

**Address Data Availability**:
| Data Source | Address Available | Status |
|-------------|-------------------|--------|
| Employees (`users.json`) | NO | Manual entry required |
| Projects (`projects.json`) | NO | Inherit from client or manual entry |
| Clients (`clients.json`) | YES | Importing correctly |

**Client Address Fields Being Imported**:
| Legacy Field | Target Field |
|--------------|--------------|
| `client_post_adrl1` | `clients.postal_address_line1` |
| `client_post_city` | `clients.postal_city` |
| `client_post_prov` | `clients.postal_province` |
| `client_post_pc` | `clients.postal_code` |

### Issue 4: Projects Need Addresses for Map

**Problem**: The dashboard map queries `projects.address` and `projects.city`, but legacy project data has no dedicated address fields.

**Key Insight**: Many legacy project names contain the address (e.g., "Salle d'entraînement - rue Paré").

**Current State**:
- Legacy `projects.json` has NO dedicated address fields
- Project NAMES often contain the address/location
- Projects link to clients via `proj_clientid`
- Client addresses ARE available in `clients.json`

**Proposed Design Change**:
1. Make `projects.name` optional in the new system
2. If `projects.name` is empty, display `projects.address` as the title
3. Extract addresses from legacy project names where possible

**Solutions for Map Display**:

**Option A: Parse Address from Project Name** (For Migration)
For projects with address-like names, extract and store in address field:
```javascript
function extractAddressFromName(name) {
  // Look for street indicators in French: rue, avenue, boulevard
  const patterns = [
    /rue\s+[\w\s-]+/i,
    /avenue\s+[\w\s-]+/i,
    /boulevard\s+[\w\s-]+/i,
    /boul\.\s*[\w\s-]+/i,
  ]
  for (const pattern of patterns) {
    const match = name.match(pattern)
    if (match) return match[0]
  }
  return null
}
```

**Option B: Copy Client Address to Project**
Projects inherit their client's address for map display.

**Option C: Modify Map Query** (UI-side fix)
Fetch address from client relation and use as fallback.

### Issue 5: Project Status Mapping

**Problem**: Projects may not be correctly mapped to active/completed/on_hold status.

**Legacy Data Analysis:**
- `proj_statut = 2`: 113 projects (likely active)
- `proj_statut = 3`: 5,290 projects (likely completed)
- `proj_statut = 4`: 1 project (likely on_hold or cancelled)

**Fix Required**: Update `transformProjects()` in `2-transform-data.js`:
```javascript
const STATUS_MAP = {
  2: 'active',
  3: 'completed',
  4: 'on_hold'
};

function transformProject(legacy) {
  return {
    ...other_fields,
    status: STATUS_MAP[legacy.proj_statut] || 'active'
  };
}
```

---

## 3. parseBoolean Function Reference

The transformation script uses this function for boolean fields:

```javascript
function parseBoolean(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const str = String(value).toLowerCase().trim();
  return str === '1' || str === 'true' || str === 'yes' || str === 'o' || str === 'y';
}
```

**Supported True Values**: `1`, `'1'`, `true`, `'true'`, `'yes'`, `'Y'`, `'O'`, `'o'`

---

## 4. Required Actions for Full Migration

### Pre-Migration Checklist

- [ ] Export fresh data from legacy system
- [ ] Backup current database
- [ ] Review and update transformation scripts

### Migration Steps

1. **Extract Raw Data** (1-extract-data.js)
   - Export all tables from legacy MySQL
   - Save to `data/raw/` directory

2. **Transform Data** (2-transform-data.js)
   - Fix: Ensure `parseBoolean` is applied to `user_active`
   - Fix: Map `proj_statut` to status enum correctly
   - Fix: Apply `parseBoolean` to `client_actif`
   - Add: Geocoding for employee addresses (optional)

3. **Import Data** (3-import-data.js)
   - Fix: Import `is_active` field for profiles
   - Fix: Import project members from `project_members_final2.json`
   - Fix: Apply correct `is_active` for clients
   - Fix: Apply correct `status` for projects

4. **Verify Data**
   ```sql
   -- Users active count
   SELECT is_active, COUNT(*) FROM profiles GROUP BY is_active;
   -- Expected: true=45, false=180

   -- Clients active count
   SELECT is_active, COUNT(*) FROM clients GROUP BY is_active;
   -- Expected: true=228, false=132

   -- Projects status count
   SELECT status, COUNT(*) FROM projects GROUP BY status;
   -- Expected: active=113, completed=5290, on_hold=1

   -- Project members count
   SELECT COUNT(*) FROM project_members;
   -- Expected: 5036
   ```

---

## 5. Data File Locations

| File | Path | Purpose |
|------|------|---------|
| Raw Users | `scripts/migration/data/raw/users.json` | 225 legacy user records |
| Raw Clients | `scripts/migration/data/raw/clients.json` | 360 legacy client records |
| Raw Projects | `scripts/migration/data/raw/projects.json` | 5,404 legacy project records |
| Raw Contacts | `scripts/migration/data/raw/contacts.json` | Legacy contact records |
| Raw User Roles | `scripts/migration/data/raw/projectuserrole.json` | 5,040 project assignments |
| Raw Usertypes | `scripts/migration/data/raw/usertypes.json` | Role definitions |
| Raw Apprights | `scripts/migration/data/raw/apprights.json` | Permission definitions |
| Transformed Profiles | `scripts/migration/data/transformed/profiles.json` | Ready for import |
| Transformed People | `scripts/migration/data/transformed/people.json` | Ready for import (employees) |
| Transformed People | `scripts/migration/data/transformed/people_employees.json` | Employee people records |
| Transformed Clients | `scripts/migration/data/transformed/clients.json` | Ready for import |
| Transformed Projects | `scripts/migration/data/transformed/projects.json` | Ready for import |
| Transformed Members | `scripts/migration/data/transformed/project_members_final2.json` | 5,036 records NOT IMPORTED |

---

## 6. Database Schema Reference

### profiles table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  is_active BOOLEAN DEFAULT true,  -- FIX: Should respect legacy data
  user_type user_type DEFAULT 'employee',
  role_id UUID REFERENCES roles(id),
  person_id UUID REFERENCES people(id)
);
```

### people table
```sql
CREATE TABLE people (
  id UUID PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  lat DOUBLE PRECISION,  -- Needs geocoding
  lng DOUBLE PRECISION,  -- Needs geocoding
  contact_type contact_type DEFAULT 'employee',
  client_id UUID REFERENCES clients(id),
  is_active BOOLEAN DEFAULT true
);
```

### project_members table
```sql
CREATE TABLE project_members (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES profiles(id),
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. Design Decisions (Pending)

### Project Name vs Address Display

**Context**: Legacy project names often contain the address (e.g., "Salle d'entraînement - rue Paré").

**Current Behavior**:
- Project `name` is required
- Project `address` is optional
- Map shows projects with `address` + `city` fields

**Proposed Change** (To be designed):
- Make project `name` optional
- If `name` is empty, display `address` as the project title
- Migration script should extract addresses from project names where patterns match

**Questions to Resolve**:
1. What pattern identifies addresses in project names? (rue, avenue, boulevard, etc.)
2. Should address extraction be automatic or manual review?
3. How does the client address relate to project address?
4. What happens when both name and address are empty?

**Status**: PENDING DESIGN DISCUSSION

---

## 8. Contact for Questions

For questions about this migration:
- Review slot file: `docs/xperr/state/slots/grandcanyon-contacts.md`
- Check commit history for migration-related changes
- Contact system architect for schema decisions

---

*Last Updated: 2026-03-03*
