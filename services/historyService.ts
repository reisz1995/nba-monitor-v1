
import { supabase } from '../lib/supabase';
import { HistoryLog } from '../types';

export const logHistory = async (entry: Omit<HistoryLog, 'id' | 'created_at'>) => {
  try {
    const { error } = await supabase
      .from('history_logs')
      .insert([entry]);

    if (error) {
      console.error('Erro ao salvar histórico no Supabase:', error);
    }
  } catch (err) {
    console.error('Falha na comunicação com history_logs:', err);
  }
};
