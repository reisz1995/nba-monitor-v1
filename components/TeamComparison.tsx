
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Team, MatchupAnalysis, PlayerStat, UnavailablePlayer } from '../types';
import { compareTeams, saveMatchupAnalysis } from '../services/geminiService';
import { toast } from 'sonner';
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
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-end px-1">
        <span className="text-indigo-400 font-black text-lg italic">{displayA}</span>
        <span className="text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">{label}</span>
        <span className="text-slate-300 font-black text-lg italic">{displayB}</span>
      </div>
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
        <div style={{ width: `${pctA}%` }} className="h-full bg-indigo-500 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(99,102,241,0.6)]"></div>
        <div className="h-full flex-1 bg-slate-700"></div>
      </div>
    </div>
  );
};

const PlayerCard: React.FC<{ name: string; status?: string; isOut?: boolean; weight?: number }> = ({ name, status, isOut, weight }) => (
  <div className={`flex items-center justify-between p-2.5 rounded-lg border transition-all w-full ${isOut
    ? 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.05)]'
    : status
      ? 'bg-amber-500/10 border-amber-500/30'
      : 'bg-slate-900/40 border-slate-800'
    }`}>
    <span className={`text-[10px] md:text-xs font-black uppercase italic tracking-tighter truncate ${isOut ? 'text-rose-400' : 'text-slate-200'}`}>
      {name}
    </span>
    <div className="flex items-center gap-2">
      {weight !== undefined && (
        <span title="Handicap de Estrela" className="text-[10px] font-black text-indigo-400 italic bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
          HW: {weight.toFixed(1)}
        </span>
      )}
      {status && (
        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${isOut ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'
          }`}>
          {status}
        </span>
      )}
    </div>
  </div>
);

const TeamComparison: React.FC<TeamComparisonProps> = ({ teamA, teamB, playerStats, unavailablePlayers, onClose, initialAnalysis }) => {
  const [analysis, setAnalysis] = useState<MatchupAnalysis | null>(initialAnalysis || null);
  const [loading, setLoading] = useState(!initialAnalysis);
  const [savedToCloud, setSavedToCloud] = useState(!!initialAnalysis);

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
    const atkA = Number(teamA.stats?.media_pontos_ataque || teamA.espnData?.pts || 0);
    const atkB = Number(teamB.stats?.media_pontos_ataque || teamB.espnData?.pts || 0);
    const defA = Number(teamA.stats?.media_pontos_defesa || teamA.espnData?.pts_contra || 0);
    const defB = Number(teamB.stats?.media_pontos_defesa || teamB.espnData?.pts_contra || 0);
    const totalA = teamA.wins + teamA.losses;
    const totalB = teamB.wins + teamB.losses;
    const aprA = totalA > 0 ? (teamA.wins / totalA) * 100 : (Number(teamA.stats?.aproveitamento || 0) * 100);
    const aprB = totalB > 0 ? (teamB.wins / totalB) * 100 : (Number(teamB.stats?.aproveitamento || 0) * 100);

    // Cálculo de Penalidades (Handicap de Estrela)
    let penaltyA = 0;
    keyPlayersA.forEach(star => {
      const injury = injuriesA.find(inj => inj.nome.toLowerCase() === star.nome.toLowerCase());
      if (injury) {
        const weight = getPlayerWeight(star.pontos);
        penaltyA += injury.isOut ? weight : (weight / 2);
      }
    });

    let penaltyB = 0;
    keyPlayersB.forEach(star => {
      const injury = injuriesB.find(inj => inj.nome.toLowerCase() === star.nome.toLowerCase());
      if (injury) {
        const weight = getPlayerWeight(star.pontos);
        penaltyB += injury.isOut ? weight : (weight / 2);
      }
    });

    // Projeção Base Cruzada (Fator Casa +2.5 para TeamA)
    let projA = (atkA > 0 && defB > 0) ? ((atkA + defB) / 2) + 2.5 : 0;
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
      spread: spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1),
      favorite: spread < 0 ? teamA.name : teamB.name
    };
  }, [teamA, teamB, injuriesA, injuriesB, keyPlayersA, keyPlayersB]);

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-6 bg-slate-950/98 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="bg-[#0b0f1a] border border-slate-800/60 w-full max-w-6xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">

        <div className="px-8 py-5 border-b border-slate-800/40 flex justify-between items-center bg-slate-900/20">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(99,102,241,0.8)]"></div>
            <h2 className="text-[11px] md:text-xs font-black text-indigo-400 uppercase tracking-[0.4em]">
              Algoritmo de Eficiência Cruzada v3.0
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800/50 rounded-full transition-all group">
            <svg className="w-5 h-5 text-slate-500 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 space-y-12">

          <div className="flex flex-col items-center justify-center gap-4 bg-indigo-600/5 border border-indigo-500/20 rounded-[3.5rem] p-8 md:p-12 relative overflow-hidden shadow-inner">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-indigo-600 px-8 py-2 rounded-b-2xl shadow-lg z-10">
              <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Placar Projetado Hub</span>
            </div>

            <div className="flex items-center justify-center gap-12 md:gap-32 w-full relative z-0">
              <div className="flex flex-col items-center gap-3">
                <div className="flex flex-col items-center">
                  <img src={teamA.logo} className="w-20 h-20 md:w-28 md:h-28 object-contain drop-shadow-2xl mb-2" alt="" />
                  <MomentumBar record={teamA.record} className="w-20" showLabel />
                </div>
                <span className="text-6xl md:text-9xl font-black text-white italic tracking-tighter">
                  {bettingLines.projectedA.toFixed(1)}
                </span>
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-2 border-t border-slate-800 pt-1">CASA</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="text-slate-800 font-black text-4xl md:text-6xl italic animate-pulse opacity-50">VS</div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className="flex flex-col items-center">
                  <img src={teamB.logo} className="w-20 h-20 md:w-28 md:h-28 object-contain drop-shadow-2xl mb-2" alt="" />
                  <MomentumBar record={teamB.record} className="w-20" showLabel />
                </div>
                <span className="text-6xl md:text-9xl font-black text-slate-300 italic tracking-tighter">
                  {bettingLines.projectedB.toFixed(1)}
                </span>
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-2 border-t border-slate-800 pt-1">VISITANTE</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col md:flex-row items-center gap-4 md:gap-12">
              <div className="flex flex-col items-center bg-black/40 px-8 py-4 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Linha O/U</span>
                <span className="text-3xl font-black text-indigo-400 italic tracking-tighter">{bettingLines.totalProjected.toFixed(1)}</span>
              </div>
              <div className="flex flex-col items-center bg-black/40 px-8 py-4 rounded-3xl border border-white/5 shadow-xl">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Handicap Justo</span>
                <span className="text-xl font-black text-white italic tracking-tighter uppercase">
                  {bettingLines.favorite} <span className={Number(bettingLines.spread) > 0 ? "text-rose-500" : "text-emerald-500"}>{bettingLines.spread}</span>
                </span>
              </div>
            </div>

            {/* ALERTA DE IMPACTO MÉDICO */}
            {(bettingLines.penaltyA > 0 || bettingLines.penaltyB > 0) && (
              <div className="mt-8 w-full max-w-2xl bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
                <span className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  Ajuste Médico Aplicado:
                </span>
                <div className="flex items-center gap-6">
                  {bettingLines.penaltyA > 0 && (
                    <span className="text-[11px] font-black text-rose-300 italic">{teamA.name}: -{bettingLines.penaltyA.toFixed(1)} PTS</span>
                  )}
                  {bettingLines.penaltyB > 0 && (
                    <span className="text-[11px] font-black text-rose-300 italic">{teamB.name}: -{bettingLines.penaltyB.toFixed(1)} PTS</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-5 bg-slate-900/40 border border-slate-800/60 rounded-[2rem] p-8 flex flex-col gap-8 shadow-2xl">
              <div className="text-center border-b border-slate-800 pb-4">
                <h4 className="text-indigo-400 font-black text-xs uppercase tracking-[0.4em]">Performance de Referência</h4>
              </div>

              <div className="space-y-8">
                <StatBar label="PTS (Ataque)" valA={bettingLines.ataqueA} valB={bettingLines.ataqueB} />
                <StatBar label="PTS Contra (Defesa)" valA={bettingLines.defesaA} valB={bettingLines.defesaB} />
                <StatBar label="Aproveitamento" valA={bettingLines.aproveitamentoA} valB={bettingLines.aproveitamentoB} isPercent />
              </div>
            </div>

            <div className="lg:col-span-7 bg-gradient-to-br from-indigo-500/[0.03] to-slate-900 border border-indigo-500/10 rounded-[2rem] p-6 lg:p-10 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[60px]"></div>

              <div className="flex items-center justify-between mb-8">
                <h4 className="text-indigo-400 font-black text-[11px] uppercase tracking-[0.3em]">Análise IA Estratégica</h4>
                {analysis && (
                  <div className="bg-indigo-600 px-4 py-2 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                    <span className="text-[10px] font-black text-white">{analysis.confidence}% CERTEZA</span>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="flex-1 flex flex-col justify-center items-center space-y-6 py-20">
                  <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                  <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] animate-pulse">Sincronizando IA...</p>
                </div>
              ) : analysis ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
                  <div className="flex flex-col gap-2">
                    <span className="text-emerald-400 font-black text-xs uppercase italic tracking-widest">Favorito IA:</span>
                    <span className="text-white font-black text-3xl md:text-5xl uppercase italic tracking-tighter underline decoration-indigo-500 decoration-4 underline-offset-8">
                      {analysis.winner}
                    </span>
                  </div>

                  <div className="p-6 bg-black/40 rounded-2xl border border-white/5 relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Fator Decisivo:</p>
                    <p className="text-indigo-100 text-sm md:text-lg font-bold leading-relaxed italic">"{analysis.keyFactor}"</p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Resumo Analítico:</p>
                    <p className="text-slate-400 text-xs md:text-sm leading-relaxed font-medium">
                      {analysis.detailedAnalysis}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800/60">
              <div className="flex items-center gap-2 mb-6">
                <h4 className="text-rose-500 font-black text-[10px] uppercase tracking-[0.2em]">Plantão Médico</h4>
                <div className="flex-1 h-px bg-rose-500/20"></div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-2">{teamA.name}</span>
                  {injuriesA.length > 0 ? (
                    injuriesA.map((p, i) => <PlayerCard key={i} name={p.nome} status={p.status} isOut={p.isOut} />)
                  ) : (
                    <div className="py-4 text-center text-[9px] font-bold text-slate-700 uppercase italic border border-dashed border-slate-800 rounded-lg">Completo</div>
                  )}
                </div>
                <div className="space-y-2">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-2 text-right">{teamB.name}</span>
                  {injuriesB.length > 0 ? (
                    injuriesB.map((p, i) => <PlayerCard key={i} name={p.nome} status={p.status} isOut={p.isOut} />)
                  ) : (
                    <div className="py-4 text-center text-[9px] font-bold text-slate-700 uppercase italic border border-dashed border-slate-800 rounded-lg">Completo</div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800/60">
              <div className="flex items-center gap-2 mb-6">
                <h4 className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.2em]">Principais Estrelas</h4>
                <div className="flex-1 h-px bg-indigo-500/20"></div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-2">{teamA.name}</span>
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
                <div className="space-y-2">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-2 text-right">{teamB.name}</span>
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

        <div className="px-8 py-3 bg-slate-950/80 border-t border-slate-800/40 flex justify-between items-center">
          <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest italic">Ajuste Médico Baseado no Handicap de Estrela (HW) • v4.0</span>
          {savedToCloud && (
            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>
              <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Registrado em matchup_analyses</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamComparison;
