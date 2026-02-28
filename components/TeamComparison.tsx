
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Team, MatchupAnalysis, PlayerStat, UnavailablePlayer, GameResult } from '../types';
import { compareTeams, saveMatchupAnalysis } from '../services/geminiService';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import MomentumBar from './MomentumBar';

interface TeamComparisonProps {
  teamA: Team;
  teamB: Team;
  playerStats: PlayerStat[];
  unavailablePlayers: UnavailablePlayer[];
  onClose: () => void;
  initialAnalysis?: MatchupAnalysis;
}

const StatBar: React.FC<{ label: string; valA: number; valB: number; isPercent?: boolean }> = ({ label, valA, valB, isPercent }) => {
  const total = valA + valB;
  const pctA = total > 0 ? (valA / total) * 100 : 50;
  const displayA = isPercent ? `${valA.toFixed(1)}%` : valA.toFixed(1);
  const displayB = isPercent ? `${valB.toFixed(1)}%` : valB.toFixed(1);

  return (
    <div className="flex flex-col gap-2 w-full font-mono">
      <div className="flex justify-between items-end px-1">
        <span className="text-white font-black text-lg">{displayA}</span>
        <span className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">{label}</span>
        <span className="text-slate-300 font-black text-lg">{displayB}</span>
      </div>
      <div className="h-4 w-full bg-black border-2 border-white/10 p-0.5 flex relative overflow-hidden rounded-sm">
        <div style={{ width: `${pctA}%` }} className="h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-1000 ease-out"></div>
        <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none opacity-20">
          <div className="h-full w-px bg-white"></div>
          <div className="h-full w-px bg-white"></div>
          <div className="h-full w-px bg-white"></div>
        </div>
      </div>
    </div>
  );
};

const PlayerCard: React.FC<{ name: string; status?: string; isOut?: boolean; weight?: number }> = ({ name, status, isOut, weight }) => (
  <div className={`flex items-center justify-between p-2 border-2 transition-all w-full font-mono shadow-[4px_4px_0px_#000] rounded-sm ${isOut
    ? 'bg-rose-500/10 border-rose-500 text-rose-500'
    : status
      ? 'bg-amber-500/10 border-amber-500 text-amber-500'
      : 'bg-black border-white/20 text-slate-200'
    }`}>
    <span className="text-[10px] md:text-xs font-black uppercase truncate">
      {name}
    </span>
    <div className="flex items-center gap-2">
      {weight !== undefined && (
        <span title="Handicap de Estrela" className={`text-[10px] font-black border-2 px-1 py-0.5 ${isOut ? 'border-rose-500' : 'border-emerald-500 text-emerald-500 bg-emerald-500/10'}`}>
          HW: {weight.toFixed(1)}
        </span>
      )}
      {status && (
        <span className="text-[8px] font-black px-1 py-0.5 border-2 border-current uppercase">
          {status}
        </span>
      )}
    </div>
  </div>
);

const AdvantageItem: React.FC<{ label: string; valA: string | number; valB: string | number; winner: 'a' | 'b' | 'none'; sub?: string }> = ({ label, valA, valB, winner, sub }) => (
  <div className="flex flex-col border-r-2 border-white/10 last:border-r-0 px-6 py-4 flex-1 min-w-[150px] bg-black hover:bg-zinc-900 transition-colors group relative overflow-hidden font-mono">
    <div className="absolute top-0 left-0 w-full h-1 bg-white/5 group-hover:bg-indigo-500 transition-colors"></div>
    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter mb-6 group-hover:text-slate-300">{label}</span>
    <div className="flex justify-between items-end mb-4">
      <div className="flex flex-col">
        <span className={`text-2xl font-black leading-none ${winner === 'a' ? 'text-white' : 'text-zinc-800'}`}>{valA}</span>
        <span className="text-[6px] font-bold text-slate-600 mt-1 uppercase">TEAM_A</span>
      </div>
      <div className="h-8 w-px bg-white/10 mb-1"></div>
      <div className="flex flex-col items-end">
        <span className={`text-2xl font-black leading-none ${winner === 'b' ? 'text-white' : 'text-zinc-800'}`}>{valB}</span>
        <span className="text-[6px] font-bold text-slate-600 mt-1 uppercase">TEAM_B</span>
      </div>
    </div>
    {sub && (
      <div className="mt-auto pt-4 border-t border-white/5">
        <span className="text-[7px] font-black text-indigo-400 uppercase leading-none block italic">{sub}</span>
      </div>
    )}
  </div>
);

const TeamComparison: React.FC<TeamComparisonProps> = ({ teamA, teamB, playerStats, unavailablePlayers, onClose, initialAnalysis }) => {
  const [analysis, setAnalysis] = useState<MatchupAnalysis | null>(initialAnalysis || null);
  const [loading, setLoading] = useState(!initialAnalysis);
  const [savedToCloud, setSavedToCloud] = useState(!!initialAnalysis);
  const [notas, setNotas] = useState<{ a: number, b: number }>({ a: teamA.ai_score || 0, b: teamB.ai_score || 0 });

  useEffect(() => {
    const fetchTeamNotas = async () => {
      try {
        const { data } = await supabase.from('tabela_notas').select('*').in('franquia', [teamA.name, teamB.name]);
        if (data) {
          const nA = data.find(n => n.franquia === teamA.name)?.nota_ia || teamA.ai_score || 0;
          const nB = data.find(n => n.franquia === teamB.name)?.nota_ia || teamB.ai_score || 0;
          setNotas({ a: Number(nA), b: Number(nB) });
        }
      } catch (e) {
        console.error("Erro ao buscar notas:", e);
      }
    };
    fetchTeamNotas();
  }, [teamA.name, teamB.name, teamA.ai_score, teamB.ai_score]);

  const getInjuriesForTeam = useCallback((teamName: string) => {
    const teamPlayers = (unavailablePlayers || []).filter(p => {
      const pTime = (p.team_name || p.time || p.franquia || '').toLowerCase();
      const tName = teamName.toLowerCase();
      return pTime.includes(tName) || tName.includes(pTime);
    });

    const seen = new Set();
    return teamPlayers.filter(p => {
      const name = p.player_name || p.nome;
      if (!name || seen.has(name.toLowerCase())) return false;
      seen.add(name.toLowerCase());
      return true;
    }).map(p => {
      const status = (p.injury_status || p.gravidade || 'OUT').toUpperCase();
      const isOut = status.includes('OUT') || status.includes('GRAVE') || status.includes('FORA');
      return {
        nome: p.player_name || p.nome,
        status: status,
        isOut
      };
    });
  }, [unavailablePlayers]);

  const injuriesA = useMemo(() => getInjuriesForTeam(teamA.name), [getInjuriesForTeam, teamA.name]);
  const injuriesB = useMemo(() => getInjuriesForTeam(teamB.name), [getInjuriesForTeam, teamB.name]);

  const getPlayerWeight = (pts: number) => Math.floor((pts || 0) / 3);

  const getKeyPlayers = useCallback((teamName: string) => {
    return playerStats
      .filter(p => {
        const pTime = (p.time || '').toLowerCase();
        return pTime.includes(teamName.toLowerCase()) || teamName.toLowerCase().includes(pTime);
      })
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, 4);
  }, [playerStats]);

  const keyPlayersA = useMemo(() => getKeyPlayers(teamA.name), [getKeyPlayers, teamA.name]);
  const keyPlayersB = useMemo(() => getKeyPlayers(teamB.name), [getKeyPlayers, teamB.name]);

  const bettingLines = useMemo(() => {
    const atkA = Number(teamA.espnData?.pts || teamA.stats?.media_pontos_ataque || 0);
    const atkB = Number(teamB.espnData?.pts || teamB.stats?.media_pontos_ataque || 0);
    const defA = Number(teamA.espnData?.pts_contra || teamA.stats?.media_pontos_defesa || 0);
    const defB = Number(teamB.espnData?.pts_contra || teamB.stats?.media_pontos_defesa || 0);
    const totalA = teamA.wins + teamA.losses;
    const totalB = teamB.wins + teamB.losses;
    const aprA = Number(teamA.espnData?.pct_vit || teamA.espnData?.pc_vit || teamA.stats?.aproveitamento || (totalA > 0 ? teamA.wins / totalA : 0)) * 100;
    const aprB = Number(teamB.espnData?.pct_vit || teamB.espnData?.pc_vit || teamB.stats?.aproveitamento || (totalB > 0 ? teamB.wins / totalB : 0)) * 100;

    const allPlayersA = playerStats.filter(p => {
      const pTime = (p.time || p.team_name || '').toLowerCase();
      const tName = teamA.name.toLowerCase();
      return pTime.includes(tName) || tName.includes(pTime);
    });

    const allPlayersB = playerStats.filter(p => {
      const pTime = (p.time || p.team_name || '').toLowerCase();
      const tName = teamB.name.toLowerCase();
      return pTime.includes(tName) || tName.includes(pTime);
    });

    // Cálculo de HW (Handicap de Estrela) - ALL ROSTER
    let activeHWA = 0;
    let penaltyA = 0;
    allPlayersA.forEach(player => {
      const weight = getPlayerWeight(player.pontos || player.pts || 0);
      const injury = injuriesA.find(inj => inj.nome.toLowerCase() === (player.nome || player.player_name || '').toLowerCase());
      if (injury) {
        penaltyA += injury.isOut ? weight : (weight / 2);
      } else {
        activeHWA += weight;
      }
    });

    let activeHWB = 0;
    let penaltyB = 0;
    allPlayersB.forEach(player => {
      const weight = getPlayerWeight(player.pontos || player.pts || 0);
      const injury = injuriesB.find(inj => inj.nome.toLowerCase() === (player.nome || player.player_name || '').toLowerCase());
      if (injury) {
        penaltyB += injury.isOut ? weight : (weight / 2);
      } else {
        activeHWB += weight;
      }
    });

    // Algoritmo de Eficiência Cruzada (RIGID RULE)
    let projA = (atkA > 0 && defB > 0) ? ((atkA + defB) / 2) : 0;
    let projB = (atkB > 0 && defA > 0) ? ((atkB + defA) / 2) : 0;

    // Aplicação das Penalidades Médicas
    projA -= penaltyA;
    projB -= penaltyB;

    const spread = projB - projA;

    return {
      ataqueA: atkA,
      ataqueB: atkB,
      defesaA: defA,
      defesaB: defB,
      aproveitamentoA: aprA,
      aproveitamentoB: aprB,
      projectedA: projA,
      projectedB: projB,
      totalProjected: projA + projB,
      penaltyA,
      penaltyB,
      activeHWA,
      activeHWB,
      spread: spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1),
      favorite: spread < 0 ? teamA.name : teamB.name
    };
  }, [teamA, teamB, injuriesA, injuriesB, playerStats]);

  const advantageMatrix = useMemo(() => {
    // 1. Momentum: Peso exponencial 2^n para os últimos 5 jogos
    const calcMomentum = (record: GameResult[]) => {
      const rec = [...(record || [])].slice(-5);
      return rec.reduce((acc, res, i) => {
        const weight = Math.pow(2, i + 1);
        return acc + (res === 'V' ? weight : -weight);
      }, 0);
    };

    const momA = calcMomentum(teamA.record);
    const momB = calcMomentum(teamB.record);

    return {
      momentum: {
        a: momA,
        b: momB,
        winner: momA > momB ? 'a' as const : momB > momA ? 'b' as const : 'none' as const,
        label: `W_EXP: ${momA} vs ${momB}`
      },
      ataque: {
        a: bettingLines.ataqueA,
        b: bettingLines.ataqueB,
        winner: bettingLines.ataqueA > bettingLines.ataqueB ? 'a' as const : 'b' as const,
        label: `PACE_MAX: ${Math.max(bettingLines.ataqueA, bettingLines.ataqueB)}`
      },
      defesa: {
        a: bettingLines.defesaA,
        b: bettingLines.defesaB,
        winner: bettingLines.defesaA < bettingLines.defesaB ? 'a' as const : 'b' as const, // Menor é melhor
        label: `DEF_RATING_LOW`
      },
      hw: {
        a: bettingLines.activeHWA,
        b: bettingLines.activeHWB,
        winner: bettingLines.activeHWA > bettingLines.activeHWB ? 'a' as const : 'b' as const,
        label: `STAR_POWER_ACTIVE`
      }
    };
  }, [teamA.record, teamB.record, bettingLines]);

  useEffect(() => {
    if (!!initialAnalysis) return;
    const fetchAnalysis = async () => {
      setLoading(true);
      try {
        const result = await compareTeams(teamA, teamB, playerStats, [...injuriesA, ...injuriesB]);
        setAnalysis(result);
        // Salvando como 'pending' para evitar erro 23514
        await saveMatchupAnalysis(teamA.id, teamB.id, { ...result, result: 'pending' });
        setSavedToCloud(true);
      } catch (e: any) {
        console.error(e);
        toast.error("Não foi possível carregar a análise do confronto.");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalysis();
  }, [teamA.id, teamB.id, !!initialAnalysis]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md font-mono">
      <div className="bg-black border-4 border-white w-full max-w-6xl overflow-hidden shadow-[16px_16px_0px_#000] flex flex-col max-h-[95vh] relative">
        <div className="absolute top-0 right-0 p-4 z-10">
          <button onClick={onClose} className="border-2 border-white/20 p-2 hover:bg-white hover:text-black transition-all cursor-pointer backdrop-blur-xl">
            <span className="font-black text-xl px-2">X</span>
          </button>
        </div>

        <div className="px-8 py-6 border-b-2 border-white/10 flex flex-col gap-1 bg-gradient-to-r from-indigo-900/20 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-indigo-500 animate-pulse rounded-full shadow-[0_0_10px_#6366f1]"></div>
            <h2 className="text-sm font-black uppercase tracking-widest text-white">
              ALGORITMO DE EFICIÊNCIA CRUZADA v5.0
            </h2>
          </div>
          <p className="text-[10px] text-slate-500 font-bold tracking-tighter uppercase pl-6">ROSTER_DEPTH_AWARE // DETERMINISTIC_MATRIZ</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-16">

          <div className="flex flex-col items-center justify-center gap-8 bg-white/5 border-2 border-white/10 p-12 relative shadow-[12px_12px_0px_#000] rounded-xl overflow-hidden glass-morphism">
            <div className="absolute top-0 left-8 -translate-y-1/2 bg-white text-black px-4 py-1 border-2 border-black font-black text-[10px] uppercase tracking-widest">
              EXPECTED_POINTS_MATRIX
            </div>
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent)]"></div>

            <div className="flex flex-wrap items-center justify-center gap-16 md:gap-32 w-full relative z-0">
              <div className="flex flex-col items-center gap-4">
                <div className="flex flex-col items-center border-2 border-white p-4 shadow-[8px_8px_0px_#222] bg-zinc-900">
                  <img src={teamA.logo} className="w-24 h-24 object-contain mb-4" alt="" />
                  <div className="flex items-center gap-2">
                    <MomentumBar record={teamA.record} className="w-24" showLabel />
                    <div className="bg-black border border-white px-2 py-1 flex flex-col items-center">
                      <span className="text-[6px] text-slate-500 font-bold uppercase">SCORE_IA</span>
                      <span className="text-xs font-black text-white">{notas.a.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-center mt-4">
                  <span className="text-7xl md:text-9xl font-bold text-white leading-none">
                    {bettingLines.projectedA.toFixed(1)}
                  </span>
                  <p className="text-[10px] font-bold text-indigo-400 mt-2">({teamA.espnData?.pts || 0} + {teamB.espnData?.pts_contra || 0}) / 2</p>
                </div>
              </div>

              <div className="text-white font-bold text-6xl opacity-20 hidden md:block select-none">X</div>

              <div className="flex flex-col items-center gap-4">
                <div className="flex flex-col items-center border-2 border-white p-4 shadow-[8px_8px_0px_#222] bg-zinc-900">
                  <img src={teamB.logo} className="w-24 h-24 object-contain mb-4" alt="" />
                  <div className="flex items-center gap-2">
                    <MomentumBar record={teamB.record} className="w-24" showLabel />
                    <div className="bg-black border border-white px-2 py-1 flex flex-col items-center">
                      <span className="text-[6px] text-slate-500 font-bold uppercase">SCORE_IA</span>
                      <span className="text-xs font-black text-slate-400">{notas.b.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-center mt-4">
                  <span className="text-7xl md:text-9xl font-bold text-slate-400 leading-none">
                    {bettingLines.projectedB.toFixed(1)}
                  </span>
                  <p className="text-[10px] font-bold text-indigo-400 mt-2">({teamB.espnData?.pts || 0} + {teamA.espnData?.pts_contra || 0}) / 2</p>
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
              <div className="flex flex-col bg-white text-black p-6 border-4 border-zinc-800 shadow-[8px_8px_0px_#000]">
                <span className="text-[10px] font-bold uppercase mb-2">PONTUAÇÃO TOTAL_ESTIMADA</span>
                <span className="text-4xl font-bold italic">{bettingLines.totalProjected.toFixed(1)}</span>
              </div>
              <div className="flex flex-col bg-zinc-900 text-white p-6 border-4 border-white shadow-[8px_8px_0px_#000]">
                <span className="text-[10px] font-bold uppercase mb-2">HANDICAP_ALGORÍTMICO</span>
                <span className="text-2xl font-bold uppercase">
                  {bettingLines.favorite} <span className={Number(bettingLines.spread) > 0 ? "text-rose-500" : "text-emerald-500"}>{bettingLines.spread}</span>
                </span>
              </div>
            </div>

            {(bettingLines.penaltyA > 0 || bettingLines.penaltyB > 0) && (
              <div className="mt-8 w-full max-w-3xl bg-rose-950 border-4 border-rose-500 p-6 shadow-[8px_8px_0px_#000]">
                <span className="text-[10px] font-bold text-rose-500 uppercase flex items-center gap-2 mb-4">
                  [!] IMPACTO_MÉDICO_ESTRAÍDO
                </span>
                <div className="grid grid-cols-2 gap-8 text-rose-500 font-bold">
                  {bettingLines.penaltyA > 0 && (
                    <div className="border-l-2 border-rose-500 pl-4">
                      <span className="block text-[8px] opacity-60">{teamA.name}</span>
                      <span>-{bettingLines.penaltyA.toFixed(1)} PTS</span>
                    </div>
                  )}
                  {bettingLines.penaltyB > 0 && (
                    <div className="border-l-2 border-rose-500 pl-4">
                      <span className="block text-[8px] opacity-60">{teamB.name}</span>
                      <span>-{bettingLines.penaltyB.toFixed(1)} PTS</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-black/40 backdrop-blur-md border-2 border-white/10 overflow-hidden shadow-[12px_12px_0px_#000] rounded-xl">
            <div className="bg-white/5 text-slate-400 px-6 py-2 border-b-2 border-white/10 flex justify-between items-center bg-gradient-to-r from-white/5 to-transparent">
              <span className="text-[10px] font-black uppercase tracking-widest">STATS_EXTRACTOR // ADVANTAGE_MATRIX_DETERMINISTIC</span>
              <span className="text-[8px] font-bold opacity-60">CLIENT_SIDE_HYDRATION: READY</span>
            </div>
            <div className="flex flex-wrap md:flex-nowrap border-b-2 border-white/10">
              <AdvantageItem
                label="MOMENTUM_EXP"
                valA={advantageMatrix.momentum.a}
                valB={advantageMatrix.momentum.b}
                winner={advantageMatrix.momentum.winner}
                sub="EXP_WEIGHTED_WIN_STREAK"
              />
              <AdvantageItem
                label="OFF_EFFICIENCY"
                valA={advantageMatrix.ataque.a.toFixed(1)}
                valB={advantageMatrix.ataque.b.toFixed(1)}
                winner={advantageMatrix.ataque.winner}
                sub="PACE_ADJUSTED_OFFENSE"
              />
              <AdvantageItem
                label="DEF_EFFICIENCY"
                valA={advantageMatrix.defesa.a.toFixed(1)}
                valB={advantageMatrix.defesa.b.toFixed(1)}
                winner={advantageMatrix.defesa.winner}
                sub="PPG_ALLOWED_MATRIZ"
              />
              <AdvantageItem
                label="HW_ACTIVE_POWER"
                valA={advantageMatrix.hw.a.toFixed(1)}
                valB={advantageMatrix.hw.b.toFixed(1)}
                winner={advantageMatrix.hw.winner}
                sub="TOTAL_STAR_WEIGHT_ACTIVE"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 border-t-2 border-white/10">
            <div className="lg:col-span-5 bg-black/40 backdrop-blur-md border-2 border-white/10 p-8 shadow-[12px_12px_0px_#000] rounded-xl glass-morphism">
              <div className="mb-8 border-b border-white/10 pb-4">
                <h4 className="text-white font-black text-xs uppercase underline">CORE_METRICS_VIZ</h4>
              </div>

              <div className="space-y-12">
                <StatBar label="OFF_EFFICIENCY (PTS)" valA={bettingLines.ataqueA} valB={bettingLines.ataqueB} />
                <StatBar label="DEF_EFFICIENCY (PTS_ALLOWED)" valA={bettingLines.defesaA} valB={bettingLines.defesaB} />
                <StatBar label="WIN_PCT (%)" valA={bettingLines.aproveitamentoA} valB={bettingLines.aproveitamentoB} isPercent />
              </div>
            </div>

            <div className="lg:col-span-7 bg-white text-black border-4 border-black p-8 shadow-[12px_12px_0px_rgba(255,255,255,0.1)] rounded-xl">
              <div className="flex items-center justify-between mb-8">
                <h4 className="font-black text-xs uppercase underline">ESTATÍSTICO_CHEFE_REPORT</h4>
                {analysis && (
                  <div className="bg-black text-white px-4 py-1 border-2 border-black font-black text-[10px] uppercase">
                    CONFIDENCE: {analysis.confidence}%
                  </div>
                )}
              </div>

              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <div className="w-12 h-12 border-4 border-black border-t-indigo-500 bg-black animate-spin rounded-full"></div>
                  <p className="font-black text-[10px] uppercase">ANALYSING_DATA_MATRICES...</p>
                </div>
              ) : analysis ? (
                <div className="space-y-8">
                  <div className="border-l-8 border-black pl-6">
                    <span className="block text-[10px] font-black opacity-60 mb-2">TARGET_OUTCOME:</span>
                    <span className="text-4xl md:text-6xl font-black uppercase italic leading-none">
                      {analysis.winner}
                    </span>
                  </div>

                  <div className="bg-zinc-100 p-6 border-2 border-dashed border-black">
                    <p className="text-[10px] font-black opacity-60 mb-2">KEY_FACTOR_INJECTION:</p>
                    <p className="text-xl font-black uppercase italic leading-tight">"{analysis.keyFactor}"</p>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black opacity-60">DETAILED_STRATEGIC_LOG:</p>
                    <p className="text-sm border-2 border-black p-4 bg-zinc-50 font-bold leading-relaxed">
                      {analysis.detailedAnalysis}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-black/40 backdrop-blur-md border-2 border-white/10 p-8 shadow-[12px_12px_0px_#000] rounded-xl glass-morphism">
              <div className="flex items-center gap-4 mb-8">
                <h4 className="text-rose-500 font-black text-xs uppercase underline">MEDICAL_LOGS</h4>
                <div className="flex-1 h-px bg-rose-500/20"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <span className="text-[10px] font-black text-white bg-zinc-900 px-2 py-0.5 border border-white/20 rounded-sm">{teamA.name}</span>
                  {injuriesA.length > 0 ? (
                    injuriesA.map((p, i) => <PlayerCard key={i} name={p.nome} status={p.status} isOut={p.isOut} />)
                  ) : (
                    <div className="p-4 border-2 border-dashed border-zinc-900 text-[10px] font-black text-zinc-600 text-center">NO_INJURIES</div>
                  )}
                </div>
                <div className="space-y-4">
                  <span className="text-[10px] font-black text-white bg-zinc-900 px-2 py-0.5 border border-white/20 rounded-sm block text-right ml-auto w-fit">{teamB.name}</span>
                  {injuriesB.length > 0 ? (
                    injuriesB.map((p, i) => <PlayerCard key={i} name={p.nome} status={p.status} isOut={p.isOut} />)
                  ) : (
                    <div className="p-4 border-2 border-dashed border-zinc-900 text-[10px] font-black text-zinc-600 text-center">NO_INJURIES</div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-black/40 backdrop-blur-md border-2 border-white/10 p-8 shadow-[12px_12px_0px_#000] rounded-xl glass-morphism">
              <div className="flex items-center gap-4 mb-8">
                <h4 className="text-white font-black text-xs uppercase underline">HIGH_VAL_ENTITIES</h4>
                <div className="flex-1 h-px bg-white/10"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <span className="text-[10px] font-black text-white bg-zinc-900 px-2 py-0.5 border border-white/20 rounded-sm">{teamA.name}</span>
                  {keyPlayersA.map((p, i) => {
                    const inj = injuriesA.find(inj => inj.nome.toLowerCase() === p.nome.toLowerCase());
                    return (
                      <PlayerCard
                        key={`a-${i}`}
                        name={p.nome}
                        isOut={inj?.isOut}
                        status={inj?.status}
                        weight={getPlayerWeight(p.pontos)}
                      />
                    );
                  })}
                </div>
                <div className="space-y-4">
                  <span className="text-[10px] font-black text-white bg-zinc-900 px-2 py-0.5 border border-white/20 rounded-sm block text-right ml-auto w-fit">{teamB.name}</span>
                  {keyPlayersB.map((p, i) => {
                    const inj = injuriesB.find(inj => inj.nome.toLowerCase() === p.nome.toLowerCase());
                    return (
                      <PlayerCard
                        key={`b-${i}`}
                        name={p.nome}
                        isOut={inj?.isOut}
                        status={inj?.status}
                        weight={getPlayerWeight(p.pontos)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-4 bg-zinc-950 border-t-2 border-white/10 flex justify-between items-center text-white/40">
          <span className="text-[9px] font-black uppercase tracking-widest leading-none">[ v5.0 // ALGO_CROSS_REF_DETERMINISTIC // {new Date().getFullYear()} ]</span>
          {savedToCloud && (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>
              <span className="text-[9px] font-black uppercase tracking-tighter">DATA_SYNC_LOCKED</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamComparison;
