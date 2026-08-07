CREATE TABLE public.ny_session_bias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  symbol text NOT NULL DEFAULT 'NQ',
  session_date date NOT NULL,
  orb_high_price numeric NOT NULL,
  orb_low_price numeric NOT NULL,
  formed_first text NOT NULL,
  first_breakout text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol, session_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ny_session_bias TO authenticated;
GRANT ALL ON public.ny_session_bias TO service_role;

ALTER TABLE public.ny_session_bias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ny_session_bias"
  ON public.ny_session_bias FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_ny_session_bias_updated_at
  BEFORE UPDATE ON public.ny_session_bias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();