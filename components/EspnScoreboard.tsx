import React, { useEffect, useState } from 'react';
import { Zap, Clock, Tv } from 'lucide-react';

interface Game {
    id: string;
    date: string;
    name: string;
    shortName: string;
    status: {
        type: {
            completed: boolean;
            detail: string;
            state: string;
        };
    };
    competitions: Array<{
        competitors: Array<{
            id: string;
            homeAway: string;
            team: {
                name: string;
                abbreviation: string;
                logo: string;
                displayName: string;
            };
            score: string;
        }>;
    }>;
}

import { supabase } from '../lib/supabase';

const EspnScoreboard: React.FC = () => {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchScores = async () => {
        try {
            setLoading(true);
            // Fetch from Supabase instead of direct ESPN API
            const { data, error } = await supabase
                .from('live_scoreboard')
                .select('games_data')
                .eq('id', 1)
                .single();

            if (error) throw error;
            setGames(data?.games_data || []);
        } catch (error) {
            console.error('Erro ao buscar placares do Banco:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchScores();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('live_scores')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'live_scoreboard',
                    filter: 'id=eq.1'
                },
                (payload) => {
                    if (payload.new && payload.new.games_data) {
                        setGames(payload.new.games_data);
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] Conectado e Selado.');
                }
            });

        return () => {
            console.log('[Realtime] Destruindo canal para preservar memória...');
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <div className="flex flex-col gap-4 font-mono">
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                    <Tv className="w-4 h-4 text-rose-500" />
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">NBA Live Scoreboard</h4>
                </div>
                <button onClick={fetchScores} className="text-[9px] font-black text-rose-500 hover:text-white transition-colors underline underline-offset-4 decoration-rose-500/30">
                    REFREASH_DATA
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {loading && games.length === 0 ? (
                    <div className="col-span-full py-8 flex flex-col items-center gap-2">
                        <Zap className="w-5 h-5 text-slate-800 animate-pulse" />
                        <span className="text-[9px] text-slate-800 font-black uppercase tracking-widestAlpha">Scanning...</span>
                    </div>
                ) : games.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-[9px] text-slate-800 font-black uppercase tracking-widestAlpha border-2 border-dashed border-slate-800">
                        No games today.
                    </div>
                ) : (
                    games.map(game => {
                        const comp = game.competitions[0];
                        const home = comp.competitors.find(c => c.homeAway === 'home');
                        const away = comp.competitors.find(c => c.homeAway === 'away');
                        const isCompleted = game.status.type.completed;
                        const isLive = game.status.type.state === 'in';

                        return (
                            <div key={game.id} className="bg-slate-900/40 border border-slate-800 p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:border-indigo-500/30 transition-all flex flex-col gap-2 relative group cursor-default">
                                {isLive && <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-rose-600 animate-pulse m-1.5 shadow-[0_0_5px_rgba(225,29,72,1)]" />}

                                <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-tighter border-b border-slate-800/50 pb-1">
                                    <span className={isLive ? 'text-rose-500' : 'text-slate-600'}>
                                        {game.status.type.detail.replace('Final', 'F')}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    {/* AWAY */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <img src={away?.team.logo} className="w-4 h-4 object-contain" alt="" />
                                            <span className="text-[10px] font-black text-slate-300 truncate">{away?.team.abbreviation}</span>
                                        </div>
                                        <span className={`text-xs font-black ${Number(away?.score) > Number(home?.score) && isCompleted ? 'text-indigo-400' : 'text-slate-500'}`}>
                                            {away?.score}
                                        </span>
                                    </div>

                                    {/* HOME */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <img src={home?.team.logo} className="w-4 h-4 object-contain" alt="" />
                                            <span className="text-[10px] font-black text-slate-300 truncate">{home?.team.abbreviation}</span>
                                        </div>
                                        <span className={`text-xs font-black ${Number(home?.score) > Number(away?.score) && isCompleted ? 'text-indigo-400' : 'text-slate-500'}`}>
                                            {home?.score}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default EspnScoreboard;
