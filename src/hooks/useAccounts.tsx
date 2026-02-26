import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Account {
  id: string;
  name: string;
  broker: string | null;
  currency: string | null;
  timezone: string | null;
  is_default: boolean | null;
  account_type: string | null;
  starting_balance: number | null;
  max_loss_limit: number | null;
  profit_target: number | null;
  consistency_enabled: boolean | null;
  consistency_percent: number | null;
  daily_loss_limit_enabled: boolean | null;
  daily_loss_limit: number | null;
  status: string | null;
}

interface AccountContextType {
  accounts: Account[];
  selectedAccountId: string; // 'all' or account id
  setSelectedAccountId: (id: string) => void;
  loading: boolean;
  refetch: () => Promise<void>;
}

const AccountContext = createContext<AccountContextType>({
  accounts: [], selectedAccountId: 'all', setSelectedAccountId: () => {}, loading: true, refetch: async () => {},
});

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('*').order('is_default', { ascending: false }).order('name');
    if (data) setAccounts(data as unknown as Account[]);
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); }, []);

  return (
    <AccountContext.Provider value={{ accounts, selectedAccountId, setSelectedAccountId, loading, refetch: fetchAccounts }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccounts() {
  return useContext(AccountContext);
}
