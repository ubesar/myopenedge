
-- Rate limiting table: tracks API calls per user per endpoint per hour
CREATE TABLE public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  window_start timestamp with time zone NOT NULL DEFAULT date_trunc('hour', now()),
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint, window_start)
);

-- Enable RLS
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write their own rate limit records
CREATE POLICY "Users manage own rate limits" ON public.api_rate_limits
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Security definer function to check and increment rate limit
-- Returns true if request is allowed, false if rate limited
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id uuid,
  _endpoint text,
  _max_requests integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_window timestamp with time zone := date_trunc('hour', now());
  _current_count integer;
BEGIN
  -- Upsert: increment or insert
  INSERT INTO public.api_rate_limits (user_id, endpoint, window_start, request_count)
  VALUES (_user_id, _endpoint, _current_window, 1)
  ON CONFLICT (user_id, endpoint, window_start)
  DO UPDATE SET request_count = api_rate_limits.request_count + 1
  RETURNING request_count INTO _current_count;

  -- Check if over limit
  RETURN _current_count <= _max_requests;
END;
$$;

-- Cleanup: auto-delete old rate limit records (older than 24h)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.api_rate_limits
  WHERE window_start < now() - interval '24 hours';
END;
$$;
