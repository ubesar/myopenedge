export interface Playbook {
  id: string;
  user_id: string;
  name: string;
  tag: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaybookWithStats extends Playbook {
  trades_count: number;
  net_pnl: number;
  win_rate: number;
}
