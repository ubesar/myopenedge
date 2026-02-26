import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Playbook } from '@/types/playbook';

export function usePlaybooks() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlaybooks = async () => {
    const { data } = await supabase
      .from('playbooks')
      .select('*')
      .order('name');
    if (data) setPlaybooks(data as Playbook[]);
    setLoading(false);
  };

  useEffect(() => { fetchPlaybooks(); }, []);

  const createPlaybook = async (playbook: Omit<Playbook, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase.from('playbooks').insert({ ...playbook, user_id: user.id }).select().single();
    if (error) throw error;
    await fetchPlaybooks();
    return data;
  };

  const updatePlaybook = async (id: string, updates: Partial<Playbook>) => {
    const { error } = await supabase.from('playbooks').update(updates).eq('id', id);
    if (error) throw error;
    await fetchPlaybooks();
  };

  const deletePlaybook = async (id: string) => {
    const { error } = await supabase.from('playbooks').delete().eq('id', id);
    if (error) throw error;
    await fetchPlaybooks();
  };

  return { playbooks, loading, createPlaybook, updatePlaybook, deletePlaybook, refetch: fetchPlaybooks };
}
