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
    <div className="flex flex-col gap-12 animate-fade-in-up font-oswald text-slate-100">

      {/* HEADER & STATS */}
      <div className="flex flex-col lg:flex-row justify-between gap-8 border-b-4 border-white/10 pb-12">
        <div className="flex items-center gap-6">
          <div className="bg-white p-4 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
            <History className="w-12 h-12 text-black" />
          </div>
          <div>
            <h3 className="text-3xl md:text-7xl font-black italic uppercase tracking-tighter leading-none font-oswald">
              VAULT <span className="text-slate-500 font-black">ARCHIVE</span>
            </h3>
            <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.4em] mt-4 flex items-center gap-2 font-mono">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> WIN_RATE: {winRate}% | TOTAL_NODES: {stats.total}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="bg-black/60 border-2 border-white/5 p-6 min-w-[140px] flex flex-col items-center justify-center shadow-[6px_6px_0px_#000] spotlight-hover">
            <span className="text-[11px] font-black text-slate-500 uppercase mb-2 tracking-widest">GREENS</span>
            <span className="text-4xl font-black text-emerald-500 italic font-bebas">{stats.green}</span>
          </div>
          <div className="bg-black/60 border-2 border-white/5 p-6 min-w-[140px] flex flex-col items-center justify-center shadow-[6px_6px_0px_#000] spotlight-hover">
            <span className="text-[11px] font-black text-slate-500 uppercase mb-2 tracking-widest">REDS</span>
            <span className="text-4xl font-black text-nba-red italic font-bebas">{stats.red}</span>
          </div>
          <div className="bg-black/60 border-2 border-white/5 p-6 min-w-[140px] flex flex-col items-center justify-center shadow-[6px_6px_0px_#000] spotlight-hover">
            <span className="text-[11px] font-black text-slate-500 uppercase mb-2 tracking-widest">PENDING</span>
            <span className="text-4xl font-black text-nba-gold italic font-bebas">{stats.pending}</span>
          </div>
        </div>
      </div>

      {/* ESPN LIVE SCORES */}
      <EspnScoreboard />

      <div className="bg-black/40 backdrop-blur-xl border-2 border-white/10 overflow-hidden shadow-[16px_16px_0px_rgba(0,0,0,0.5)] glass-morphism">
        {loading ? (
          <div className="py-32 text-center flex flex-col items-center gap-6">
            <Zap className="w-10 h-10 text-nba-blue animate-pulse shadow-nba-blue" />
            <span className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-500 font-mono">DECRYPTING_ARCHIVES...</span>
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
