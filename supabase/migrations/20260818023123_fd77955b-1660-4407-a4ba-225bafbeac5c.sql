CREATE TABLE public.market_data_chunks (
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

CREATE POLICY "Users manage own market_data_chunks"
ON public.market_data_chunks FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_market_data_chunks_lookup ON public.market_data_chunks (user_id, symbol, interval, period);

CREATE TRIGGER update_market_data_chunks_updated_at
BEFORE UPDATE ON public.market_data_chunks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();