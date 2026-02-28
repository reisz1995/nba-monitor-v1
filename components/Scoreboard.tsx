
import React, { useState } from 'react';
import { PlayerStat, Team } from '../types';
import { supabase } from '../lib/supabase';

interface ScoreboardProps {
  playerStats: PlayerStat[];
  loading: boolean;
  teams: Team[];
  onRefresh: () => void;
}

const Scoreboard: React.FC<ScoreboardProps> = ({ playerStats, loading, teams, onRefresh }) => {
  const [seeding, setSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const getTeamLogo = (teamName: string) => {
    if (!teamName) return 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nba.png';
    const cleanName = teamName.toLowerCase();
    const team = teams.find(t =>
      t.name.toLowerCase() === cleanName ||
      cleanName.includes(t.name.toLowerCase()) ||
      t.name.toLowerCase().includes(cleanName)
    );
    return team?.logo || 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nba.png';
  };

  const seedPlayers = async () => {
    setSeeding(true);
    const mockPlayers = [
      { nome: 'Luka Doncic', time: 'Los Angeles Lakers', pontos: 32.8, rebotes: 7.8, assistencias: 8.7, posicao: 'Guard' },
      { nome: 'Shai Gilgeous-Alexander', time: 'Oklahoma City Thunder', pontos: 31.8, rebotes: 4.4, assistencias: 6.2, posicao: 'Guard' },
      { nome: 'Anthony Edwards', time: 'Minnesota Timberwolves', pontos: 29.3, rebotes: 5.2, assistencias: 4.8, posicao: 'Guard' },
      { nome: 'Giannis Antetokounmpo', time: 'Milwaukee Bucks', pontos: 28.0, rebotes: 10.4, assistencias: 5.5, posicao: 'Forward' },
      { nome: 'Tyrese Maxey', time: 'Philadelphia 76ers', pontos: 28.9, rebotes: 4.1, assistencias: 6.7, posicao: 'Guard' },
      { nome: 'Nikola Jokic', time: 'Denver Nuggets', pontos: 28.7, rebotes: 12.1, assistencias: 10.9, posicao: 'Center' },
    ];
    try {
      const { error } = await supabase.from('nba_jogadores_stats').insert(mockPlayers);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      console.error(err);
    } finally {
      setSeeding(false);
    }
  };

  const filteredStats = playerStats.filter(player =>
    player.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.time.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-black/40 backdrop-blur-xl border-2 border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col w-full glass-morphism">
      <div className="px-3 py-3 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between shrink-0 gap-2">
        <div>
          <h2 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-1.5 italic font-mono">
            <span className="w-1 h-1 bg-indigo-500 rounded-full shadow-[0_0_8px_#6366f1]"></span>
            STAT_LEADERS_v1.2
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="FILTER..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-[8px] text-white border-b border-white/10 focus:border-indigo-500/50 py-0.5 w-16 md:w-24 focus:outline-none placeholder:text-slate-700 font-black uppercase tracking-widest font-mono"
          />
          <button onClick={onRefresh} disabled={loading} className="text-slate-500 hover:text-white transition-all disabled:opacity-30 cursor-pointer">
            <svg className={`w-3 h-3 ${loading ? 'animate-spin text-indigo-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="overflow-x-hidden overflow-y-auto custom-scrollbar max-h-[500px]">
        <table className="w-full text-left border-separate border-spacing-0 table-fixed font-mono">
          <thead>
            <tr className="sticky top-0 z-10 bg-black/80 backdrop-blur-md text-[8px] font-black text-slate-500 uppercase tracking-tighter border-b border-white/10">
              <th className="w-[45%] pl-3 py-2 font-black italic">ATLETHE_NODE</th>
              <th className="w-[18%] py-2 text-center border-l border-white/5">PTS</th>
              <th className="w-[18%] py-2 text-center border-l border-white/5">REB</th>
              <th className="w-[19%] py-2 text-center border-l border-white/5 pr-1">AST</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && playerStats.length === 0 ? (
              [1, 2, 3, 4, 5].map(i => (
                <tr key={i} className="animate-pulse">
                  <td className="pl-3 py-3"><div className="h-1 bg-white/5 rounded-sm w-16"></div></td>
                  <td className="py-3"><div className="h-1 bg-white/5 rounded-sm w-6 mx-auto"></div></td>
                  <td className="py-3"><div className="h-1 bg-white/5 rounded-sm w-6 mx-auto"></div></td>
                  <td className="py-3"><div className="h-1 bg-white/5 rounded-sm w-6 mx-auto"></div></td>
                </tr>
              ))
            ) : filteredStats.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center font-black italic">
                  <span className="text-[9px] text-slate-700 tracking-[0.5em] uppercase">{playerStats.length === 0 ? "DISCONNECTED" : "NULL"}</span>
                </td>
              </tr>
            ) : (
              filteredStats.map((player, idx) => (
                <tr key={player.id || idx} className="hover:bg-white/5 transition-all group">
                  <td className="pl-3 py-2.5">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-black text-white truncate group-hover:text-indigo-400 transition-colors uppercase italic tracking-tighter leading-none">{player.nome.split(' ').pop()}</span>
                      <span className="text-[7px] font-black text-slate-600 uppercase tracking-tighter truncate leading-tight opacity-70">{player.time.replace('Los Angeles ', 'LA ').replace('Oklahoma City ', 'OKC ')}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-center text-[11px] font-black text-indigo-400 font-mono tracking-tighter border-l border-white/5 leading-none">{Number(player.pontos).toFixed(1)}</td>
                  <td className="py-2.5 text-center text-[10px] font-bold text-slate-400 font-mono border-l border-white/5 opacity-80 leading-none">{Number(player.rebotes).toFixed(1)}</td>
                  <td className="py-2.5 text-center text-[10px] font-bold text-slate-400 font-mono border-l border-white/5 opacity-80 leading-none pr-1">{Number(player.assistencias).toFixed(1)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-3 py-2 bg-black/40 border-t border-white/10 flex items-center justify-between">
        <span className="text-[7px] text-slate-600 font-black uppercase italic font-mono">
          AGGREGATED_LOGS: {filteredStats.length} ENTITIES
        </span>
        <div className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_#6366f1]"></div>
      </div>
    </div>
  );
};

export default Scoreboard;