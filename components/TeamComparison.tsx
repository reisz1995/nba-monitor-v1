import React, { useRef, useCallback } from 'react';
import { Team, MatchupAnalysis, PlayerStat, UnavailablePlayer } from '../types';
import MomentumBar from './MomentumBar';
import MomentumPanel from './MomentumPanel';
import { useTeamComparisonData } from '../hooks/useTeamComparisonData';
import { StatBar, PlayerCard, AdvantageItem } from './ComparisonStats';
import { X, Trophy, TrendingUp, AlertTriangle, Info, Target, Download, Share2, Activity, Zap } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';

export const EdgeDisplay = ({ keyFactor }: { keyFactor: string }) => {
  if (!keyFactor) return null;

  const isValueBet = keyFactor.includes("VALUE_BET") || keyFactor.includes("EDGE");
  const bgColor = isValueBet ? "bg-yellow-400" : "bg-zinc-800";
  const textColor = isValueBet ? "text-black" : "text-emerald-400";
  const borderColor = isValueBet ? "border-black" : "border-zinc-600";
  const shadowColor = isValueBet ? "rgba(0,0,0,1)" : "rgba(16,185,129,0.3)";

  return (
    <div
      className={`mt-3 p-[12px] border-2 ${borderColor} ${bgColor} transition-colors duration-200`}
      style={{ boxShadow: `4px 4px 0px 0px ${shadowColor}` }}
    >
      <div className="flex items-center justify-between border-b border-current pb-1 mb-2">
        <span className="font-mono text-[10px] uppercase tracking-widest opacity-80 font-bold">
          [ Vantagem Matemática / Edge ]
        </span>
        <span className="font-mono text-[10px] uppercase animate-pulse">
          {isValueBet ? 'Alerta de Mercado' : 'Matriz Padrão'}
        </span>
      </div>
      <p className={`font-mono text-[12px] uppercase font-bold leading-relaxed ${textColor}`}>
        {keyFactor}
      </p>
    </div>
  );
};

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
    notas,
    injuriesA,
    injuriesB,
    keyPlayersA,
    keyPlayersB,
    bettingLines,
    advantageMatrix,
    marketData
  } = useTeamComparisonData({ teamA, teamB, playerStats, unavailablePlayers, initialAnalysis });

  const databallrEnhanced = bettingLines.databallrEnhanced;
  const contentRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(async () => {
    if (!contentRef.current) return;

    const toastId = toast.loading('Gerando imagem...');

    try {
      const dataUrl = await toPng(contentRef.current, {
        cacheBust: true,
        backgroundColor: '#111',
        style: {
          borderRadius: '0'
        }
      });

      const link = document.createElement('a');
      link.download = `nba-matchup-${teamA.name.replace(/\s+/g, '-')}-vs-${teamB.name.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();

      toast.success('Imagem exportada com sucesso!', { id: toastId });
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Erro ao exportar imagem.', { id: toastId });
    }
  }, [teamA.name, teamB.name]);

  return (
    <div aria-label="Team Comparison" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 font-['Space_Mono']">
      <div ref={contentRef} className="bg-[#111] border-4 border-white w-full max-w-6xl overflow-hidden shadow-[16px_16px_0px_#000] flex flex-col max-h-[95vh]">

        {/* Header */}
        <div className="px-8 py-4 border-b-4 border-white flex justify-between items-center bg-white text-black">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-black animate-ping"></div>
            <h2 className="text-xs font-bold uppercase tracking-widest">
              NBA_DETERMINISTIC_HUB v3.0 // PACE_CALIBRATED
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {databallrEnhanced && (
              <span className="flex items-center gap-1.5 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 border-2 border-black">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block"></span>
                DATABALLR 14d
              </span>
            )}
            <button onClick={onClose} className="border-2 border-black p-1 hover:bg-black hover:text-white transition-colors">
              <span className="font-bold text-xl px-2">X</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-16">

          {/* Result Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-5 bg-black border-4 border-white p-8 shadow-[12px_12px_0px_#000]">
              <div className="mb-8 border-b-2 border-white pb-4">
                <h4 className="text-white font-bold text-xs uppercase underline">CORE_METRICS_VIZ</h4>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="bg-black border-2 border-slate-800 p-4 font-['Space_Mono'] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity">
                    <Zap className="w-12 h-12 text-indigo-500" />
                  </div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Activity className="w-3 h-3 text-indigo-500" />
                    Ritmo do Confronto v2.0
                  </h4>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-3xl font-black text-white italic tracking-tighter">
                      {bettingLines.matchPace.toFixed(1)}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-1 border-2 ${bettingLines.kineticState === 'HYPER_KINETIC' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-slate-500/20 border-slate-500 text-slate-400'}`}>
                      {bettingLines.kineticState}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ease-out ${bettingLines.kineticState === 'HYPER_KINETIC' ? 'bg-indigo-500' : 'bg-slate-600'}`}
                      style={{ width: `${Math.min(100, (bettingLines.matchPace / 115) * 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-[8px] text-slate-500 mt-2 uppercase font-bold">
                    Projeção baseada em eficiência cruzada e posses de bola.
                  </p>
                </div>
                <StatBar label="Aproveitamento" valA={bettingLines.aproveitamentoA} valB={bettingLines.aproveitamentoB} isPercent />
                <StatBar label="Ataque (PPG)" valA={bettingLines.ataqueA} valB={bettingLines.ataqueB} />
                <StatBar label="Defesa (PPG)" valA={bettingLines.defesaA} valB={bettingLines.defesaB} />
              </div>
            </div>

            <div className="lg:col-span-7 bg-white text-black border-4 border-black p-8 shadow-[12px_12px_0px_#333] flex flex-col justify-center">
              <div className="flex items-center justify-between mb-8 border-b-2 border-black pb-4">
                <span className="text-[10px] font-black uppercase tracking-widest">Resultado do Algoritmo</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                  <span className="text-[8px] font-bold uppercase tracking-tighter">DETERMINISTIC_MODE</span>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <div className="flex items-center gap-6 mb-8">
                  <div className="flex flex-col items-center">
                    <span className="text-5xl font-black">{bettingLines.projectedA.toFixed(1)}</span>
                    <span className="text-[8px] font-bold text-zinc-400 uppercase mt-1">PROJ_{teamA.name.slice(0, 3)}</span>
                  </div>
                  <div className="h-16 w-1 bg-black skew-x-[-15deg]"></div>
                  <div className="flex flex-col items-center">
                    <span className="text-5xl font-black">{bettingLines.projectedB.toFixed(1)}</span>
                    <span className="text-[8px] font-bold text-zinc-400 uppercase mt-1">PROJ_{teamB.name.slice(0, 3)}</span>
                  </div>
                </div>

                <div className="bg-black text-white p-6 w-full text-center relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-2 block">Total Projetado Hub</span>
                  <div className="text-7xl font-black flex items-center justify-center gap-3 italic">
                    <Zap className="w-8 h-8 text-indigo-500" />
                    {bettingLines.totalProjected.toFixed(1)}
                  </div>
                  <div className="mt-4 flex justify-center gap-4">
                    <span className="text-[10px] font-black text-black bg-white px-3 py-1 uppercase">
                      {bettingLines.favorite} {bettingLines.spread}
                    </span>
                    <span className={`text-[10px] font-black px-3 py-1 uppercase skew-x-[-10deg] ${marketData?.total
                      ? (bettingLines.totalProjected > marketData.total ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white')
                      : (bettingLines.totalProjected > 225.5 ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-white')
                      }`}>
                      {marketData?.total
                        ? (bettingLines.totalProjected > marketData.total ? `PREV_OVER ${marketData.total}` : `PREV_UNDER ${marketData.total}`)
                        : (bettingLines.totalProjected > 225.5 ? 'HIGH_SCORE_EXPECTED' : 'DEFENSIVE_BATTLE')
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Advantage Section */}
          <div className="bg-white border-4 border-black shadow-[12px_12px_0px_#000] overflow-hidden">
            <div className="bg-black text-white py-2 px-6 border-b-4 border-black flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest">Matriz de Vantagem Dominante</span>
              <span className="text-[8px] font-bold opacity-40">CALC_V2.0</span>
            </div>
            <div className="flex flex-wrap">
              <AdvantageItem label="Ritmo (Pace)" valA={bettingLines.ataqueA} valB={bettingLines.ataqueB} winner={advantageMatrix.ataque.winner} sub={advantageMatrix.ataque.label} />
              <AdvantageItem label="Momentum" valA={advantageMatrix.momentum.a} valB={advantageMatrix.momentum.b} winner={advantageMatrix.momentum.winner} sub={advantageMatrix.momentum.label} />
              <AdvantageItem label="Defensa" valA={bettingLines.defesaA} valB={bettingLines.defesaB} winner={advantageMatrix.defesa.winner} sub={advantageMatrix.defesa.label} />
              <AdvantageItem label="Star Power" valA={bettingLines.activeHWA} valB={bettingLines.activeHWB} winner={advantageMatrix.hw.winner} sub={advantageMatrix.hw.label} />
            </div>
          </div>

          {/* Roster & Injuries */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {[{ team: teamA, injuries: injuriesA, key: keyPlayersA, side: 'LEFT' }, { team: teamB, injuries: injuriesB, key: keyPlayersB, side: 'RIGHT' }].map((t, idx) => (
              <div key={idx} className="space-y-8">
                <div className="flex items-center gap-4 border-b-4 border-white pb-4">
                  <img src={t.team.logo} className="w-16 h-16 object-contain" alt="" />
                  <div>
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">{t.team.name}</h3>
                    <div className="flex items-center gap-2">
                      <MomentumBar record={t.team.record} className="w-24" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase">POWER_SCORE: {notas[idx === 0 ? 'a' : 'b'].toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block">Elenco Ativo (Stars)</span>
                  <div className="grid grid-cols-1 gap-2">
                    {t.key.map((p, pIdx) => {
                      const injury = t.injuries.find(i => i.nome.toLowerCase() === (p.nome || p.player_name || '').toLowerCase());
                      return (
                        <PlayerCard
                          key={pIdx}
                          name={p.nome}
                          weight={Math.floor((p.pontos || 0) / 3)}
                          status={injury?.status}
                          isOut={injury?.isOut}
                        />
                      );
                    })}
                  </div>
                </div>

                {t.injuries.length > 0 && (
                  <div className="space-y-4">
                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3" /> Relatório Médico
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {t.injuries.map((p, pIdx) => (
                        <PlayerCard key={pIdx} name={p.nome} status={p.status} isOut={p.isOut} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* AI Analysis */}
          <div className="bg-indigo-600 border-4 border-white p-10 shadow-[12px_12px_0px_#000] relative overflow-hidden group">
            <div className="absolute -right-20 -bottom-20 opacity-10 group-hover:rotate-12 transition-transform duration-1000">
              <TrendingUp className="w-80 h-80" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-white text-indigo-600 rounded-none border-2 border-black">
                  <Info className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase italic">Análise do Estatístico Chefe</h3>
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-24 bg-white/30"></div>
                    <span className="text-[8px] font-bold text-white/60 tracking-[0.3em] uppercase">V2.0_PACE_DETERMINISTIC</span>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center py-20 gap-4">
                  <div className="w-12 h-1 bg-white animate-[shimmer_2s_infinite]"></div>
                  <span className="text-white font-black italic animate-pulse">PROCESSANDO_MODELO_NEURAL...</span>
                </div>
              ) : analysis ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    <div>
                      <span className="text-[10px] font-bold text-white/60 uppercase block mb-4">Recomendação Principal</span>
                      <div className="text-5xl font-black text-white italic tracking-tighter leading-tight bg-black p-6 border-l-8 border-white shadow-[8px_8px_0px_rgba(0,0,0,0.3)]">
                        {analysis.winner}
                      </div>
                    </div>
                    <EdgeDisplay keyFactor={analysis.keyFactor} />
                  </div>
                  <div className="bg-white text-black p-8 border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,0.5)]">
                    <span className="text-[10px] font-black uppercase mb-4 block underline">Análise Técnica Brutalista</span>
                    <p className="text-sm font-bold leading-loose whitespace-pre-wrap">{analysis.detailedAnalysis}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 border-4 border-dashed border-white/20">
                  <span className="text-white/40 font-black italic">ERRO_AO_SINCRONIZAR_IA</span>
                </div>
              )}

              {analysis?.momentumData && (
                <div className="mt-8 relative z-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                  {analysis && (
                    <MomentumPanel
                      teamA={teamA}
                      teamB={teamB}
                      homeRecord={analysis.momentumData?.home_record || []}
                      awayRecord={analysis.momentumData?.away_record || []}
                      h2hRecord={analysis.momentumData?.momentum_data?.home_vs_away || []}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t-4 border-white flex justify-between items-center bg-zinc-900 text-slate-500 font-bold text-[8px]">
          <span className="uppercase tracking-[0.5em]">
            System_NBA_v3.0 // Motor: {databallrEnhanced ? 'DATABALLR_ENHANCED' : 'ESPN_FALLBACK'} // Status: Operational
          </span>
          <div className="flex gap-4">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <Download className="w-3 h-3" /> EXPORT_DATA
            </button>
            <button className="flex items-center gap-2 hover:text-white transition-colors">
              <Share2 className="w-3 h-3" /> SHARE_MATCHUP
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TeamComparison;
