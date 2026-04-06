import { useEffect, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { supabase } from '../lib/supabase';
import { INITIAL_TEAMS, INITIAL_ESPN_DATA } from '../constants';
import { Team, GameResult } from '../types';
import { withRetry } from '../lib/resilience';
import { fetchDataballrFullStats } from '../services/databallrService';
import { mergeESPNData, mergeTeams, sortTeams } from '../lib/dataMerger';

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

    const { data: databallrFull = [] } = useSWR('nba/databallr', async () => {
        return await fetchDataballrFullStats();
    }, { revalidateOnFocus: false });

    // 2. Real-time Subscriptions with Resilience
    useEffect(() => {
        let isActive = true;
        let currentChannel: any = null;

        const startSubscription = async () => {
            try {
                await withRetry(async () => {
                    if (!isActive) return;

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
                        let handled = false;
                        channel.subscribe((status) => {
                            if (handled) return;

                            if (status === 'SUBSCRIBED') {
                                handled = true;
                                if (isActive) {
                                    currentChannel = channel;
                                    resolve(true);
                                } else {
                                    supabase.removeChannel(channel);
                                    resolve(false);
                                }
                            }
                            if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
                                handled = true;
                                supabase.removeChannel(channel);
                                reject(new Error(`Supabase Realtime Error: ${status}`));
                            }
                        });
                    });
                }, { retries: 10, initialDelay: 2000, maxDelay: 60000 });
            } catch (err) {
                console.error('[Realtime] Falha crítica:', err);
            }
        };

        startSubscription();
        return () => {
            isActive = false;
            if (currentChannel) supabase.removeChannel(currentChannel);
        };
    }, [mutateTeams, mutateEspn, mutatePredictions]);

    // 3. Merging & Sorting Logic (Delegated to dataMerger)
    const espnData = useMemo(() =>
        mergeESPNData(espnDataRaw, INITIAL_ESPN_DATA),
        [espnDataRaw]);

    const mergedTeams = useMemo(() =>
        mergeTeams(INITIAL_TEAMS, dbTeams, espnData, databallrFull),
        [dbTeams, espnData, databallrFull]);

    const sortedTeams = useMemo(() =>
        sortTeams(mergedTeams),
        [mergedTeams]);

    // 4. Actions
    const handleToggleRecord = useCallback(async (teamId: number, recordIndex: number) => {
        const team = mergedTeams.find(t => t.id === teamId);
        if (!team) return;

        const newRecord = [...(team.record || [])] as GameResult[];
        newRecord[recordIndex] = newRecord[recordIndex] === 'V' ? 'D' : 'V';

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
