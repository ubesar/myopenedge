-- Create table for automated daily analysis results
CREATE TABLE public.auto_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL DEFAULT 'QQQ',
  analysis_date DATE NOT NULL,
  ib_results JSONB,
  momentum_results JSONB,
  ai_insight TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT auto_analyses_symbol_date_unique UNIQUE (symbol, analysis_date)
);

-- Enable RLS
ALTER TABLE public.auto_analyses ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read auto analyses
CREATE POLICY "Authenticated users can read auto analyses"
  ON public.auto_analyses
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX idx_auto_analyses_date ON public.auto_analyses(analysis_date DESC);
CREATE INDEX idx_auto_analyses_symbol_date ON public.auto_analyses(symbol, analysis_date DESC);