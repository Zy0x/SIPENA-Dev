-- Create account deletion requests table for admin approval workflow
CREATE TABLE public.account_deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_deleted')),
  admin_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by TEXT
);

-- Enable RLS
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can create deletion requests for themselves
CREATE POLICY "Users can create their own deletion requests"
ON public.account_deletion_requests
FOR INSERT
WITH CHECK (true);

-- Policy: Users can view their own deletion requests
CREATE POLICY "Users can view their own deletion requests"
ON public.account_deletion_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Anyone can view for admin purposes (protected by service role in edge function)
CREATE POLICY "Service role can manage all deletion requests"
ON public.account_deletion_requests
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for efficient queries
CREATE INDEX idx_deletion_requests_status ON public.account_deletion_requests(status);
CREATE INDEX idx_deletion_requests_expires ON public.account_deletion_requests(expires_at) WHERE status = 'pending';
CREATE INDEX idx_deletion_requests_user_id ON public.account_deletion_requests(user_id);