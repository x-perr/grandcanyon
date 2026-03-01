-- Create enum for invitation status
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- Create user_invitations table
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for token lookup (used during invitation acceptance)
CREATE INDEX idx_user_invitations_token ON user_invitations(token) WHERE status = 'pending';

-- Create index for email lookup
CREATE INDEX idx_user_invitations_email ON user_invitations(email);

-- Create index for listing pending invitations
CREATE INDEX idx_user_invitations_status ON user_invitations(status, created_at DESC);

-- Add updated_at trigger
CREATE TRIGGER update_user_invitations_updated_at
  BEFORE UPDATE ON user_invitations
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS policies
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Only admins can view invitations
CREATE POLICY "Admins can view all invitations"
  ON user_invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN profiles p ON p.role_id = rp.role_id
      JOIN permissions perm ON perm.id = rp.permission_id
      WHERE p.id = auth.uid() AND perm.code = 'admin.manage'
    )
  );

-- Only admins can create invitations
CREATE POLICY "Admins can create invitations"
  ON user_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN profiles p ON p.role_id = rp.role_id
      JOIN permissions perm ON perm.id = rp.permission_id
      WHERE p.id = auth.uid() AND perm.code = 'admin.manage'
    )
  );

-- Only admins can update invitations (revoke, etc.)
CREATE POLICY "Admins can update invitations"
  ON user_invitations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN profiles p ON p.role_id = rp.role_id
      JOIN permissions perm ON perm.id = rp.permission_id
      WHERE p.id = auth.uid() AND perm.code = 'admin.manage'
    )
  );

-- Comment for documentation
COMMENT ON TABLE user_invitations IS 'Tracks user invitations sent by admins. Invitations have a token for accepting and expire after a set period.';
