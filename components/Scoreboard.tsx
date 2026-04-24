
import React, { useState } from 'react';
import { PlayerStat, Team } from '../types';
import { supabase } from '../lib/supabase';

interface ScoreboardProps {
  playerStats: PlayerStat[];
  loading: boolean;
  teams: Team[];
  onRefresh: () => void;
}

const Scoreboard: React.FC<ScoreboardProps> = React.memo(({ playerStats, loading, teams, onRefresh }) => {
  const [seeding, setSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const getTeamLogo = React.useCallback((teamName: string) => {
    if (!teamName) return 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nba.png';
    const cleanName = teamName.toLowerCase();
    const team = teams.find(t =>
      t.name.toLowerCase() === cleanName ||
      cleanName.includes(t.name.toLowerCase()) ||
      t.name.toLowerCase().includes(cleanName)
    );
    return team?.logo || 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nba.png';
  }, [teams]);

  const seedPlayers = React.useCallback(async () => {
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
  }, [onRefresh]);

  const filteredStats = playerStats.filter(player =>
    player.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.time.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-nba-surface/80 backdrop-blur-xl border-2 border-white/10 rounded-sm overflow-hidden shadow-2xl flex flex-col w-full glass-morphism spotlight-hover">
      <div className="px-4 py-3 border-b-2 border-white/5 bg-black/40 flex items-center justify-between shrink-0 gap-2">
        <div>
          <h2 className="text-[11px] font-black text-nba-blue uppercase tracking-[0.2em] flex items-center gap-2 italic font-oswald">
            <span className="w-2 h-2 bg-nba-blue rounded-full shadow-nba-blue"></span>
            Líderes_Estatísticos
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="BUSCA..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-[9px] text-white border-b border-slate-800 focus:border-indigo-500/50 py-0.5 w-16 md:w-24 focus:outline-none placeholder:text-slate-700 font-black uppercase tracking-wider"
          />
          <button onClick={onRefresh} disabled={loading} className="text-slate-600 hover:text-white transition-all disabled:opacity-30">
            <svg className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="overflow-x-hidden overflow-y-auto custom-scrollbar max-h-[500px]">
        <table className="w-full text-left border-separate border-spacing-0 table-fixed">
          <thead>
            <tr className="sticky top-0 z-10 bg-black text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10 font-oswald">
              <th className="w-[45%] pl-4 py-3 font-black italic">Player_Node</th>
              <th className="w-[18%] py-3 text-center border-l border-white/5">PTS</th>
              <th className="w-[18%] py-3 text-center border-l border-white/5">REB</th>
              <th className="w-[19%] py-3 text-center border-l border-white/5 pr-1">AST</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30">
            {loading && playerStats.length === 0 ? (
              [1, 2, 3, 4, 5].map(i => (
                <tr key={i} className="animate-pulse">
                  <td className="pl-3 py-3"><div className="h-1.5 bg-slate-800/50 rounded-sm w-16"></div></td>
                  <td className="py-3"><div className="h-1.5 bg-slate-800/50 rounded-sm w-6 mx-auto"></div></td>
                  <td className="py-3"><div className="h-1.5 bg-slate-800/50 rounded-sm w-6 mx-auto"></div></td>
                  <td className="py-3"><div className="h-1.5 bg-slate-800/50 rounded-sm w-6 mx-auto"></div></td>
                </tr>
              ))
            ) : filteredStats.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center font-black italic">
                  <span className="text-[9px] text-slate-700 tracking-widest uppercase">{playerStats.length === 0 ? "Sem Conexão" : "Vazio"}</span>
                </td>
              </tr>
            ) : (
              filteredStats.map((player, idx) => (
                <tr key={player.id || idx} className="hover:bg-white/5 transition-all group">
                  <td className="pl-4 py-3">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[12px] font-black text-slate-100 truncate group-hover:text-nba-blue transition-colors uppercase italic tracking-tighter leading-none font-oswald">{player.nome.split(' ').pop()}</span>
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest truncate leading-tight opacity-50 font-mono mt-1">{player.time.replace('Los Angeles ', 'LA ').replace('Oklahoma City ', 'OKC ')}</span>
                    </div>
                  </td>
                  <td className="py-3 text-center text-[15px] font-black text-nba-blue font-bebas border-l border-white/5 leading-none">{Number(player.pontos).toFixed(1)}</td>
                  <td className="py-3 text-center text-[13px] font-bold text-slate-300 font-bebas border-l border-white/5 opacity-80 leading-none">{Number(player.rebotes).toFixed(1)}</td>
                  <td className="py-3 text-center text-[13px] font-bold text-slate-300 font-bebas border-l border-white/5 opacity-80 leading-none pr-1">{Number(player.assistencias).toFixed(1)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 bg-black/60 border-t-2 border-white/5 flex items-center justify-between">
        <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest font-oswald">
          {filteredStats.length}_NODES_ACTIVE
        </span>
        <div className="w-2 h-2 bg-nba-blue rounded-full animate-pulse shadow-nba-blue"></div>
      </div>
    </div>
  );
});

export default Scoreboard;