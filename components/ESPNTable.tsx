
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { ESPNData, Team, GameResult } from '../types';
import { INITIAL_ESPN_DATA } from '../constants';

interface ESPNTableProps {
  teams: Team[];
  selectedTeams?: number[];
}

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: string;
  direction: SortDirection;
}

const ESPNTable: React.FC<ESPNTableProps> = ({ teams, selectedTeams = [] }) => {
  const [data, setData] = useState<ESPNData[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingOfflineData, setUsingOfflineData] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  useEffect(() => {
    fetchESPNData();

    const subscription = supabase
      .channel('classificacao_nba_changes_table')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classificacao_nba' }, () => {
        fetchESPNData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchESPNData = async () => {
    setLoading(true);
    try {
      const { data: rawData, error } = await supabase
        .from('classificacao_nba')
        .select('*');

      if (error) throw error;

      if (rawData && rawData.length > 0) {
        processData(rawData);
        setUsingOfflineData(false);
      } else {
        throw new Error("Tabela vazia.");
      }
    } catch (error: any) {
      setUsingOfflineData(true);
      useFallbackData();
    } finally {
      setLoading(false);
    }
  };

  const useFallbackData = () => {
    const fallback = INITIAL_ESPN_DATA.map((d, i) => ({
      ...d,
      id: i + 1000
    }));
    processData(fallback);
  };

  const processData = (rawData: any[]) => {
    const defaultSorted = [...rawData].sort((a, b) => {
      const pctA = Number(a.aproveitamento) || 0;
      const pctB = Number(b.aproveitamento) || 0;
      if (Math.abs(pctA - pctB) < 0.0001) {
        return (Number(b.vitorias) || 0) - (Number(a.vitorias) || 0);
      }
      return pctB - pctA;
    });
    setData(defaultSorted);
  };

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    return [...data].sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      if (valA === valB) {
        if (sortConfig.key === 'aproveitamento') {
          return sortConfig.direction === 'asc'
            ? (Number(a.vitorias) || 0) - (Number(b.vitorias) || 0)
            : (Number(b.vitorias) || 0) - (Number(a.vitorias) || 0);
        }
        return 0;
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      return sortConfig.direction === 'asc' ? 1 : -1;
    });
  }, [data, sortConfig]);

  const renderLast5 = (sequence: string | null | undefined) => {
    if (!sequence) return <span className="text-slate-600">-</span>;
    const streakStr = String(sequence).toUpperCase();
    let games: GameResult[] = [];

    const streakMatch = streakStr.match(/([WL])(\d+)/);
    if (streakMatch) {
      const type = streakMatch[1];
      const count = Math.min(parseInt(streakMatch[2], 10), 5);
      const result: GameResult = (type === 'W' || type === 'V') ? 'V' : 'D';
      const opposite: GameResult = result === 'V' ? 'D' : 'V';
      games = new Array(5).fill(opposite);
      for (let i = 0; i < count; i++) games[4 - i] = result;
    } else {
      const chars = streakStr.match(/[VDWL]/g) || [];
      games = chars.map(c => (c === 'W' || c === 'V' ? 'V' : 'D')) as GameResult[];
      if (games.length > 5) games = games.slice(-5);
      if (games.length < 5 && games.length > 0) {
        const padding = new Array(5 - games.length).fill(games[0] === 'V' ? 'D' : 'V');
        games = [...padding, ...games];
      }
    }

    return (
      <div className="flex gap-0.5 justify-center min-w-[50px]">
        {games.map((result, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-sm ${result === 'V' ? 'bg-emerald-500/80 shadow-[0_0_4px_rgba(16,185,129,0.3)]' : 'bg-rose-500/80'}`}
          />
        ))}
      </div>
    );
  };

  const findTeamStats = (espnTeamName: string | undefined) => {
    if (!espnTeamName) return null;
    return teams.find(t =>
      t.name.toLowerCase() === espnTeamName.toLowerCase() ||
      espnTeamName.toLowerCase().includes(t.name.toLowerCase())
    );
  };

  const dynamicColumns = useMemo(() => {
    if (data.length === 0) return [];
    const keys = Object.keys(data[0]).filter(key => !['id', 'created_at'].includes(key));
    const priority = ['time', 'nome', 'equipe', 'vitorias', 'derrotas', 'aproveitamento', 'ultimos_5'];
    const otherKeys = keys.filter(k => !priority.includes(k));
    const finalOrder = priority.filter(k => keys.includes(k));
    return [...finalOrder, ...otherKeys];
  }, [data]);

  const getHeaderContent = (key: string) => {
    const abbrMap: Record<string, string> = {
      'MEDIA_PONTOS_ATAQUE': 'PTS+',
      'MEDIA_PONTOS_DEFESA': 'PTS-',
      'APROVEITAMENTO': '%V',
      'VITORIAS': 'V',
      'DERROTAS': 'D',
      'ULTIMOS_5': 'SEQ',
      'STREAK': 'STR',
      'DIFF': 'DIF'
    };
    return abbrMap[key.toUpperCase()] || key.toUpperCase().replace(/_/g, ' ');
  };

  const renderCell = (key: string, value: any) => {
    if (['ultimos_5', 'last_5', 'strk', 'streak'].includes(key)) return renderLast5(value);
    if (['time', 'nome', 'equipe'].includes(key)) {
      const team = findTeamStats(String(value));
      return (
        <div className="flex items-center gap-3 min-w-[140px]">
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
            {team && <img src={team.logo} className="w-7 h-7 object-contain drop-shadow-md" alt="" />}
          </div>
          <span className="font-black text-slate-100 text-[11px] md:text-xs tracking-tighter uppercase italic truncate">{value}</span>
        </div>
      );
    }
    if (typeof value === 'number') {
      if (key.includes('aproveitamento') || (value > 0 && value < 1)) {
        return <span className="text-indigo-400 font-black tracking-tighter">{value.toFixed(3).replace(/^0/, '')}</span>;
      }
      return <span className="font-mono text-slate-300 font-bold">{Number.isInteger(value) ? value : value.toFixed(1)}</span>;
    }
    return <span className="text-slate-400 font-medium">{String(value)}</span>;
  };

  return (
    <div className="bg-black/40 backdrop-blur-xl border-2 border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col w-full glass-morphism">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-black/40 backdrop-blur-md">
        <div className="flex flex-col">
          <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.1em] flex items-center gap-1.5 italic font-mono">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></span>
            PERFORMANCE_DATA_MATRIX
          </h3>
        </div>
        {usingOfflineData && (
          <span className="bg-orange-600/20 text-orange-400 text-[8px] font-black px-1.5 py-0.5 rounded-sm border border-orange-500/30 uppercase italic font-mono">OFFLINE_CACHE</span>
        )}
      </div>

      <div className="table-container custom-scrollbar max-h-[600px] relative overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr className="bg-black/80 backdrop-blur-md">
              {dynamicColumns.map((key, idx) => {
                const isSticky = ['time', 'nome', 'equipe'].includes(key);
                return (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className={`px-3 py-3 text-[9px] font-black text-slate-500 uppercase tracking-tighter whitespace-nowrap cursor-pointer hover:text-indigo-400 transition-all border-b border-white/10 sticky top-0 z-40 bg-black font-mono ${isSticky ? 'left-0 z-50 shadow-[2px_0_8px_rgba(0,0,0,0.8)]' : 'border-l border-white/5'
                      }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{getHeaderContent(key)}</span>
                      <div className="flex flex-col gap-0 opacity-20 scale-75">
                        <span className={`leading-none text-[6px] ${sortConfig?.key === key && sortConfig.direction === 'asc' ? 'text-indigo-500' : 'text-slate-400'}`}>▲</span>
                        <span className={`leading-none text-[6px] ${sortConfig?.key === key && sortConfig.direction === 'desc' ? 'text-indigo-500' : 'text-slate-400'}`}>▼</span>
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              [1, 2, 3, 4, 5, 6].map(i => (
                <tr key={i} className="animate-pulse">
                  {dynamicColumns.map(k => (
                    <td key={k} className="px-3 py-4 border-b border-white/5"><div className="h-1.5 bg-white/5 rounded-sm w-6"></div></td>
                  ))}
                </tr>
              ))
            ) : (
              sortedData.map((row, idx) => {
                const team = findTeamStats(row.time);
                const isSelected = team && selectedTeams.includes(team.id);
                return (
                  <tr key={idx} className={`group transition-all duration-300 ${isSelected ? 'bg-indigo-500/10' : 'hover:bg-white/5'} cursor-pointer`}>
                    {dynamicColumns.map((key) => {
                      const isSticky = ['time', 'nome', 'equipe'].includes(key);
                      return (
                        <td
                          key={key}
                          className={`px-3 py-2.5 border-b border-white/5 text-[10px] md:text-[11px] whitespace-nowrap font-mono ${isSticky
                            ? `sticky left-0 z-20 bg-black group-hover:bg-zinc-900 shadow-[2px_0_8px_rgba(0,0,0,0.8)] border-r-2 border-indigo-500/20 ${isSelected ? 'bg-indigo-900/40' : ''}`
                            : 'border-l border-white/5'
                            }`}
                        >
                          {renderCell(key, row[key])}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 bg-black/40 border-t border-white/10 flex items-center justify-between">
        <span className="text-[8px] text-slate-600 font-black uppercase italic font-mono tracking-widest">
          {data.length}_FRANCHISES_LOADED
        </span>
        <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>
      </div>
    </div>
  );
};

export default ESPNTable;