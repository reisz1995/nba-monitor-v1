import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Target, Zap, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { PlayerStat, Team, UnavailablePlayer } from '../../types';
import { getPlayerWeight } from '../../lib/nbaUtils';
import { supabase } from '../../lib/supabase';

interface PropsSectionProps {
    playersPlayingToday: PlayerStat[];
    teams: Team[];
    getInjuriesForTeam: (teamName: string) => any[];
    getTeamLogo: (teamName: string) => string;
    tipsDate?: string;
}

type MarketType = 'player_points' | 'player_rebounds' | 'player_assists';

const PropsSection: React.FC<PropsSectionProps> = ({
    playersPlayingToday,
    teams,
    getInjuriesForTeam,
    getTeamLogo,
    tipsDate
}) => {
    const [propsData, setPropsData] = useState<any[]>([]);
    const [activeMarket, setActiveMarket] = useState<MarketType>('player_points');

    useEffect(() => {
        const fetchProps = async () => {
            if (!tipsDate) return;
            const parts = tipsDate.split('/');
            if (parts.length !== 3) return;
            const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

            const { data } = await supabase
                .from('nba_player_props')
                .select('*')
                .eq('game_date', isoDate);

            if (data) setPropsData(data);
        };
        fetchProps();
    }, [tipsDate]);
    return (
        <section className="space-y-12">
            <div className="flex flex-col gap-4 border-b border-nba-blue/30 pb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="bg-nba-blue p-3 shadow-glow-blue">
                            <Target className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter font-oswald">
                            Indiv. <span className="text-nba-blue">Props</span> [PRO]
                        </h3>
                        <button
                            onClick={async () => {
                                const tId = toast.loading('Sincronizando Props via The Odds API...');
                                try {
                                    const res = await fetch('/api/scrape-props?ui_trigger=true');
                                    const d = await res.json();
                                    if (d.success) {
                                        toast.success(d.message, { id: tId });
                                        window.location.reload();
                                    } else {
                                        toast.error(d.error || 'Erro ao sincronizar', { id: tId });
                                    }
                                } catch (e) {
                                    toast.error('Erro de conexão', { id: tId });
                                }
                            }}
                            className="bg-nba-blue/20 hover:bg-nba-blue text-nba-blue hover:text-white px-4 py-2 border border-nba-blue/30 text-[10px] font-black uppercase tracking-widest transition-all font-oswald"
                        >
                            🔄 Sincronizar Props
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-nba-background border border-white/10 p-1 rounded-sm overflow-x-auto">
                        <button
                            onClick={() => setActiveMarket('player_points')}
                            className={`px-6 py-2 transition-all text-xs font-black tracking-widest font-oswald uppercase rounded-sm whitespace-nowrap ${activeMarket === 'player_points' ? 'bg-nba-blue text-white shadow-glow-blue' : 'text-slate-400 hover:text-white'}`}
                        >
                            🏀 PONTOS
                        </button>
                        <button
                            onClick={() => setActiveMarket('player_rebounds')}
                            className={`px-6 py-2 transition-all text-xs font-black tracking-widest font-oswald uppercase rounded-sm whitespace-nowrap ${activeMarket === 'player_rebounds' ? 'bg-nba-blue text-white shadow-glow-blue' : 'text-slate-400 hover:text-white'}`}
                        >
                            🛡️ REBOTES
                        </button>
                        <button
                            onClick={() => setActiveMarket('player_assists')}
                            className={`px-6 py-2 transition-all text-xs font-black tracking-widest font-oswald uppercase rounded-sm whitespace-nowrap ${activeMarket === 'player_assists' ? 'bg-nba-blue text-white shadow-glow-blue' : 'text-slate-400 hover:text-white'}`}
                        >
                            🎯 ASSIST.
                        </button>
                    </div>
                </div>
            </div>

            {playersPlayingToday.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-700">
                    {playersPlayingToday
                        .filter(player => getPlayerWeight(player.pontos) >= 7)
                        .slice(0, 24)
                        .map((player) => {
                            const teamInjuries = getInjuriesForTeam(player.time);
                            const injury = teamInjuries.find(inj => inj.nome?.toLowerCase() === player.nome.toLowerCase());
                            const weight = getPlayerWeight(player.pontos);

                            const playerProp = propsData.find(p => p.market === activeMarket && p.player_name.toLowerCase().includes(player.nome.toLowerCase().split(' ').pop() || ''));
                            const hasProp = !!playerProp;
                            const propLine = playerProp ? playerProp.line : 0;

                            const rawStat = activeMarket === 'player_points' ? player.pontos :
                                activeMarket === 'player_rebounds' ? player.rebotes :
                                    player.assistencias;

                            let penalty = 0;
                            if (injury && injury.isOut) {
                                penalty = rawStat;
                            }

                            const adjustedStat = Math.max(0, rawStat - penalty);
                            const edge = adjustedStat - propLine;

                            const edgeThreshold = activeMarket === 'player_points' ? 1.5 : 1.0;
                            const isOverEdge = hasProp && edge >= edgeThreshold && !injury?.isOut;
                            const isUnderEdge = hasProp && edge <= -edgeThreshold && !injury?.isOut;

                            // Variável para Gauge animation
                            const maxGaugeEdge = activeMarket === 'player_points' ? 8 : 4;
                            const gaugePercentage = Math.min(100, Math.max(0, (Math.abs(edge) / maxGaugeEdge) * 100));

                            return (
                                <div key={player.id} className={`bg-nba-surface border ${isOverEdge ? 'border-nba-success/50 shadow-glow-success' : isUnderEdge ? 'border-nba-red/50 shadow-glow-red' : injury ? (injury.isOut ? 'border-nba-red/50' : 'border-nba-gold/50') : 'border-white/5'} p-0 hover:border-nba-blue/50 transition-all group overflow-hidden shadow-[0_10px_30px_rgba(0, 0, 0, 0.5)] rounded-sm`}>
                                    <div className="bg-nba-surface-elevated border-b border-white/5 p-6 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rotate-45 translate-x-8 -translate-y-8" />
                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className="w-12 h-12 bg-nba-background border border-white/5 p-2 group-hover:border-nba-blue/50 transition-colors rounded-sm">
                                                <img src={getTeamLogo(player.time)} className="w-full h-full object-contain grayscale group-hover:grayscale-0 transition-all" alt="" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-nba-text-secondary uppercase leading-none mb-1 tracking-widest underline decoration-nba-blue/30 font-oswald">{player.time}</span>
                                                <span className={`text-xl font-black ${injury ? (injury.isOut ? 'text-nba-red' : 'text-nba-gold') : 'text-white'} italic uppercase truncate w-32 tracking-tight group-hover:text-nba-blue transition-colors font-oswald`}>{player.nome.split(' ').pop()}</span>
                                            </div>
                                        </div>
                                        {isOverEdge && <div className="absolute top-2 right-2 bg-nba-success text-white text-[10px] uppercase font-black tracking-widest px-2 py-0.5 animate-pulse font-oswald">OVER EDGE +{edge.toFixed(1)}</div>}
                                        {isUnderEdge && <div className="absolute top-2 right-2 bg-nba-red text-white text-[10px] uppercase font-black tracking-widest px-2 py-0.5 animate-pulse font-oswald">UNDER EDGE {edge.toFixed(1)}</div>}
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <div className="flex justify-between items-end border-b border-white/5 pb-4">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-nba-text-secondary uppercase tracking-widest flex items-center gap-1 font-oswald">
                                                    <Zap className="w-2.5 h-2.5 text-nba-blue" /> PROJECTED ({activeMarket.split('_')[1]})
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-2xl font-black font-bebas ${penalty > 0 ? 'text-nba-text-secondary line-through' : 'text-white'}`}>{rawStat.toFixed(1)}</span>
                                                    {penalty > 0 && <span className={`text-xl font-black font-bebas ${injury?.isOut ? 'text-nba-red' : 'text-nba-gold'}`}>{adjustedStat.toFixed(1)}</span>}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-[10px] font-black text-nba-blue uppercase tracking-tighter bg-nba-blue/10 px-2 py-0.5 font-oswald rounded-sm">H-WEIGHT.</span>
                                                <span className="text-[9px] font-black text-nba-text-secondary uppercase tracking-tighter bg-nba-background px-2 py-0.5 border border-white/5 font-oswald rounded-sm">WK: {weight.toFixed(1)}</span>
                                            </div>
                                        </div>
                                        <div className={`bg-nba-surface-elevated border border-white/5 p-4 relative transition-colors ${injury?.isOut ? 'opacity-50 grayscale' : 'group-hover:bg-white/5'} rounded-sm`}>
                                            <span className="text-[9px] font-black text-nba-text-secondary uppercase mb-2 flex items-center gap-2 tracking-widest font-oswald">
                                                SPORTBOOK LINE {hasProp && '✅'}
                                            </span>
                                            <div className="flex items-center justify-between">
                                                {hasProp ? (
                                                    <span className={`text-3xl font-black italic font-bebas ${isOverEdge ? 'text-nba-success' : isUnderEdge ? 'text-nba-red' : 'text-white'}`}>O/U {propLine.toFixed(1)}</span>
                                                ) : (
                                                    <span className="text-xl font-black text-nba-text-secondary italic font-bebas px-1 py-1 border border-white/10 rounded-sm bg-nba-background border-dashed">PENDING LINE</span>
                                                )}
                                                {hasProp ? (
                                                    isOverEdge ? <TrendingUp className="w-6 h-6 text-nba-success mb-1 animate-bounce" /> : isUnderEdge ? <TrendingDown className="w-6 h-6 text-nba-red mt-1 animate-bounce" /> : <ChevronRight className="w-6 h-6 text-slate-400" />
                                                ) : (
                                                    <ChevronRight className="w-6 h-6 text-slate-400 group-hover:translate-x-1 group-hover:text-nba-blue transition-all" />
                                                )}
                                            </div>

                                            {/* EDGE GAUGE UI PREMIUM */}
                                            {hasProp && Math.abs(edge) >= edgeThreshold && !injury?.isOut && (
                                                <div className="mt-4 border-t border-white/5 pt-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                    <div className="flex justify-between text-[9px] font-black font-oswald text-slate-400 mb-1 tracking-widest uppercase">
                                                        <span>HOUSE_LINE</span>
                                                        <span className={`${isOverEdge ? 'text-nba-success drop-shadow-[0_0_5px_rgba(0,255,0,0.8)]' : 'text-nba-red drop-shadow-[0_0_5px_rgba(255,0,0,0.8)]'}`}>
                                                            {isOverEdge ? '+' : '-'}{Math.abs(edge).toFixed(1)} EDGE
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden flex items-center shadow-inner relative">
                                                        <div className="absolute inset-0 bg-white/5" />
                                                        <div
                                                            className={`h-full transition-all duration-1000 ease-out relative z-10 ${isOverEdge ? 'bg-nba-success shadow-[0_0_15px_rgba(0,255,0,0.6)]' : 'bg-nba-red shadow-[0_0_15px_rgba(255,0,0,0.6)]'}`}
                                                            style={{ width: `${gaugePercentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {injury && (
                                            <div className={`text - [9px] font - black uppercase tracking - widest p - 2 text - center rounded - sm font - oswald ${injury.isOut ? 'bg-nba-red/20 text-nba-red border border-nba-red/30' : 'bg-nba-gold/20 text-nba-gold border border-nba-gold/30'} `}>
                                                {injury.isOut ? 'OUT (-HW)' : 'DAY-TO-DAY (-HW/2)'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            ) : (
                <div className="py-32 text-center bg-nba-surface border border-dashed border-white/10 text-nba-text-secondary font-oswald text-sm font-black uppercase tracking-[0.4em] relative overflow-hidden group rounded-sm">
                    <div className="absolute inset-0 bg-nba-red/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                    WAITING_FOR_ACTIVE_NODES_TO_CALCULATE_PROPS
                </div>
            )}
        </section>
    );
};

export default PropsSection;
