ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'paddle',
  ADD COLUMN IF NOT EXISTS midtrans_order_id text,
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS payment_type text,
  ADD COLUMN IF NOT EXISTS snap_token text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.midtrans_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text,
  transaction_status text,
  payment_type text,
  raw_payload jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.midtrans_webhook_logs ENABLE ROW LEVEL SECURITY;