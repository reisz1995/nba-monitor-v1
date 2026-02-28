import React from 'react';
import { Team, MatchupAnalysis, PlayerStat, UnavailablePlayer } from '../types';
import MomentumBar from './MomentumBar';
import { useTeamComparisonData } from '../hooks/useTeamComparisonData';
import { StatBar, PlayerCard, AdvantageItem } from './ComparisonStats';

interface TeamComparisonProps {
  teamA: Team;
  teamB: Team;
  playerStats: PlayerStat[];
  unavailablePlayers: UnavailablePlayer[];
  onClose: () => void;
  initialAnalysis?: MatchupAnalysis;
}

const TeamComparison: React.FC<TeamComparisonProps> = ({ teamA, teamB, playerStats, unavailablePlayers, onClose, initialAnalysis }) => {
  const {
    analysis,
    loading,
    savedToCloud,
    notas,
    injuriesA,
    injuriesB,
    keyPlayersA,
    keyPlayersB,
    bettingLines,
    advantageMatrix,
    getPlayerWeight
  } = useTeamComparisonData({ teamA, teamB, playerStats, unavailablePlayers, initialAnalysis });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 font-['Space_Mono']">
      <div className="bg-[#111] border-4 border-white w-full max-w-6xl overflow-hidden shadow-[16px_16px_0px_#000] flex flex-col max-h-[95vh]">

        <div className="px-8 py-4 border-b-4 border-white flex justify-between items-center bg-white text-black">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-black animate-ping"></div>
            <h2 className="text-xs font-bold uppercase tracking-widest">
              ALGORITMO DE EFICIÊNCIA CRUZADA v5.0 // ROSTER_DEPTH_AWARE
            </h2>
          </div>
          <button onClick={onClose} className="border-2 border-black p-1 hover:bg-black hover:text-white transition-colors">
            <span className="font-bold text-xl px-2">X</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-16">

          <div className="flex flex-col items-center justify-center gap-8 bg-black border-4 border-white p-12 relative shadow-[8px_8px_0px_#333]">
            <div className="absolute top-0 left-8 -translate-y-1/2 bg-white text-black px-4 py-1 border-2 border-black font-bold text-[10px]">
              EXPECTED_POINTS_MATRIX
            </div>

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

          <div className="bg-black border-4 border-white overflow-hidden shadow-[12px_12px_0px_#000]">
            <div className="bg-white text-black px-6 py-2 border-b-4 border-white flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest">STATS_EXTRACTOR // ADVANTAGE_MATRIX_DETERMINISTIC</span>
              <span className="text-[8px] font-bold opacity-60">CLIENT_SIDE_HYDRATION: READY</span>
            </div>
            <div className="flex flex-wrap md:flex-nowrap border-b-4 border-white">
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 border-t-4 border-white/10">
            <div className="lg:col-span-5 bg-black border-4 border-white p-8 shadow-[12px_12px_0px_#000]">
              <div className="mb-8 border-b-2 border-white pb-4">
                <h4 className="text-white font-bold text-xs uppercase underline">CORE_METRICS_VIZ</h4>
              </div>

              <div className="space-y-12">
                <StatBar label="OFF_EFFICIENCY (PTS)" valA={bettingLines.ataqueA} valB={bettingLines.ataqueB} />
                <StatBar label="DEF_EFFICIENCY (PTS_ALLOWED)" valA={bettingLines.defesaA} valB={bettingLines.defesaB} />
                <StatBar label="WIN_PCT (%)" valA={bettingLines.aproveitamentoA} valB={bettingLines.aproveitamentoB} isPercent />
              </div>
            </div>

            <div className="lg:col-span-7 bg-white text-black border-4 border-black p-8 shadow-[12px_12px_0px_#333]">
              <div className="flex items-center justify-between mb-8">
                <h4 className="font-bold text-xs uppercase underline">ESTATÍSTICO_CHEFE_REPORT</h4>
                {analysis && (
                  <div className="bg-black text-white px-4 py-1 border-2 border-black font-bold text-[10px]">
                    CONFIDENCE: {analysis.confidence}%
                  </div>
                )}
              </div>

              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <div className="w-12 h-12 border-4 border-black border-t-white bg-black animate-spin"></div>
                  <p className="font-bold text-[10px] uppercase">ANALYSING_DATA_MATRICES...</p>
                </div>
              ) : analysis ? (
                <div className="space-y-8">
                  <div className="border-l-8 border-black pl-6">
                    <span className="block text-[10px] font-bold opacity-60 mb-2">TARGET_OUTCOME:</span>
                    <span className="text-4xl md:text-6xl font-black uppercase italic leading-none">
                      {analysis.winner}
                    </span>
                  </div>

                  <div className="bg-zinc-100 p-6 border-2 border-dashed border-black">
                    <p className="text-[10px] font-bold opacity-60 mb-2">KEY_FACTOR_INJECTION:</p>
                    <p className="text-xl font-bold uppercase italic leading-tight">"{analysis.keyFactor}"</p>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-bold opacity-60">DETAILED_STRATEGIC_LOG:</p>
                    <p className="text-sm border-2 border-black p-4 bg-zinc-50 font-medium leading-relaxed">
                      {analysis.detailedAnalysis}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-black border-4 border-white p-8 shadow-[12px_12px_0px_#000]">
              <div className="flex items-center gap-4 mb-8">
                <h4 className="text-rose-500 font-bold text-xs uppercase underline">MEDICAL_LOGS</h4>
                <div className="flex-1 h-1 bg-rose-500/20"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-white bg-zinc-800 px-2 py-0.5 border border-white">{teamA.name}</span>
                  {injuriesA.length > 0 ? (
                    injuriesA.map((p, i) => <PlayerCard key={i} name={p.nome} status={p.status} isOut={p.isOut} />)
                  ) : (
                    <div className="p-4 border-2 border-dashed border-zinc-800 text-[10px] font-bold text-zinc-600 text-center">NO_INJURIES</div>
                  )}
                </div>
                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-white bg-zinc-800 px-2 py-0.5 border border-white block text-right ml-auto w-fit">{teamB.name}</span>
                  {injuriesB.length > 0 ? (
                    injuriesB.map((p, i) => <PlayerCard key={i} name={p.nome} status={p.status} isOut={p.isOut} />)
                  ) : (
                    <div className="p-4 border-2 border-dashed border-zinc-800 text-[10px] font-bold text-zinc-600 text-center">NO_INJURIES</div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-black border-4 border-white p-8 shadow-[12px_12px_0px_#000]">
              <div className="flex items-center gap-4 mb-8">
                <h4 className="text-white font-bold text-xs uppercase underline">HIGH_VAL_ENTITIES</h4>
                <div className="flex-1 h-1 bg-white/20"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-white bg-zinc-800 px-2 py-0.5 border border-white">{teamA.name}</span>
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
                  <span className="text-[10px] font-bold text-white bg-zinc-800 px-2 py-0.5 border border-white block text-right ml-auto w-fit">{teamB.name}</span>
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

        <div className="px-8 py-4 bg-zinc-900 border-t-4 border-white flex justify-between items-center text-white">
          <span className="text-[10px] font-bold uppercase tracking-widest">[ v5.0 // ALGO_CROSS_REF_DETERMINISTIC ]</span>
          {savedToCloud && (
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-bold uppercase shadow-sm">DATA_SYNC_LOCKED</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamComparison;
