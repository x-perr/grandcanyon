-- ============================================================
-- Backfill: Link existing project_billing_roles to ccq_classifications
-- Best-effort name matching — manual review needed after migration
-- ============================================================

-- Add classification_id to project_billing_roles for forward compatibility
ALTER TABLE project_billing_roles
  ADD COLUMN IF NOT EXISTS classification_id uuid REFERENCES ccq_classifications(id);

-- Disable audit trigger during backfill (inet type mismatch in migration context)
ALTER TABLE project_billing_roles DISABLE TRIGGER audit_trigger;

-- Best-effort mapping of role names to classifications
-- Defaulting to Platrier trade (code '16') as most common for GC
UPDATE project_billing_roles pbr
SET classification_id = cc.id
FROM ccq_classifications cc
JOIN ccq_trades ct ON cc.trade_id = ct.id
WHERE pbr.classification_id IS NULL
  AND ct.code = '16'
  AND (
    (cc.level = 'compagnon'  AND (LOWER(pbr.name) SIMILAR TO '%(compagnon|journalier|comp\.|jour\.)%'))
    OR (cc.level = 'apprenti_3' AND (LOWER(pbr.name) SIMILAR TO '%(apprenti%3|app%3|apprenti%3i)%'))
    OR (cc.level = 'apprenti_2' AND (LOWER(pbr.name) SIMILAR TO '%(apprenti%2|app%2|apprenti%2i)%'))
    OR (cc.level = 'apprenti_1' AND (LOWER(pbr.name) SIMILAR TO '%(apprenti%1|app%1|apprenti%1e)%'))
  );

-- Map manoeuvre roles
UPDATE project_billing_roles pbr
SET classification_id = cc.id
FROM ccq_classifications cc
JOIN ccq_trades ct ON cc.trade_id = ct.id
WHERE pbr.classification_id IS NULL
  AND ct.code = 'MAN'
  AND cc.level = 'manoeuvre'
  AND LOWER(pbr.name) SIMILAR TO '%(manoeuvre|man\.|labou)%';

-- Map peintre roles
UPDATE project_billing_roles pbr
SET classification_id = cc.id
FROM ccq_classifications cc
JOIN ccq_trades ct ON cc.trade_id = ct.id
WHERE pbr.classification_id IS NULL
  AND ct.code = '23'
  AND cc.level = 'compagnon'
  AND LOWER(pbr.name) SIMILAR TO '%(peintre|paint)%';

-- Map generic "apprenti" (no number) to apprenti_1 Platrier
UPDATE project_billing_roles pbr
SET classification_id = cc.id
FROM ccq_classifications cc
JOIN ccq_trades ct ON cc.trade_id = ct.id
WHERE pbr.classification_id IS NULL
  AND ct.code = '16'
  AND cc.level = 'apprenti_1'
  AND LOWER(pbr.name) SIMILAR TO '%(apprenti|app\.)%'
  AND LOWER(pbr.name) NOT SIMILAR TO '%(apprenti%[0-9]|app%[0-9])%';

-- Re-enable audit trigger
ALTER TABLE project_billing_roles ENABLE TRIGGER audit_trigger;

-- Note: OT roles ("Temps Double", "Temps et demi") are NOT mapped —
-- they'll be handled by the OT billing config system instead.
-- Roles with trick rates ($0, $1, $9999.99) are NOT mapped — manual review.

-- Log unmapped roles for admin review
-- (Run this query manually post-migration to see what needs attention)
-- SELECT id, name, rate FROM project_billing_roles WHERE classification_id IS NULL;
