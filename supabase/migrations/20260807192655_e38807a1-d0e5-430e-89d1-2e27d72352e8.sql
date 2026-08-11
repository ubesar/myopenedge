CREATE TABLE public.ny_session_bias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol text NOT NULL DEFAULT 'NQ',
  session_date date NOT NULL,
  orb_high_price numeric,
  orb_low_price numeric,
  formed_first text,
  first_breakout text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (symbol, session_date)
);
GRANT SELECT, INSERT, UPDATE ON public.ny_session_bias TO authenticated;
GRANT ALL ON public.ny_session_bias TO service_role;
ALTER TABLE public.ny_session_bias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read ny session bias" ON public.ny_session_bias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert ny session bias" ON public.ny_session_bias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update ny session bias" ON public.ny_session_bias FOR UPDATE TO authenticated USING (true) WITH CHECK (true);