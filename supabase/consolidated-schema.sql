-- ============================================================
-- MyOpenEdge — Consolidated Schema Migration (with GRANTs)
-- Target: fresh external Supabase project
-- Run ONCE via the migration tool after connecting external Supabase.
-- Fixes the critical missing-GRANT issue (18/19 tables had RLS but no GRANT).
-- ============================================================

-- ---- Extensions ----
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ---- Updated_at helper (referenced by triggers) ----
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  subscription_status text NOT NULL DEFAULT 'free',
  subscription_end_date timestamp with time zone,
  default_risk NUMERIC,
  max_daily_risk NUMERIC,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- orders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  invoice_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  payment_method text DEFAULT 'paddle',
  midtrans_order_id text,
  amount numeric,
  currency text DEFAULT 'IDR',
  payment_type text,
  snap_token text,
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
CREATE POLICY "Users can insert their own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
CREATE POLICY "Users can update their own orders" ON public.orders FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  broker TEXT,
  currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'America/New_York',
  is_default BOOLEAN DEFAULT false,
  starting_balance numeric DEFAULT 0,
  max_loss_limit numeric DEFAULT NULL,
  profit_target numeric DEFAULT NULL,
  consistency_enabled boolean DEFAULT false,
  consistency_percent numeric DEFAULT NULL,
  daily_loss_limit_enabled boolean DEFAULT false,
  daily_loss_limit numeric DEFAULT NULL,
  account_type text DEFAULT 'personal',
  status text DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own accounts" ON public.accounts;
CREATE POLICY "Users manage own accounts" ON public.accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- instruments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.instruments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT,
  tick_size NUMERIC,
  tick_value NUMERIC,
  point_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instruments TO authenticated;
GRANT ALL ON public.instruments TO service_role;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own instruments" ON public.instruments;
CREATE POLICY "Users manage own instruments" ON public.instruments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- playbooks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  tag TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playbooks TO authenticated;
GRANT ALL ON public.playbooks TO service_role;
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own playbooks" ON public.playbooks;
CREATE POLICY "Users manage own playbooks" ON public.playbooks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_playbooks_updated_at ON public.playbooks;
CREATE TRIGGER update_playbooks_updated_at BEFORE UPDATE ON public.playbooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- import_batches
-- ============================================================
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  rows_count INTEGER,
  errors JSONB,
  file_name TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own import_batches" ON public.import_batches;
CREATE POLICY "Users manage own import_batches" ON public.import_batches FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- trades
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC NOT NULL,
  open_time TIMESTAMPTZ NOT NULL,
  close_time TIMESTAMPTZ NOT NULL,
  pnl_gross NUMERIC NOT NULL,
  pnl_net NUMERIC NOT NULL,
  fees NUMERIC DEFAULT 0,
  r_multiple NUMERIC,
  session TEXT,
  setup_tags TEXT[],
  grade TEXT,
  notes TEXT,
  playbook TEXT,
  playbook_id UUID REFERENCES public.playbooks(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  instrument_id UUID REFERENCES public.instruments(id) ON DELETE SET NULL,
  import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'MANUAL',
  confidence_score NUMERIC,
  sl_ticks NUMERIC,
  tp_ticks NUMERIC,
  order_ids text[] DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own trades" ON public.trades;
CREATE POLICY "Users manage own trades" ON public.trades FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_trades_updated_at ON public.trades;
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- attachments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own attachments" ON public.attachments;
CREATE POLICY "Users manage own attachments" ON public.attachments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- daily_notes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_notes TO authenticated;
GRANT ALL ON public.daily_notes TO service_role;
ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own daily_notes" ON public.daily_notes;
CREATE POLICY "Users manage own daily_notes" ON public.daily_notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_daily_notes_updated_at ON public.daily_notes;
CREATE TRIGGER update_daily_notes_updated_at BEFORE UPDATE ON public.daily_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.daily_notes DROP CONSTRAINT IF EXISTS daily_notes_user_id_date_key;
ALTER TABLE public.daily_notes ADD CONSTRAINT daily_notes_user_id_date_key UNIQUE (user_id, date);

-- ============================================================
-- analysis_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analysis_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_runs TO authenticated;
GRANT ALL ON public.analysis_runs TO service_role;
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own analysis_runs" ON public.analysis_runs;
CREATE POLICY "Users manage own analysis_runs" ON public.analysis_runs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_user_created ON public.analysis_runs (user_id, created_at DESC);

-- ============================================================
-- ea_control + user_pins
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ea_control (
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ea_control TO authenticated;
GRANT ALL ON public.ea_control TO service_role;
ALTER TABLE public.ea_control ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own ea_control" ON public.ea_control;
CREATE POLICY "Users can view own ea_control" ON public.ea_control FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own ea_control" ON public.ea_control;
CREATE POLICY "Users can insert own ea_control" ON public.ea_control FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own ea_control" ON public.ea_control;
CREATE POLICY "Users can update own ea_control" ON public.ea_control FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own ea_control" ON public.ea_control;
CREATE POLICY "Users can delete own ea_control" ON public.ea_control FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_pins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pin_hash TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_pins TO authenticated;
GRANT ALL ON public.user_pins TO service_role;
ALTER TABLE public.user_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own pins" ON public.user_pins;
CREATE POLICY "Users can view own pins" ON public.user_pins FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own pins" ON public.user_pins;
CREATE POLICY "Users can insert own pins" ON public.user_pins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own pins" ON public.user_pins;
CREATE POLICY "Users can update own pins" ON public.user_pins FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own pins" ON public.user_pins;
CREATE POLICY "Users can delete own pins" ON public.user_pins FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- analysis_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analysis_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'ib',
  symbol TEXT NOT NULL DEFAULT 'QQQ',
  ib_window INTEGER NOT NULL DEFAULT 30,
  max_days INTEGER NOT NULL DEFAULT 15,
  body_ratio TEXT DEFAULT '0.50',
  occ_body_ratio TEXT DEFAULT '0.50',
  occ_timeframe TEXT DEFAULT 'M15',
  weekdays integer[] NOT NULL DEFAULT '{1,2,3,4,5}'::integer[],
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_templates TO authenticated;
GRANT ALL ON public.analysis_templates TO service_role;
ALTER TABLE public.analysis_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own templates" ON public.analysis_templates;
CREATE POLICY "Users manage own templates" ON public.analysis_templates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- api_rate_limits
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  window_start timestamp with time zone NOT NULL DEFAULT date_trunc('hour', now()),
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint, window_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_rate_limits TO authenticated;
GRANT ALL ON public.api_rate_limits TO service_role;
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own rate limits" ON public.api_rate_limits;
CREATE POLICY "Users manage own rate limits" ON public.api_rate_limits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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
  INSERT INTO public.api_rate_limits (user_id, endpoint, window_start, request_count)
  VALUES (_user_id, _endpoint, _current_window, 1)
  ON CONFLICT (user_id, endpoint, window_start)
  DO UPDATE SET request_count = api_rate_limits.request_count + 1
  RETURNING request_count INTO _current_count;
  RETURN _current_count <= _max_requests;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.api_rate_limits WHERE window_start < now() - interval '24 hours';
END;
$$;

-- ============================================================
-- watchlist
-- ============================================================
CREATE TABLE IF NOT EXISTS public.watchlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated;
GRANT ALL ON public.watchlist TO service_role;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own watchlist" ON public.watchlist;
CREATE POLICY "Users manage own watchlist" ON public.watchlist FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- midtrans_webhook_logs (admin-only read)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.midtrans_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text,
  transaction_status text,
  payment_type text,
  raw_payload jsonb,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.midtrans_webhook_logs TO authenticated;
GRANT ALL ON public.midtrans_webhook_logs TO service_role;
ALTER TABLE public.midtrans_webhook_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view midtrans_webhook_logs" ON public.midtrans_webhook_logs;
CREATE POLICY "Admins can view midtrans_webhook_logs" ON public.midtrans_webhook_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- ai_knowledge
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_knowledge TO authenticated;
GRANT ALL ON public.ai_knowledge TO service_role;
ALTER TABLE public.ai_knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own ai_knowledge" ON public.ai_knowledge;
CREATE POLICY "Users manage own ai_knowledge" ON public.ai_knowledge FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- mc_alert_state (admin-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mc_alert_state (
  id int primary key check (id = 1),
  last_alert_time text not null default '',
  last_signal_type text not null default '',
  updated_at timestamptz not null default now()
);
INSERT INTO public.mc_alert_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
GRANT SELECT, UPDATE ON public.mc_alert_state TO authenticated;
GRANT ALL ON public.mc_alert_state TO service_role;
ALTER TABLE public.mc_alert_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage mc_alert_state" ON public.mc_alert_state;
CREATE POLICY "Admins can manage mc_alert_state" ON public.mc_alert_state FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- user_roles + app_role enum + has_role
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Only admins can insert roles (restrictive)" ON public.user_roles;
CREATE POLICY "Only admins can insert roles (restrictive)" ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Only admins can update roles (restrictive)" ON public.user_roles;
CREATE POLICY "Only admins can update roles (restrictive)" ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Only admins can delete roles (restrictive)" ON public.user_roles;
CREATE POLICY "Only admins can delete roles (restrictive)" ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- market_data_chunks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.market_data_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  interval text NOT NULL,
  period text NOT NULL,
  bars jsonb NOT NULL DEFAULT '[]'::jsonb,
  bar_count integer NOT NULL DEFAULT 0,
  first_bar text,
  last_bar text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol, interval, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_data_chunks TO authenticated;
GRANT ALL ON public.market_data_chunks TO service_role;
ALTER TABLE public.market_data_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own market_data_chunks" ON public.market_data_chunks;
CREATE POLICY "Users manage own market_data_chunks" ON public.market_data_chunks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_market_data_chunks_lookup ON public.market_data_chunks (user_id, symbol, interval, period);
DROP TRIGGER IF EXISTS update_market_data_chunks_updated_at ON public.market_data_chunks;
CREATE TRIGGER update_market_data_chunks_updated_at BEFORE UPDATE ON public.market_data_chunks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Storage: trade-screenshots bucket + RLS (private bucket)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('trade-screenshots', 'trade-screenshots', false)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Users upload own screenshots" ON storage.objects;
CREATE POLICY "Users upload own screenshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users view own screenshots" ON storage.objects;
CREATE POLICY "Users view own screenshots" ON storage.objects FOR SELECT USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users delete own screenshots" ON storage.objects;
CREATE POLICY "Users delete own screenshots" ON storage.objects FOR DELETE USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users can update own trade screenshots" ON storage.objects;
CREATE POLICY "Users can update own trade screenshots" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]) WITH CHECK (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- Lock down SECURITY DEFINER function execute permissions
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limits() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
