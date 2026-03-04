-- Employee Documents & Receipts System
-- Adds CCQ card tracking to profiles and receipt support to expenses/timesheets

-- 1. CCQ Card fields on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ccq_card_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ccq_card_expiry DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ccq_card_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ccq_card_uploaded_at TIMESTAMPTZ;

-- 2. Receipt fields on expense_entries
ALTER TABLE expense_entries ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE expense_entries ADD COLUMN IF NOT EXISTS receipt_uploaded_at TIMESTAMPTZ;

-- 3. Receipt fields on timesheet_entries (parking receipts, etc.)
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS receipt_note TEXT;

-- 4. Create storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-documents',
  'employee-documents',
  false,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage RLS Policies
-- Path convention: {folder}/{user_id}/{filename}
-- e.g., ccq-cards/abc-123-uuid/card.jpg

-- Policy: Admins can do everything
CREATE POLICY "admins_manage_all_employee_docs"
ON storage.objects FOR ALL
USING (
  bucket_id = 'employee-documents' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND user_type = 'admin'
  )
);

-- Policy: Employees can SELECT their own documents (path contains their user_id)
CREATE POLICY "employees_view_own_docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-documents' AND
  name LIKE '%' || auth.uid()::text || '%'
);

-- Policy: Employees can INSERT their own documents
CREATE POLICY "employees_upload_own_docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-documents' AND
  name LIKE '%' || auth.uid()::text || '%'
);

-- Policy: Employees can UPDATE their own documents
CREATE POLICY "employees_update_own_docs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'employee-documents' AND
  name LIKE '%' || auth.uid()::text || '%'
);

-- Policy: Employees can DELETE their own documents
CREATE POLICY "employees_delete_own_docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'employee-documents' AND
  name LIKE '%' || auth.uid()::text || '%'
);

-- 6. Index for CCQ card expiry queries (for admin dashboard)
CREATE INDEX IF NOT EXISTS idx_profiles_ccq_card_expiry
ON profiles (ccq_card_expiry)
WHERE ccq_card_expiry IS NOT NULL;

-- 7. Comment on new columns
COMMENT ON COLUMN profiles.ccq_card_number IS 'CCQ card number for construction workers';
COMMENT ON COLUMN profiles.ccq_card_expiry IS 'CCQ card expiry date for compliance tracking';
COMMENT ON COLUMN profiles.ccq_card_url IS 'URL to CCQ card image in Supabase Storage';
COMMENT ON COLUMN expense_entries.receipt_url IS 'URL to receipt image in Supabase Storage';
COMMENT ON COLUMN timesheet_entries.receipt_url IS 'URL to receipt image (parking, etc.) in Supabase Storage';
COMMENT ON COLUMN timesheet_entries.receipt_note IS 'Note describing the receipt/expense';
