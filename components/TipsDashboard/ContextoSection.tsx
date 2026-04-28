import React, { useEffect, useState } from 'react';
import { AlignLeft, Database, Loader2, Calendar, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ContextoSectionProps {
    tipsDate?: string;
    getTeamLogo?: (teamTri: string) => string;
}

interface NbaGameSchedule {
    id: number;
    game_date: string;
    home_tri: string;
    away_tri: string;
    tactical_prediction: string | null;
}

const ContextoSection: React.FC<ContextoSectionProps> = ({ tipsDate = '', getTeamLogo }) => {
    const [schedules, setSchedules] = useState<NbaGameSchedule[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchSchedules = async () => {
            if (!tipsDate) return;
            setIsLoading(true);
            try {
                const parts = tipsDate.split('/');
                if (parts.length === 3) {
                    const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    const { data, error } = await supabase
                        .from('nba_games_schedule')
                        .select('id, game_date, home_tri, away_tri, tactical_prediction')
                        .eq('game_date', formattedDate)
                        .order('id', { ascending: true }); // Ordenação ajustada devido à remoção de game_time_et

                    if (error) {
                        console.error('[Contexto Node] Erro fatal de leitura:', error);
                    } else if (data) {
                        setSchedules(data);
                    }
                }
            } catch (err) {
                console.error('[Contexto Node] Anomalia no ciclo de vida:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSchedules();
    }, [tipsDate]);

    return (
        <section className="space-y-8">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-6 border-b border-white/10 pb-6">
                    <div className="flex items-center gap-6">
                        <div className="bg-white p-3 shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                            <AlignLeft className="w-8 h-8 text-nba-black" />
                        </div>
                        <div>
                            <h3 className="text-2xl md:text-4xl font-black text-white italic uppercase tracking-tighter leading-none font-oswald">
                                Contexto <span className="text-nba-text-secondary">Node</span>
                            </h3>
                            <div className="flex items-center gap-4 mt-3">
                                <p className="text-nba-text-secondary text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-2 font-oswald">
                                    <Database className="w-3 h-3" /> painel_contexto_v2
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-nba-surface border border-white/5 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-sm">
                <table className="w-full text-left border-collapse min-w-[1000px] hidden md:table">
                    <thead>
                        <tr className="bg-nba-surface-elevated text-[10px] font-black text-nba-text-secondary uppercase tracking-widest border-b border-white/5 font-oswald">
                            <th className="px-3 py-3 border-r border-white/5 w-[15%]"><div className="flex items-center gap-2"><Calendar className="w-3 h-3" /> DATA</div></th>
                            <th className="px-3 py-3 border-r border-white/5 w-[25%] text-center">MATCHUP (TRI)</th>
                            <th className="px-4 py-3 w-[60%] flex items-center gap-2 text-nba-blue">
                                <Activity className="w-3.5 h-3.5" /> TACTICAL PREDICTION
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={3} className="py-20 text-center bg-nba-surface">
                                    <div className="flex flex-col items-center gap-4 text-nba-text-secondary">
                                        <Loader2 className="w-8 h-8 animate-spin text-nba-gold" />
                                        <span className="text-[10px] font-black uppercase tracking-widest font-oswald">Estabelecendo link de dados...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : schedules.length > 0 ? (
                            schedules.map((schedule) => (
                                <tr key={schedule.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="px-3 py-4 border-r border-white/5 text-xs text-center font-bebas tracking-wider text-nba-text-secondary align-middle">
                                        {schedule.game_date}
                                    </td>
                                    <td className="px-3 py-4 border-r border-white/5 text-sm font-black font-oswald uppercase align-middle">
                                        <div className="flex items-center justify-center gap-4 w-full">
                                            <div className="flex flex-col items-center gap-1">
                                                <img src={getTeamLogo ? getTeamLogo(schedule.home_tri) : ''} alt={schedule.home_tri} className="w-12 h-12 object-contain" />
                                                <span className="text-[12px] text-nba-text-secondary truncate w-24 text-center">{schedule.home_tri}</span>
                                            </div>
                                            <span className="text-white/30 text-xs italic">vs</span>
                                            <div className="flex flex-col items-center gap-1">
                                                <img src={getTeamLogo ? getTeamLogo(schedule.away_tri) : ''} alt={schedule.away_tri} className="w-12 h-12 object-contain" />
                                                <span className="text-[12px] text-nba-text-secondary truncate w-24 text-center">{schedule.away_tri}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        {schedule.tactical_prediction ? (
                                            <div className="max-h-80 overflow-y-auto pr-4 custom-scrollbar text-sm text-white/90 whitespace-pre-wrap leading-relaxed font-mono">
                                                {schedule.tactical_prediction}
                                            </div>
                                        ) : (
                                            <div className="h-full min-h-[100px] flex items-center justify-center border border-white/5 border-dashed rounded-sm bg-nba-surface/50">
                                                <span className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-oswald text-center">
                                                    Sem projeção tática em banco
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3} className="py-20 text-center bg-nba-surface">
                                    <div className="flex flex-col items-center gap-6">
                                        <Database className="w-12 h-12 text-white/20" />
                                        <span className="text-[10px] font-black text-nba-text-secondary uppercase tracking-[0.4em] italic font-oswald">
                                            Vazio paramétrico para {tipsDate}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* UX: Configuração HUD Mobile */}
                <div className="md:hidden flex flex-col divide-y divide-white/5">
                    {isLoading ? (
                        <div className="py-20 text-center flex flex-col items-center gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-nba-gold" />
                            <span className="text-xs font-black uppercase tracking-widest text-nba-text-secondary">Processando...</span>
                        </div>
                    ) : schedules.length > 0 ? (
                        schedules.map((schedule) => (
                            <div key={schedule.id} className="p-4 space-y-4 bg-nba-surface/50">
                                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-500 uppercase font-mono tracking-widest">{schedule.game_date}</span>
                                        <div className="flex items-center gap-2 mt-2">
                                            <img src={getTeamLogo ? getTeamLogo(schedule.home_tri) : ''} className="w-8 h-8 object-contain" />
                                            <span className="text-sm font-black font-oswald uppercase">{schedule.home_tri}</span>
                                            <span className="text-white/30 text-xs italic">vs</span>
                                            <img src={getTeamLogo ? getTeamLogo(schedule.away_tri) : ''} className="w-8 h-8 object-contain" />
                                            <span className="text-sm font-black font-oswald uppercase">{schedule.away_tri}</span>
                                        </div>
                                    </div>
                                </div>
                                {schedule.tactical_prediction ? (
                                    <div className="space-y-4">
                                        <span className="text-[10px] font-black text-nba-blue uppercase tracking-[0.2em] font-oswald flex items-center gap-2">
                                            <Activity className="w-3 h-3" /> Tático
                                        </span>
                                        <div className="max-h-[400px] overflow-y-auto text-sm text-white/80 whitespace-pre-wrap leading-relaxed bg-black/20 p-4 rounded-sm border border-white/5 font-mono text-[11px]">
                                            {schedule.tactical_prediction}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-8 text-center border border-dashed border-white/10 rounded-sm bg-black/20">
                                        <span className="text-[10px] text-white/20 uppercase tracking-widest font-oswald">Ausência de Dados</span>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="py-20 text-center">
                            <span className="text-[10px] font-black text-nba-text-secondary uppercase tracking-widest">Conjunto de dados vazio</span>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default ContextoSection;
