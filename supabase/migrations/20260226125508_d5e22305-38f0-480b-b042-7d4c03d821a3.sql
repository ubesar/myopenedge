
-- Add prop firm account management columns
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS starting_balance numeric DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS max_loss_limit numeric DEFAULT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS profit_target numeric DEFAULT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS consistency_enabled boolean DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS consistency_percent numeric DEFAULT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS daily_loss_limit_enabled boolean DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS daily_loss_limit numeric DEFAULT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'personal';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
