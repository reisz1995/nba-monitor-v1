
import React, { useState, useMemo } from 'react';
import { Team } from '../types';
import { supabase } from '../lib/supabase';

interface UnavailablePlayersProps {
  players: any[];
  loading: boolean;
  teams: Team[];
  onRefresh: () => void;
}

const UnavailablePlayers: React.FC<UnavailablePlayersProps> = ({ players, loading, teams, onRefresh }) => {
  const [seeding, setSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtra jogadores duplicados pelo nome
  const uniquePlayers = useMemo(() => {
    const seen = new Set();
    return players.filter(p => {
      const name = p.player_name || p.nome;
      if (!name) return false;
      const key = name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [players]);

  const filteredPlayers = useMemo(() => {
    return uniquePlayers.filter(p => {
      const search = searchQuery.toLowerCase();
      const name = (p.player_name || p.nome || '').toLowerCase();
      const team = (p.team_name || p.time || '').toLowerCase();
      return name.includes(search) || team.includes(search);
    });
  }, [uniquePlayers, searchQuery]);

  const getPlayerData = (p: any) => {
    const rawStatus = (p.injury_status || p.gravidade || 'moderada').toUpperCase();

    // Normalização para cores
    let statusType: 'out' | 'dtd' = 'dtd';
    if (rawStatus.includes('OUT') || rawStatus.includes('GRAVE') || rawStatus.includes('FORA')) {
      statusType = 'out';
    }

    return {
      nome: p.player_name || p.nome || 'Jogador',
      time: p.team_name || p.time || 'N/A',
      motivo: p.injury_description || p.motivo || 'Lesão',
      retorno: p.retorno_previsto || 'TBD',
      statusLabel: rawStatus,
      statusType
    };
  };

  const getTeamLogo = (teamName: string) => {
    const team = teams.find(t =>
      t.name.toLowerCase().includes(teamName.toLowerCase()) ||
      teamName.toLowerCase().includes(t.name.toLowerCase())
    );
    return team?.logo || 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nba.png';
  };

  const seedUnavailable = async () => {
    setSeeding(true);
    const mockData = [
      { player_name: 'Joel Embiid', team_name: '76ers', injury_description: 'Cirurgia no Joelho', retorno_previsto: 'Abril/2026', injury_status: 'OUT' },
      { player_name: 'Ja Morant', team_name: 'Grizzlies', injury_description: 'Dores no Ombro', retorno_previsto: 'TBD', injury_status: 'DAY-TO-DAY' },
      { player_name: 'Kawhi Leonard', team_name: 'Clippers', injury_description: 'Inflamação', retorno_previsto: 'Indeterminado', injury_status: 'OUT' },
      { player_name: 'Tyrese Maxey', team_name: '76ers', injury_description: 'Dores nas costas', retorno_previsto: 'TBD', injury_status: 'DAY-TO-DAY' }
    ];
    try {
      const { error } = await supabase.from('nba_injured_players').insert(mockData);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      console.error(err);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="bg-[#0f172a]/80 backdrop-blur-xl border-2 border-slate-800 rounded-sm overflow-hidden shadow-2xl flex flex-col">
      <div className="px-6 py-4 border-b-2 border-slate-800 flex items-center justify-between bg-slate-950">
        <div className="flex flex-col">
          <h3 className="text-[11px] font-black text-rose-500 uppercase tracking-[0.2em] flex items-center gap-2 italic">
            <span className="w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>
            Health Report
          </h3>
          <span className="text-[9px] text-slate-600 font-black uppercase mt-1 tracking-widest">Impacto nos Confrontos 2026</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative border-b-2 border-slate-800 bg-transparent flex items-center px-1">
            <input
              type="text"
              placeholder="FILTRAR JOGADOR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[10px] text-white py-1 w-32 focus:outline-none placeholder:text-slate-700 font-black uppercase tracking-wider"
            />
            <svg className="w-3 h-3 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <button onClick={onRefresh} className="text-slate-600 hover:text-white transition-all transform hover:scale-110">
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="overflow-auto custom-scrollbar max-h-[500px]">
        {filteredPlayers.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center bg-slate-900/40">
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mb-6 italic">
              {uniquePlayers.length === 0 ? "NENHUM DESFALQUE REGISTRADO" : "NENHUM RESULTADO ENCONTRADO"}
            </span>
            {uniquePlayers.length === 0 && (
              <button onClick={seedUnavailable} className="text-[9px] font-black text-rose-500 border-2 border-rose-500/20 px-6 py-2 rounded-sm uppercase bg-rose-500/5 hover:bg-rose-500/10 transition-all flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                Simular Dados
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-x divide-y divide-slate-800/30">
            {filteredPlayers.map((p, idx) => {
              const d = getPlayerData(p);
              return (
                <div key={p.id || idx} className="p-5 flex items-center gap-5 hover:bg-slate-800/20 transition-all group border-b border-slate-800/10 min-h-[100px]">
                  <div className="relative shrink-0 flex items-center justify-center w-12 h-12 border border-slate-800/50 bg-slate-950/50 rounded-sm">
                    <img src={getTeamLogo(d.time)} className="w-10 h-10 object-contain drop-shadow-md group-hover:scale-110 transition-transform" alt="" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-900 border border-slate-800 flex items-center justify-center">
                      <span className="text-[8px] font-black text-slate-500">{idx + 1}</span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-black text-slate-100 truncate group-hover:text-rose-400 transition-colors uppercase italic tracking-tighter">{d.nome}</h3>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm border uppercase tracking-wider shrink-0 ${d.statusType === 'out'
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/40'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/40'
                          }`}>
                          {d.statusLabel}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-500 truncate uppercase tracking-tight">{d.motivo}</span>
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-800/40">
                          <span className="text-[8px] font-black text-slate-600 uppercase">TIME: {d.time}</span>
                          <span className="text-[8px] font-black text-emerald-500 uppercase flex items-center gap-1">
                            <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
                            Retorno: {d.retorno}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-6 py-3 bg-slate-950/60 border-t-2 border-slate-800 flex items-center justify-between">
        <span className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em] italic">
          Integridade Física: {filteredPlayers.length} Baixas Confirmadas
        </span>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
            <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest italic">OUT</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
            <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest italic">DTD</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnavailablePlayers;
