
-- EA Control table for algo trading commands
CREATE TABLE public.ea_control (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  magic_number INTEGER NOT NULL,
  current_command TEXT NOT NULL DEFAULT 'NONE',
  is_active BOOLEAN NOT NULL DEFAULT true,
  asset_name TEXT NOT NULL DEFAULT '',
  lot_size NUMERIC NOT NULL DEFAULT 0.01,
  risk_usd NUMERIC NOT NULL DEFAULT 0,
  stop_loss NUMERIC NOT NULL DEFAULT 0,
  take_profit NUMERIC NOT NULL DEFAULT 0,
  max_orders INTEGER NOT NULL DEFAULT 1,
  trailing_stop NUMERIC NOT NULL DEFAULT 0,
  breakeven NUMERIC NOT NULL DEFAULT 0,
  slippage NUMERIC NOT NULL DEFAULT 3,
  order_distance NUMERIC NOT NULL DEFAULT 0,
  rr_ratio NUMERIC NOT NULL DEFAULT 2,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, magic_number)
);

-- User PINs table for extra security
CREATE TABLE public.user_pins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pin_hash TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ea_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pins ENABLE ROW LEVEL SECURITY;

-- RLS policies for ea_control
CREATE POLICY "Users can view own ea_control" ON public.ea_control FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ea_control" ON public.ea_control FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ea_control" ON public.ea_control FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own ea_control" ON public.ea_control FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Allow anon read for EA edge function (get-command reads by magic_number)
CREATE POLICY "Anon can read ea_control" ON public.ea_control FOR SELECT TO anon USING (true);
-- Allow anon update for reset-command edge function
CREATE POLICY "Anon can update ea_control" ON public.ea_control FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- RLS policies for user_pins
CREATE POLICY "Users can view own pins" ON public.user_pins FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pins" ON public.user_pins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pins" ON public.user_pins FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own pins" ON public.user_pins FOR DELETE TO authenticated USING (auth.uid() = user_id);
