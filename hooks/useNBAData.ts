
import { useEffect, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { supabase } from '../lib/supabase';
import { INITIAL_TEAMS, INITIAL_ESPN_DATA } from '../constants';
import { Team, GameResult, PlayerStat, ESPNData } from '../types';
import { getMomentumScore, parseStreakToRecord } from '../lib/nbaUtils';
import { withRetry } from '../lib/resilience';

export const useNBAData = () => {
    // 1. Data Fetching
    const { data: dbTeams = [], mutate: mutateTeams, isLoading: loadingTeams } = useSWR('nba/teams', async () => {
        const { data } = await supabase.from('teams').select('*');
        return data || [];
    }, { revalidateOnFocus: false });

    const { data: espnDataRaw = [], mutate: mutateEspn } = useSWR('nba/espn', async () => {
        const { data } = await supabase.from('classificacao_nba').select('*');
        return data || [];
    }, { revalidateOnFocus: false });

    const { data: playerStats = [], mutate: mutatePlayers, isLoading: loadingPlayers } = useSWR('nba/players', async () => {
        const { data } = await supabase.from('nba_jogadores_stats').select('*').order('pontos', { ascending: false });
        return data || [];
    }, { revalidateOnFocus: false });

    const { data: unavailablePlayers = [], mutate: mutateUnavailable, isLoading: loadingUnavailable } = useSWR('nba/unavailable', async () => {
        const { data } = await supabase.from('nba_injured_players').select('*');
        return data || [];
    }, { revalidateOnFocus: false });

    const { data: dbPredictions = [], mutate: mutatePredictions } = useSWR('nba/predictions', async () => {
        const { data } = await supabase.from('game_predictions').select('*');
        return data || [];
    }, { revalidateOnFocus: true });

    // 2. Real-time Subscriptions with Resilience
    useEffect(() => {
        let isActive = true;
        let currentChannel: any = null;

        const startSubscription = async () => {
            try {
                await withRetry(async () => {
                    if (!isActive) return;

                    // Clean up previous channel if any (shouldn't happen often but good for safety)
                    if (currentChannel) {
                        await supabase.removeChannel(currentChannel);
                        currentChannel = null;
                    }

                    const channelName = `nba-realtime-${Math.random().toString(36).slice(2, 11)}`;
                    const channel = supabase
                        .channel(channelName)
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => mutateTeams())
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'classificacao_nba' }, () => mutateEspn())
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_predictions' }, () => mutatePredictions());

                    return new Promise((resolve, reject) => {
                        channel.subscribe((status) => {
                            if (status === 'SUBSCRIBED') {
                                if (isActive) {
                                    currentChannel = channel;
                                    console.log(`[Realtime] Conectado: ${channelName}`);
                                    resolve(true);
                                } else {
                                    supabase.removeChannel(channel);
                                    resolve(false);
                                }
                            }

                            if (status === 'CHANNEL_ERROR') {
                                console.error(`[Realtime] Erro no canal: ${channelName}`);
                                supabase.removeChannel(channel);
                                reject(new Error(`Supabase Realtime Error: ${channelName}`));
                            }

                            if (status === 'CLOSED') {
                                console.warn(`[Realtime] Conexão fechada: ${channelName}`);
                                if (isActive) {
                                    // Trigger a re-subscription attempt by rejecting
                                    reject(new Error(`Supabase Realtime Closed: ${channelName}`));
                                }
                            }
                        });
                    });
                }, {
                    retries: 10,
                    initialDelay: 2000,
                    maxDelay: 60000
                });
            } catch (err) {
                if (isActive) {
                    console.error('[Realtime] Falha crítica após múltiplas tentativas:', err);
                }
            }
        };

        startSubscription();

        return () => {
            isActive = false;
            if (currentChannel) {
                supabase.removeChannel(currentChannel);
            }
        };
    }, [mutateTeams, mutateEspn, mutatePredictions]);

    // 3. Merging Logic
    const espnData = useMemo(() => {
        const baseMap = new Map<string, Partial<ESPNData>>();
        INITIAL_ESPN_DATA.forEach(d => {
            baseMap.set(d.time.toLowerCase(), { ...d });
        });

        espnDataRaw.forEach((d: Partial<ESPNData>) => {
            const name = (d.time || d.nome || d.equipe || '').toLowerCase();
            if (!name) return;
            let targetKey = Array.from(baseMap.keys()).find(key => name === key || name.startsWith(key + ' ') || name.endsWith(' ' + key) || key.startsWith(name + ' ') || key.endsWith(' ' + name)) || name;
            const existing = baseMap.get(targetKey) || {};
            baseMap.set(targetKey, { ...existing, ...d });
        });

        return Array.from(baseMap.values()).map(d => ({
            ...d,
            time: d.time || d.nome || d.equipe,
            vitorias: Number(d.vitorias ?? 0),
            derrotas: Number(d.derrotas ?? 0),
            aproveitamento: Number(d.pct_vit || d.pc_vit || d.aproveitamento || 0),
            media_pontos_ataque: Number(d.pts || d.media_pontos_ataque || 0),
            media_pontos_defesa: Number(d.pts_contra || d.media_pontos_defesa || 0),
            ultimos_5: String(d.ultimos_5 || '')
        } as ESPNData));
    }, [espnDataRaw]);

    const mergedTeams = useMemo(() => {
        return INITIAL_TEAMS.map(initial => {
            let dbTeam = dbTeams.find((t: Team) => t.id === initial.id);
            if (!dbTeam || (dbTeam.name && dbTeam.name.toLowerCase() !== initial.name.toLowerCase())) {
                dbTeam = dbTeams.find((t: any) => {
                    if (!t.name) return false;
                    const tName = t.name.toLowerCase();
                    const iName = initial.name.toLowerCase();
                    return tName === iName || tName.startsWith(iName + ' ') || tName.endsWith(' ' + iName) || iName.startsWith(tName + ' ') || iName.endsWith(' ' + tName);
                });
            }

            const espnStats = espnData.find(e => {
                const teamName = (e.time || '').toLowerCase();
                const initialName = initial.name.toLowerCase();
                return teamName === initialName || teamName.startsWith(initialName + ' ') || teamName.endsWith(' ' + initialName) || initialName.startsWith(teamName + ' ') || initialName.endsWith(' ' + teamName);
            });

            let currentWins = dbTeam?.wins ?? initial.wins;
            let currentLosses = dbTeam?.losses ?? initial.losses;
            if (espnStats) {
                currentWins = Number(espnStats.vitorias);
                currentLosses = Number(espnStats.derrotas);
            }

            let currentRecord: GameResult[] = [];
            if (dbTeam?.record && Array.isArray(dbTeam.record) && dbTeam.record.length > 0) {
                currentRecord = dbTeam.record;
            } else if (espnStats?.ultimos_5) {
                const parsedRecord = parseStreakToRecord(espnStats.ultimos_5);
                if (parsedRecord) currentRecord = parsedRecord;
            } else {
                currentRecord = initial.record || [];
            }

            return {
                ...initial,
                ...dbTeam,
                name: dbTeam?.name || initial.name,
                logo: initial.logo,
                record: currentRecord,
                wins: currentWins,
                losses: currentLosses,
                espnData: espnStats,
                stats: espnStats ? {
                    media_pontos_ataque: espnStats.media_pontos_ataque,
                    media_pontos_defesa: espnStats.media_pontos_defesa,
                    aproveitamento: espnStats.aproveitamento,
                    ultimos_5_espn: espnStats.ultimos_5
                } : undefined
            };
        });
    }, [dbTeams, espnData]);

    const sortedTeams = useMemo(() => {
        return [...mergedTeams].sort((a, b) => {
            const scoreA = getMomentumScore(a.record);
            const scoreB = getMomentumScore(b.record);
            if (scoreB !== scoreA) return scoreB - scoreA;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return (b.stats?.aproveitamento || 0) - (a.stats?.aproveitamento || 0);
        });
    }, [mergedTeams]);

    // 4. Actions
    const handleToggleRecord = useCallback(async (teamId: number, recordIndex: number) => {
        const team = mergedTeams.find(t => t.id === teamId);
        if (!team) return;

        const oldRecord = [...(team.record || [])] as GameResult[];
        const wasWin = oldRecord[recordIndex] === 'V';
        const newRecord = [...oldRecord];
        newRecord[recordIndex] = wasWin ? 'D' : 'V';

        // Optimistic update
        mutateTeams((prev: Team[]) => prev?.map((t: Team) => t.id === teamId ? { ...t, record: newRecord } : t) || [], false);

        try {
            await supabase.from('teams').upsert({ id: teamId, record: newRecord });
        } catch (err) {
            console.error(err);
        }
    }, [mergedTeams, mutateTeams]);

    return {
        teams: mergedTeams,
        sortedTeams,
        playerStats,
        unavailablePlayers,
        dbPredictions,
        loading: {
            teams: loadingTeams,
            players: loadingPlayers,
            unavailable: loadingUnavailable
        },
        actions: {
            handleToggleRecord,
            mutatePlayers,
            mutateUnavailable
        }
    };
};
