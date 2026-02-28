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
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <div className="flex flex-col gap-4 font-mono">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                    <Tv className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">NBA_LIVE_DETERMINISTIC_FEED</h4>
                </div>
                <button onClick={fetchScores} className="text-[9px] font-black text-indigo-500 hover:text-white transition-colors cursor-pointer tracking-widest border border-indigo-500/30 px-2 py-0.5 rounded-sm bg-indigo-500/5">
                    SYNC_GAMES
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {loading && games.length === 0 ? (
                    <div className="col-span-full py-12 flex flex-col items-center gap-2 bg-white/5 border-2 border-dashed border-white/10 rounded-xl glass-morphism">
                        <Zap className="w-5 h-5 text-indigo-500 animate-pulse" />
                        <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.5em] animate-pulse">SCANNING_FREQUENCIES...</span>
                    </div>
                ) : games.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-[9px] text-slate-700 font-black uppercase tracking-[0.5em] border-2 border-dashed border-white/10 rounded-xl glass-morphism">
                        ZERO_GAMES_DETECTED
                    </div>
                ) : (
                    games.map(game => {
                        const comp = game.competitions[0];
                        const home = comp.competitors.find(c => c.homeAway === 'home');
                        const away = comp.competitors.find(c => c.homeAway === 'away');
                        const isCompleted = game.status.type.completed;
                        const isLive = game.status.type.state === 'in';

                        return (
                            <div key={game.id} className="bg-black/60 backdrop-blur-md border-2 border-white/10 p-3 shadow-[6px_6px_0px_#000] hover:border-indigo-500/50 transition-all flex flex-col gap-3 relative group glass-morphism rounded-lg overflow-hidden">
                                {isLive && <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-rose-600 animate-pulse m-2 shadow-[0_0_8px_#e11d48]" />}

                                <div className="absolute inset-x-0 top-0 h-0.5 bg-white/5 group-hover:bg-indigo-500/30 transition-colors"></div>

                                <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-[0.2em] border-b border-white/5 pb-2">
                                    <span className={isLive ? 'text-rose-500' : 'text-slate-600'}>
                                        {game.status.type.detail.replace('Final', 'F')}
                                    </span>
                                    {isLive && <span className="text-rose-500/50 italic">LIVE</span>}
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <img src={away?.team.logo} className="w-5 h-5 object-contain drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]" alt="" />
                                            <span className="text-[10px] font-black text-slate-400 truncate tracking-tighter uppercase">{away?.team.abbreviation}</span>
                                        </div>
                                        <span className={`text-sm font-black italic tracking-tighter ${Number(away?.score) > Number(home?.score) && (isCompleted || isLive) ? 'text-white' : 'text-slate-700'}`}>
                                            {away?.score}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <img src={home?.team.logo} className="w-5 h-5 object-contain drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]" alt="" />
                                            <span className="text-[10px] font-black text-slate-400 truncate tracking-tighter uppercase">{home?.team.abbreviation}</span>
                                        </div>
                                        <span className={`text-sm font-black italic tracking-tighter ${Number(home?.score) > Number(away?.score) && (isCompleted || isLive) ? 'text-white' : 'text-slate-700'}`}>
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
