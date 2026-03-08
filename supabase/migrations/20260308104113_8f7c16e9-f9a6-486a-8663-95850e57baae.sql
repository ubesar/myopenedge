
CREATE TABLE public.analysis_templates (
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
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.analysis_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own templates"
  ON public.analysis_templates
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
