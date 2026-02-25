
-- Add subscription columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_end_date timestamp with time zone;

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  invoice_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view their own orders"
ON public.orders FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own orders (via edge function with service role, but also allow direct)
CREATE POLICY "Users can insert their own orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role handles updates via edge functions, but allow select for users
