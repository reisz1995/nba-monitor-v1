import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Team, MatchupAnalysis } from '../types';
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  TrendingUp,
  Zap,
  Target,
  Tv
} from 'lucide-react';
import EspnScoreboard from './EspnScoreboard';

interface MatchupHistoryProps {
  teams: Team[];
  onViewHistory: (teamA: Team, teamB: Team, analysis: MatchupAnalysis) => void;
}

import VirtualizedTable, { AnalysisRecord } from './VirtualizedTable';

const MatchupHistory: React.FC<MatchupHistoryProps> = ({ teams, onViewHistory }) => {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('matchup_analyses')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRecords(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const updateStatus = async (e: React.MouseEvent, id: number, status: 'green' | 'red' | 'pending') => {
    e.stopPropagation();
    const { error } = await supabase
      .from('matchup_analyses')
      .update({ result: status })
      .eq('id', id);

    if (!error) {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, result: status } : r));
    }
  };

  const deleteRecord = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja deletar este registro?')) return;
    const { error } = await supabase
      .from('matchup_analyses')
      .delete()
      .eq('id', id);

    if (!error) {
      setRecords(prev => prev.filter(r => r.id !== id));
    }
  };

  const getTeam = (id: number) => teams.find(t => t.id === id);

  const stats = {
    total: Array.isArray(records) ? records.length : 0,
    green: Array.isArray(records) ? records.filter(r => r.result === 'green').length : 0,
    red: Array.isArray(records) ? records.filter(r => r.result === 'red').length : 0,
    pending: Array.isArray(records) ? records.filter(r => r.result === 'pending').length : 0,
  };

  const winRate = stats.green + stats.red > 0
    ? ((stats.green / (stats.green + stats.red)) * 100).toFixed(1)
    : '0';

  const handleItemClick = (record: AnalysisRecord) => {
    const teamA = getTeam(record.team_a_id);
    const teamB = getTeam(record.team_b_id);
    if (teamA && teamB) {
      const analysis: MatchupAnalysis = {
        winner: record.winner,
        confidence: record.confidence,
        keyFactor: record.key_factor,
        detailedAnalysis: record.detailed_analysis,
        result: record.result,
        sources: record.sources,
        momentumData: record.momentum_ma || {} // ✅ Falback de segurança
      };
      onViewHistory(teamA, teamB, analysis);
    }
  };

  return (
    <div className="flex flex-col gap-10 animate-in fade-in duration-700 font-mono text-slate-100">

      {/* HEADER & STATS */}
      <div className="flex flex-col lg:flex-row justify-between gap-8 border-b-4 border-slate-100 pb-10">
        <div className="flex items-center gap-6">
          <div className="bg-white p-4 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
            <History className="w-10 h-10 text-slate-950" />
          </div>
          <div>
            <h3 className="text-5xl font-black italic uppercase tracking-tighter leading-none">
              Vault <span className="text-slate-500">History</span>
            </h3>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-4 flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-emerald-500" /> WIN_RATE: {winRate}% | TOTAL_NODES: {stats.total}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="bg-slate-900/50 border-2 border-slate-800 p-4 min-w-[120px] flex flex-col items-center justify-center shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)]">
            <span className="text-[10px] font-black text-slate-500 uppercase mb-1">GREENS</span>
            <span className="text-3xl font-black text-emerald-500 italic">{stats.green}</span>
          </div>
          <div className="bg-slate-900/50 border-2 border-slate-800 p-4 min-w-[120px] flex flex-col items-center justify-center shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)]">
            <span className="text-[10px] font-black text-slate-500 uppercase mb-1">REDS</span>
            <span className="text-3xl font-black text-rose-500 italic">{stats.red}</span>
          </div>
          <div className="bg-slate-900/50 border-2 border-slate-800 p-4 min-w-[120px] flex flex-col items-center justify-center shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)]">
            <span className="text-[10px] font-black text-slate-500 uppercase mb-1">PENDING</span>
            <span className="text-3xl font-black text-amber-500 italic">{stats.pending}</span>
          </div>
        </div>
      </div>

      {/* ESPN LIVE SCORES */}
      <EspnScoreboard />

      {/* HISTORY TABLE */}
      <div className="bg-slate-950 border-2 border-slate-800 overflow-x-auto shadow-[12px_12px_0px_0px_rgba(0,0,0,0.4)]">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center gap-4">
            <Zap className="w-8 h-8 text-indigo-500 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Decrypting Archives...</span>
          </div>
        ) : !Array.isArray(records) || records.length === 0 ? (
          <div className="py-20 text-center italic text-slate-700 uppercase font-black tracking-widest text-xs">
            No analysis records found in database.
          </div>
        ) : !Array.isArray(teams) || teams.length === 0 ? (
          <div className="py-20 text-center italic text-slate-700 uppercase font-black tracking-widest text-xs">
            Waiting for team data integrity...
          </div>
        ) : (
          <VirtualizedTable
            records={records}
            teams={teams}
            onItemClick={handleItemClick}
            onUpdateStatus={updateStatus}
            onDeleteRecord={deleteRecord}
          />
        )}
      </div>

    </div>
  );
};

export default MatchupHistory;
