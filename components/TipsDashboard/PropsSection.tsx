
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
        <section className="space-y-12 animate-in fade-in duration-1000">
            <div className="flex flex-col gap-4 border-b-2 border-white/10 pb-8">
                <div className="flex items-center gap-6">
                    <div className="bg-white p-4 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] rounded-sm">
                        <Target className="w-10 h-10 text-black" />
                    </div>
                    <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter">
                        INDIV. <span className="text-indigo-500 underline decoration-indigo-500/30 underline-offset-8">PROPS</span> [QUANTUM_CORE]
                    </h3>
                </div>
            </div>

            {playersPlayingToday.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                            <div key={player.id} className={`bg-black/40 backdrop-blur-xl border-2 ${injury ? (injury.isOut ? 'border-rose-500/50 shadow-[10px_10px_0px_#e11d4820]' : 'border-amber-500/50 shadow-[10px_10px_0px_#f59e0b20]') : 'border-white/10 shadow-[12px_12px_0px_#000]'} rounded-xl glass-morphism overflow-hidden group hover:border-indigo-500/50 transition-all font-mono`}>
                                <div className="bg-white/5 border-b border-white/5 p-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rotate-45 translate-x-12 -translate-y-12" />
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="w-12 h-12 bg-black border-2 border-white/10 p-2 group-hover:border-indigo-500/50 transition-colors shadow-[4px_4px_0px_#000]">
                                            <img src={getTeamLogo(player.time)} className="w-full h-full object-contain grayscale group-hover:grayscale-0 transition-all drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]" alt="" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[9px] font-black text-slate-500 uppercase leading-none mb-1.5 tracking-widest">{player.time}</span>
                                            <span className={`text-xl font-black ${injury ? (injury.isOut ? 'text-rose-400' : 'text-amber-400') : 'text-white'} italic uppercase truncate pr-2 tracking-tighter group-hover:text-indigo-400 transition-colors`}>{player.nome.split(' ').pop()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="flex justify-between items-end border-b border-white/5 pb-4">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] flex items-center gap-1.5 mb-2">
                                                <Zap className="w-3 h-3 text-indigo-500" /> RAW_POINT_AVG
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <span className={`text-3xl font-black tracking-tighter ${penalty > 0 ? 'text-slate-600 line-through' : 'text-slate-200'}`}>{player.pontos.toFixed(1)}</span>
                                                {penalty > 0 && <span className={`text-2xl font-black tracking-tighter ${injury?.isOut ? 'text-rose-500' : 'text-amber-500'}`}>{adjustedPoints.toFixed(1)}</span>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 font-bold">
                                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.1em] bg-indigo-500/10 px-2 py-0.5 rounded-sm">PRECOMPUTED</span>
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter bg-white/5 px-2 py-0.5 border border-white/5">HW_VAL: {weight.toFixed(1)}</span>
                                        </div>
                                    </div>
                                    <div className={`bg-black/40 border border-white/5 p-5 relative transition-all rounded-lg glass-morphism ${injury?.isOut ? 'opacity-40 grayscale' : 'group-hover:bg-white/5 group-hover:border-indigo-500/20'}`}>
                                        <span className="text-[8px] font-black text-slate-600 uppercase mb-3 block tracking-[0.3em]">PROBABILITY_THRESHOLD (PTS)</span>
                                        <div className="flex items-center justify-between">
                                            <span className="text-4xl font-black text-indigo-400 italic tracking-tighter">{(adjustedPoints - 1.5).toFixed(1)}+</span>
                                            <ChevronRight className="w-8 h-8 text-white/10 group-hover:translate-x-1 group-hover:text-indigo-500 transition-all" />
                                        </div>
                                    </div>
                                    {injury && (
                                        <div className={`text-[8px] font-black uppercase tracking-[0.2em] p-2.5 text-center rounded-sm ${injury.isOut ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                                            {injury.isOut ? 'ENTITY_OFFLINE (-HW)' : 'STATUS_UNCERTAIN (-HW/2)'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="py-40 text-center bg-black/40 border-2 border-white/5 glass-morphism rounded-xl text-slate-800 font-mono text-xs font-black uppercase tracking-[0.6em] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-indigo-600/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                    SYSTEM_IDLE: AWAITING_ACTIVE_NODES_FOR_HW_COMPUTATION
                </div>
            )}
        </section>
    );
};

export default PropsSection;
