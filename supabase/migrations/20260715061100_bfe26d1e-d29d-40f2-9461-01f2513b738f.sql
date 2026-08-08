UPDATE public.trades
SET pnl_net = pnl_gross - COALESCE(fees, 0)
WHERE pnl_net IS DISTINCT FROM (pnl_gross - COALESCE(fees, 0));