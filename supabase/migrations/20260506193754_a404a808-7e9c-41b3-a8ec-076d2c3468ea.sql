-- Drop overly permissive anon policies on ea_control
DROP POLICY IF EXISTS "Anon can read ea_control" ON public.ea_control;
DROP POLICY IF EXISTS "Anon can update ea_control" ON public.ea_control;

-- Restrict midtrans_webhook_logs to admins only (RLS already enabled, no policies = deny all by default)
-- Service role bypasses RLS so webhook handler still works. Add explicit admin read policy.
CREATE POLICY "Admins can view midtrans_webhook_logs"
  ON public.midtrans_webhook_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));