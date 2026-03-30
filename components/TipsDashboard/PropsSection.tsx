
import React from 'react';
import { Target, Zap, ChevronRight } from 'lucide-react';
import { PlayerStat, Team, UnavailablePlayer } from '../../types';
import { getPlayerWeight } from '../../lib/nbaUtils';

interface PropsSectionProps {
    playersPlayingToday: PlayerStat[];
    teams: Team[];
    getInjuriesForTeam: (teamName: string) => any[];
    getTeamLogo: (teamName: string) => string;
}

const PropsSection: React.FC<PropsSectionProps> = ({
    playersPlayingToday,
    teams,
    getInjuriesForTeam,
    getTeamLogo
}) => {
    return (
        <section className="space-y-12">
            <div className="flex flex-col gap-4 border-b border-nba-blue/30 pb-8">
                <div className="flex items-center gap-6">
                    <div className="bg-nba-blue p-3 shadow-glow-blue">
                        <Target className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter font-oswald">
                        Indiv. <span className="text-nba-blue">Props</span> [PRO]
                    </h3>
                </div>
            </div>

            {playersPlayingToday.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-700">
                    {playersPlayingToday.slice(0, 24).map((player) => {
                        const teamInjuries = getInjuriesForTeam(player.time);
                        const injury = teamInjuries.find(inj => inj.nome?.toLowerCase() === player.nome.toLowerCase());
                        const weight = getPlayerWeight(player.pontos);

                        let penalty = 0;
                        if (injury && injury.isOut && weight >= 9) {
                            penalty = weight;
                        }

                        const adjustedPoints = Math.max(0, player.pontos - penalty);

                        return (
                            <div key={player.id} className={`bg-nba-surface border ${injury ? (injury.isOut ? 'border-nba-red/50' : 'border-nba-gold/50') : 'border-white/5'} p-0 hover:border-nba-blue/50 transition-all group overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] rounded-sm`}>
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
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-between items-end border-b border-white/5 pb-4">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-nba-text-secondary uppercase tracking-widest flex items-center gap-1 font-oswald">
                                                <Zap className="w-2.5 h-2.5 text-nba-blue" /> AVG_POINTS
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-2xl font-black font-bebas ${penalty > 0 ? 'text-nba-text-secondary line-through' : 'text-white'}`}>{player.pontos.toFixed(1)}</span>
                                                {penalty > 0 && <span className={`text-xl font-black font-bebas ${injury?.isOut ? 'text-nba-red' : 'text-nba-gold'}`}>{adjustedPoints.toFixed(1)}</span>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] font-black text-nba-blue uppercase tracking-tighter bg-nba-blue/10 px-2 py-0.5 font-oswald rounded-sm">ESTIMATED</span>
                                            <span className="text-[9px] font-black text-nba-text-secondary uppercase tracking-tighter bg-nba-background px-2 py-0.5 border border-white/5 font-oswald rounded-sm">HW: {weight.toFixed(1)}</span>
                                        </div>
                                    </div>
                                    <div className={`bg-nba-surface-elevated border border-white/5 p-4 relative transition-colors ${injury?.isOut ? 'opacity-50 grayscale' : 'group-hover:bg-white/5'} rounded-sm`}>
                                        <span className="text-[9px] font-black text-nba-text-secondary uppercase mb-2 block tracking-widest font-oswald">EXPECTATION_THRESHOLD (PTS)</span>
                                        <div className="flex items-center justify-between">
                                            <span className="text-3xl font-black text-nba-blue italic font-bebas">{(adjustedPoints - 1.5).toFixed(1)}+</span>
                                            <ChevronRight className="w-6 h-6 text-slate-400 group-hover:translate-x-1 group-hover:text-nba-blue transition-all" />
                                        </div>
                                    </div>
                                    {injury && (
                                        <div className={`text-[9px] font-black uppercase tracking-widest p-2 text-center rounded-sm font-oswald ${injury.isOut ? 'bg-nba-red/20 text-nba-red border border-nba-red/30' : 'bg-nba-gold/20 text-nba-gold border border-nba-gold/30'}`}>
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
