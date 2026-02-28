
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
            <div className="flex flex-col gap-4 border-b-4 border-indigo-600 pb-8">
                <div className="flex items-center gap-6">
                    <div className="bg-indigo-600 p-3 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
                        <Target className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter">
                        Indiv. <span className="text-indigo-500">Props</span> [PRO]
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
                        if (injury) {
                            penalty = injury.isOut ? weight : (weight / 2);
                        }

                        const adjustedPoints = Math.max(0, player.pontos - penalty);

                        return (
                            <div key={player.id} className={`bg-slate-950 border-2 ${injury ? (injury.isOut ? 'border-rose-500/50' : 'border-amber-500/50') : 'border-slate-800'} p-0 hover:border-indigo-600 transition-all group overflow-hidden shadow-[10px_10px_0px_0px_rgba(0,0,0,0.3)]`}>
                                <div className="bg-slate-900 border-b-2 border-slate-800 p-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rotate-45 translate-x-8 -translate-y-8" />
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="w-12 h-12 bg-slate-950 border-2 border-slate-800 p-2 group-hover:border-indigo-600/50 transition-colors">
                                            <img src={getTeamLogo(player.time)} className="w-full h-full object-contain grayscale group-hover:grayscale-0 transition-all" alt="" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-500 uppercase leading-none mb-1 tracking-widest underline decoration-indigo-500/30">{player.time}</span>
                                            <span className={`text-xl font-black ${injury ? (injury.isOut ? 'text-rose-400' : 'text-amber-400') : 'text-white'} italic uppercase truncate w-32 tracking-tight group-hover:text-indigo-400 transition-colors`}>{player.nome.split(' ').pop()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-between items-end border-b border-slate-800 pb-4">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1">
                                                <Zap className="w-2.5 h-2.5 text-indigo-500" /> AVG_POINTS
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-2xl font-black ${penalty > 0 ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{player.pontos.toFixed(1)}</span>
                                                {penalty > 0 && <span className={`text-xl font-black ${injury?.isOut ? 'text-rose-500' : 'text-amber-500'}`}>{adjustedPoints.toFixed(1)}</span>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter bg-indigo-500/10 px-2 py-0.5">ESTIMATED</span>
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter bg-slate-800 px-2 py-0.5 border border-slate-700">HW: {weight.toFixed(1)}</span>
                                        </div>
                                    </div>
                                    <div className={`bg-slate-900 border-2 border-slate-800 p-4 relative transition-colors ${injury?.isOut ? 'opacity-50 grayscale' : 'group-hover:bg-slate-800/40'}`}>
                                        <span className="text-[9px] font-black text-slate-500 uppercase mb-2 block tracking-widest">EXPECTATION_THRESHOLD (PTS)</span>
                                        <div className="flex items-center justify-between">
                                            <span className="text-3xl font-black text-indigo-400 italic">{(adjustedPoints - 1.5).toFixed(1)}+</span>
                                            <ChevronRight className="w-6 h-6 text-slate-700 group-hover:translate-x-1 group-hover:text-indigo-500 transition-all" />
                                        </div>
                                    </div>
                                    {injury && (
                                        <div className={`text-[9px] font-black uppercase tracking-widest p-2 text-center rounded ${injury.isOut ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : 'bg-amber-500/20 text-amber-500 border border-amber-500/30'}`}>
                                            {injury.isOut ? 'OUT (-HW)' : 'DAY-TO-DAY (-HW/2)'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="py-32 text-center bg-slate-950 border-2 border-dashed border-slate-800 text-slate-800 font-mono text-sm font-black uppercase tracking-[0.4em] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-red-600/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                    WAITING_FOR_ACTIVE_NODES_TO_CALCULATE_PROPS
                </div>
            )}
        </section>
    );
};

export default PropsSection;
