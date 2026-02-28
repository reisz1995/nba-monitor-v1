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

interface AnalysisRecord {
  id: number;
  team_a_id: number;
  team_b_id: number;
  winner: string;
  confidence: number;
  key_factor: string;
  detailed_analysis: string;
  sources: any[];
  result: 'green' | 'red' | 'pending';
  created_at: string;
}

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
    total: records.length,
    green: records.filter(r => r.result === 'green').length,
    red: records.filter(r => r.result === 'red').length,
    pending: records.filter(r => r.result === 'pending').length,
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
        sources: record.sources
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
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-900/80 backdrop-blur-md text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b-2 border-slate-800">
              <th className="px-6 py-4">CONFRONTATION</th>
              <th className="px-6 py-4">AI SELECTION</th>
              <th className="px-6 py-4 text-center">RESULT</th>
              <th className="px-6 py-4 text-center">CONFIDENCE</th>
              <th className="px-6 py-4 text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <Zap className="w-8 h-8 text-indigo-500 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Decrypting Archives...</span>
                  </div>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center italic text-slate-700 uppercase font-black tracking-widest text-xs">
                  No analysis records found in database.
                </td>
              </tr>
            ) : (
              records.map((record) => {
                const teamA = getTeam(record.team_a_id);
                const teamB = getTeam(record.team_b_id);

                return (
                  <tr key={record.id} onClick={() => handleItemClick(record)} className="border-b border-slate-900 hover:bg-white/[0.02] transition-all group cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-5">
                        <div className="flex items-center -space-x-4">
                          <div className="w-12 h-12 bg-slate-900 border-2 border-slate-800 p-2 transform -rotate-3 group-hover:rotate-0 transition-transform shadow-lg overflow-hidden flex items-center justify-center">
                            <img src={teamA?.logo} className="max-w-full max-h-full object-contain" alt="" />
                          </div>
                          <div className="w-12 h-12 bg-slate-900 border-2 border-slate-800 p-2 transform rotate-6 group-hover:rotate-0 transition-transform shadow-lg z-10 overflow-hidden flex items-center justify-center">
                            <img src={teamB?.logo} className="max-w-full max-h-full object-contain" alt="" />
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-base font-black uppercase tracking-tighter leading-none mb-1">
                            {teamA?.name} <span className="text-slate-700 text-xs">VS</span> {teamB?.name}
                          </span>
                          <span className="text-[9px] text-slate-600 font-extrabold uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-2.5 h-2.5" /> {new Date(record.created_at).toLocaleDateString('pt-BR')} {new Date(record.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 max-w-[320px]">
                        <span className="text-sm font-black text-indigo-400 italic uppercase leading-none border-l-2 border-indigo-500/30 pl-3">
                          {record.winner}
                        </span>
                        <p className="text-[10px] text-slate-500 font-bold uppercase leading-tight pl-3 line-clamp-2">
                          {record.key_factor}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={(e) => updateStatus(e, record.id, 'green')}
                          className={`w-10 h-10 border-2 transition-all flex items-center justify-center ${record.result === 'green'
                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                            : 'bg-slate-950 border-slate-800 text-slate-800 hover:border-emerald-500/50'
                            }`}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => updateStatus(e, record.id, 'red')}
                          className={`w-10 h-10 border-2 transition-all flex items-center justify-center ${record.result === 'red'
                            ? 'bg-rose-600/20 border-rose-500 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                            : 'bg-slate-950 border-slate-800 text-slate-800 hover:border-rose-500/50'
                            }`}
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => updateStatus(e, record.id, 'pending')}
                          className={`w-10 h-10 border-2 transition-all flex items-center justify-center ${record.result === 'pending'
                            ? 'bg-amber-600/20 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                            : 'bg-slate-950 border-slate-800 text-slate-800 hover:border-amber-500/50'
                            }`}
                        >
                          <Clock className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-block px-3 py-1 bg-slate-900 border border-slate-800 rounded-sm">
                        <span className="text-base font-black text-white italic">
                          {record.confidence}<span className="text-[10px] text-slate-600 not-italic ml-0.5 font-sans">%</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={(e) => deleteRecord(e, record.id)}
                        className="p-2 text-slate-800 hover:text-rose-500 transition-colors transform hover:scale-110"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default MatchupHistory;
