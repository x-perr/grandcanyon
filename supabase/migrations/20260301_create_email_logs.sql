-- Email logs table for CRM tracking
-- Run this migration in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Email details
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_id TEXT NOT NULL, -- 'invoice_sent', 'payment_reminder', 'timesheet_reminder', etc.

  -- Resend tracking
  resend_id TEXT, -- Message ID from Resend
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'bounced', 'complained', 'opened', 'clicked', 'failed')),

  -- Related entity (polymorphic)
  related_type TEXT, -- 'invoice', 'timesheet', 'project', 'user'
  related_id UUID,

  -- Metadata
  metadata JSONB DEFAULT '{}', -- Custom message, tracking data, etc.

  -- Tracking timestamps
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,

  -- Audit
  sent_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_related ON email_logs(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_resend_id ON email_logs(resend_id);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (uses existing has_permission() function)
-- Admins can see all email logs
CREATE POLICY "Admins can view all email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (
    has_permission('admin.manage') OR has_permission('invoices.send')
  );

-- Admins can insert email logs
CREATE POLICY "Admins can insert email logs"
  ON email_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    has_permission('admin.manage') OR has_permission('invoices.send') OR has_permission('timesheets.view_all')
  );

-- Allow updates via service role (for webhooks updating status)
CREATE POLICY "Allow status updates"
  ON email_logs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_logs_updated_at ON email_logs;
CREATE TRIGGER email_logs_updated_at
  BEFORE UPDATE ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_email_logs_updated_at();

-- Comment
COMMENT ON TABLE email_logs IS 'Tracks all outgoing emails with Resend delivery status';
