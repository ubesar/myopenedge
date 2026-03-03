
-- Table to store every analysis run history
CREATE TABLE public.analysis_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_type TEXT NOT NULL, -- 'ib', 'momentum', 'occ', 'gapfill'
  symbol TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;

-- Users manage own runs
CREATE POLICY "Users manage own analysis_runs"
ON public.analysis_runs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_analysis_runs_user_created ON public.analysis_runs (user_id, created_at DESC);
