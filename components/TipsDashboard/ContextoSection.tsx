import React, { useEffect, useState } from 'react';
import { AlignLeft, Database, Loader2, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ContextoSectionProps {
    tipsDate?: string;
}

interface NbaGameSchedule {
    id: number;
    game_date: string;
    home_team: string;
    away_team: string;
    tactical_prediction: string;
    groq_insight: string;
}

const ContextoSection: React.FC<ContextoSectionProps> = ({ tipsDate = '' }) => {
    const [schedules, setSchedules] = useState<NbaGameSchedule[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchSchedules = async () => {
            if (!tipsDate) return;
            setIsLoading(true);
            try {
                // tipsDate is DD/MM/YYYY, convert to YYYY-MM-DD
                const parts = tipsDate.split('/');
                if (parts.length === 3) {
                    const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    const { data, error } = await supabase
                        .from('nba_games_schedule')
                        .select('*')
                        .eq('game_date', formattedDate)
                        .order('game_time_et', { ascending: true });

                    if (error) {
                        console.error('Error fetching nba_games_schedule:', error);
                    } else if (data) {
                        setSchedules(data);
                    }
                }
            } catch (err) {
                console.error('Unexpected error fetching nba_games_schedule:', err);
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
                            <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none font-oswald">
                                Contexto <span className="text-nba-text-secondary">Node</span>
                            </h3>
                            <div className="flex items-center gap-4 mt-3">
                                <p className="text-nba-text-secondary text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-2 font-oswald">
                                    <Database className="w-3 h-3" /> painel_contexto
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-nba-surface border border-white/5 overflow-x-auto shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-sm">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                        <tr className="bg-nba-surface-elevated text-[10px] font-black text-nba-text-secondary uppercase tracking-widest border-b border-white/5 font-oswald">
                            <th className="px-3 py-3 border-r border-white/5 w-[10%]"><div className="flex items-center gap-2"><Calendar className="w-3 h-3" /> GAME_DATE</div></th>
                            <th className="px-3 py-3 border-r border-white/5 w-[15%]">HOME_TEAM</th>
                            <th className="px-3 py-3 border-r border-white/5 w-[15%]">AWAY_TEAM</th>
                            <th className="px-3 py-3 border-r border-white/5 w-[30%]">TACTICAL_PREDICTION</th>
                            <th className="px-3 py-3 w-[30%]">GROQ_INSIGHT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={5} className="py-20 text-center bg-nba-surface">
                                    <div className="flex flex-col items-center gap-4 text-nba-text-secondary">
                                        <Loader2 className="w-8 h-8 animate-spin text-nba-gold" />
                                        <span className="text-[10px] font-black uppercase tracking-widest font-oswald">Buscando contexto...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : schedules.length > 0 ? (
                            schedules.map((schedule) => (
                                <tr key={schedule.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="px-3 py-4 border-r border-white/5 text-xs text-center font-bebas tracking-wider text-nba-text-secondary align-top">
                                        {schedule.game_date}
                                    </td>
                                    <td className="px-3 py-4 border-r border-white/5 text-sm font-black font-oswald uppercase flex-col gap-1 align-top">
                                        {schedule.home_team}
                                    </td>
                                    <td className="px-3 py-4 border-r border-white/5 text-sm font-black font-oswald uppercase align-top">
                                        {schedule.away_team}
                                    </td>
                                    <td className="px-3 py-4 border-r border-white/5 align-top">
                                        <div className="max-h-32 overflow-y-auto text-xs text-nba-text-secondary pr-2 whitespace-pre-wrap leading-relaxed custom-scrollbar">
                                            {schedule.tactical_prediction || '-'}
                                        </div>
                                    </td>
                                    <td className="px-3 py-4 align-top">
                                        <div className="max-h-32 overflow-y-auto text-xs text-nba-gold pr-2 whitespace-pre-wrap leading-relaxed custom-scrollbar font-mono bg-nba-background/30 p-2 rounded">
                                            {schedule.groq_insight || '-'}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="py-20 text-center bg-nba-surface">
                                    <div className="flex flex-col items-center gap-6">
                                        <Database className="w-12 h-12 text-white/20" />
                                        <span className="text-[10px] font-black text-nba-text-secondary uppercase tracking-[0.4em] italic font-oswald">
                                            Nenhum contexto encontrado para {tipsDate}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default ContextoSection;
