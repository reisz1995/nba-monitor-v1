import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Team, MatchupAnalysis, PlayerStat, UnavailablePlayer, GameResult, MarketData } from '../types';
import { compareTeams, saveMatchupAnalysis, fetchGameWithMomentum } from '../services/geminiService';
import { supabase } from '../lib/supabase';
import { calculateProjectedScores, DataballrInput, getStandardTeamName, normalizeTeamName } from '../lib/nbaUtils';
import { findDataballrStatsByName } from '../services/databallrService';
import { toast } from 'sonner';

interface UseTeamComparisonDataProps {
    teamA: Team;
    teamB: Team;
    playerStats: PlayerStat[];
    unavailablePlayers: UnavailablePlayer[];
    initialAnalysis?: MatchupAnalysis;
    dbPredictions?: any[];
}

export const useTeamComparisonData = ({
    teamA,
    teamB,
    playerStats,
    unavailablePlayers,
    initialAnalysis,
    dbPredictions = []
}: UseTeamComparisonDataProps) => {
    const [analysis, setAnalysis] = useState<MatchupAnalysis | null>(initialAnalysis || null);
    const [loading, setLoading] = useState(!initialAnalysis);
    const [savedToCloud, setSavedToCloud] = useState(!!initialAnalysis);
    const [marketData, setMarketData] = useState<MarketData | null>(null);

    // Encontra a predição específica para extrair H2H (defense_data)
    const currentPrediction = useMemo(() => {
        return dbPredictions.find(p =>
            (getStandardTeamName(p.home_team) === getStandardTeamName(teamA.name) &&
                getStandardTeamName(p.away_team) === getStandardTeamName(teamB.name)) ||
            (getStandardTeamName(p.home_team) === getStandardTeamName(teamB.name) &&
                getStandardTeamName(p.away_team) === getStandardTeamName(teamA.name))
        );
    }, [dbPredictions, teamA.name, teamB.name]);

    const isReversed = useMemo(() => {
        if (!currentPrediction) return false;
        return getStandardTeamName(currentPrediction.home_team) === getStandardTeamName(teamB.name);
    }, [currentPrediction, teamB.name]);

    const defenseData = useMemo(() => {
        const rawH2H = currentPrediction?.defense_data || currentPrediction?.momentum_data?.home_vs_away;
        if (!rawH2H) return [];
        
        const rawData = typeof rawH2H === 'string'
            ? JSON.parse(rawH2H)
            : rawH2H;

        if (isReversed && Array.isArray(rawData)) {
            return rawData.map((g: any) => ({
                ...g,
                result: g.result === 'V' ? 'D' : 'V',
                score: g.score.includes('-') ? g.score.split('-').reverse().join('-') : g.score
            }));
        }
        return rawData;
    }, [currentPrediction, isReversed]);
    const [notas, setNotas] = useState<{ a: number, b: number }>({
        a: teamA.ai_score || 0,
        b: teamB.ai_score || 0
    });
    const databallrA = teamA.databallr || null;
    const databallrB = teamB.databallr || null;

    useEffect(() => {
        const fetchTeamNotas = async () => {
            try {
                const { data } = await supabase
                    .from('tabela_notas')
                    .select('*')
                    .in('franquia', [teamA.name, teamB.name]);

                if (data) {
                    const nA = data.find(n => n.franquia === teamA.name)?.nota_ia || teamA.ai_score || 0;
                    const nB = data.find(n => n.franquia === teamB.name)?.nota_ia || teamB.ai_score || 0;
                    setNotas({ a: Number(nA), b: Number(nB) });
                }
            } catch (e) {
                console.error("Erro ao buscar notas:", e);
            }
        };
        fetchTeamNotas();
    }, [teamA.name, teamB.name, teamA.ai_score, teamB.ai_score]);


    // Busca odds da nba_odds_matrix — tolerante a falhas com maybeSingle()
    // Se o cron job ainda não correu ou não há linhas abertas, oddsData será null
    // e o motor de IA calcula apenas a projeção pura (sem colapso HTTP 406)
    useEffect(() => {
        const fetchMarketOdds = async () => {
            try {
                const { data: oddsData } = await supabase
                    .from('nba_odds_matrix')
                    .select('*')
                    .eq('matchup', `${getStandardTeamName(teamB.name)} @ ${getStandardTeamName(teamA.name)}`)
                    .maybeSingle();
                setMarketData(oddsData ?? null);
            } catch (e) {
                console.warn('[MarketOdds] Não foi possível obter linha de mercado:', e);
                setMarketData(null);
            }
        };
        fetchMarketOdds();
    }, [teamA.name, teamB.name]);

    const getInjuriesForTeam = useCallback((teamName: string) => {
        const teamPlayers = (unavailablePlayers || []).filter(p => {
            const pTime = (p.team_name || p.time || p.franquia || '').toLowerCase();
            const tName = teamName.toLowerCase();
            return pTime === tName || pTime.startsWith(tName + ' ') || pTime.endsWith(' ' + tName);
        });

        const seen = new Set();
        return teamPlayers.filter(p => {
            const name = p.player_name || p.nome;
            if (!name || seen.has(name.toLowerCase())) return false;
            seen.add(name.toLowerCase());
            return true;
        }).map(p => {
            const status = (p.injury_status || p.gravidade || 'OUT').toUpperCase();
            const isOut = status.includes('OUT') || status.includes('GRAVE') || status.includes('FORA');
            return {
                nome: p.player_name || p.nome || '',
                status: status,
                isOut
            };
        });
    }, [unavailablePlayers]);

    const injuriesA = useMemo(() => getInjuriesForTeam(teamA.name), [getInjuriesForTeam, teamA.name]);
    const injuriesB = useMemo(() => getInjuriesForTeam(teamB.name), [getInjuriesForTeam, teamB.name]);

    const getPlayerWeight = (pts: number) => Math.floor((pts || 0) / 3);

    const getKeyPlayers = useCallback((teamName: string) => {
        return playerStats
            .filter(p => {
                const pTime = (p.team_name || p.time || '').toLowerCase();
                const targetName = teamName.toLowerCase();
                return pTime === targetName || pTime.startsWith(targetName + ' ') || pTime.endsWith(' ' + targetName);
            })
            .sort((a, b) => (b.pontos || 0) - (a.pontos || 0))
            .slice(0, 4);
    }, [playerStats]);

    const keyPlayersA = useMemo(() => getKeyPlayers(teamA.name), [getKeyPlayers, teamA.name]);
    const keyPlayersB = useMemo(() => getKeyPlayers(teamB.name), [getKeyPlayers, teamB.name]);

    const bettingLines = useMemo(() => {
        const atkA = Number(teamA.espnData?.pts || teamA.stats?.media_pontos_ataque || 0);
        const atkB = Number(teamB.espnData?.pts || teamB.stats?.media_pontos_ataque || 0);
        const defA = Number(teamA.espnData?.pts_contra || teamA.stats?.media_pontos_defesa || 0);
        const defB = Number(teamB.espnData?.pts_contra || teamB.stats?.media_pontos_defesa || 0);

        const totalA = teamA.wins + teamA.losses;
        const totalB = teamB.wins + teamB.losses;

        const aprA = Number(teamA.espnData?.pct_vit || teamA.espnData?.pc_vit || teamA.stats?.aproveitamento || (totalA > 0 ? teamA.wins / totalA : 0)) * 100;
        const aprB = Number(teamB.espnData?.pct_vit || teamB.espnData?.pc_vit || teamB.stats?.aproveitamento || (totalB > 0 ? teamB.wins / totalB : 0)) * 100;

        const rosterFilter = (time: string, team: Team) => {
            const pTime = time.toLowerCase();
            const tName = team.name.toLowerCase();
            return pTime === tName || pTime.startsWith(tName + ' ') || pTime.endsWith(' ' + tName);
        };

        const allPlayersA = playerStats.filter(p => rosterFilter(p.time || p.team_name || '', teamA));
        const allPlayersB = playerStats.filter(p => rosterFilter(p.time || p.team_name || '', teamB));

        const mapInjuries = (players: PlayerStat[], injuries: { nome: string, isOut: boolean }[]) => {
            return players.map(player => {
                const weight = getPlayerWeight(player.pontos || player.pts || 0);
                const injury = injuries.find(inj =>
                    inj.nome.toLowerCase() === (player.nome || player.player_name || '').toLowerCase()
                );
                return {
                    nome: player.nome || player.player_name || '',
                    isOut: !!injury?.isOut,
                    weight
                };
            });
        };

        const mappedInjuriesA = mapInjuries(allPlayersA, injuriesA);
        const mappedInjuriesB = mapInjuries(allPlayersB, injuriesB);

        const { matchPace, totalPayload, deltaA, deltaB, kineticState, databallrEnhanced } = calculateProjectedScores(
            teamA, teamB, {
            isHomeA: true,
            injuriesA: mappedInjuriesA,
            injuriesB: mappedInjuriesB,
            powerA: notas.a,
            powerB: notas.b,
            defenseData: defenseData
        }, databallrA, databallrB
        );
        let projA = deltaA;
        let projB = deltaB;

        const spread = projB - projA;

        return {
            ataqueA: atkA,
            ataqueB: atkB,
            defesaA: defA,
            defesaB: defB,
            aproveitamentoA: aprA,
            aproveitamentoB: aprB,
            databallrEnhanced,
            projectedA: projA,
            projectedB: projB,
            totalProjected: projA + projB,
            matchPace,
            kineticState,
            penaltyA: 0, // Agora embutido na projeção
            penaltyB: 0,
            activeHWA: mappedInjuriesA.reduce((sum, p) => sum + (p.isOut ? 0 : p.weight), 0),
            activeHWB: mappedInjuriesB.reduce((sum, p) => sum + (p.isOut ? 0 : p.weight), 0),
            spread: spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1),
            favorite: spread < 0 ? teamA.name : teamB.name
        };
    }, [teamA, teamB, injuriesA, injuriesB, playerStats, databallrA, databallrB, analysis, loading]);

    const advantageMatrix = useMemo(() => {
        const calcMomentum = (record: GameResult[]) => {
            const rec = [...(record || [])].slice(-5);
            return rec.reduce((acc, res, i) => {
                const rStr = typeof res === 'object' && res !== null ? (res as any).result : res;
                const weight = Math.pow(2, i + 1);
                return acc + (rStr === 'V' ? weight : -weight);
            }, 0);
        };

        const momA = calcMomentum(teamA.record);
        const momB = calcMomentum(teamB.record);

        return {
            momentum: {
                a: momA,
                b: momB,
                winner: momA > momB ? 'a' as const : momB > momA ? 'b' as const : 'none' as const,
                label: `W_EXP: ${momA} vs ${momB}`
            },
            ataque: {
                a: bettingLines.ataqueA,
                b: bettingLines.ataqueB,
                winner: bettingLines.ataqueA > bettingLines.ataqueB ? 'a' as const : 'b' as const,
                label: `PACE_MAX: ${Math.max(bettingLines.ataqueA, bettingLines.ataqueB)}`
            },
            defesa: {
                a: bettingLines.defesaA,
                b: bettingLines.defesaB,
                winner: bettingLines.defesaA < bettingLines.defesaB ? 'a' as const : 'b' as const,
                label: `DEF_RATING_LOW`
            },
            hw: {
                a: bettingLines.activeHWA,
                b: bettingLines.activeHWB,
                winner: bettingLines.activeHWA > bettingLines.activeHWB ? 'a' as const : 'b' as const,
                label: `STAR_POWER_ACTIVE`
            }
        };
    }, [teamA.record, teamB.record, bettingLines]);

    const fetchLock = useRef<string | null>(null);
    const matchupKey = `${teamA.id}_vs_${teamB.id}`;

    useEffect(() => {
        if (!!initialAnalysis || fetchLock.current === matchupKey) return;

        const fetchAnalysis = async () => {
            fetchLock.current = matchupKey;
            setLoading(true);
            try {
                // 1. Tenta extrair momentum base do cache (currentPrediction) ou re-busca
                let momentumData: any = null;

                if (currentPrediction) {
                    momentumData = {
                        ...currentPrediction,
                        home_record: teamA.record,
                        away_record: teamB.record,
                        momentum_data: typeof currentPrediction.momentum_data === 'string'
                            ? JSON.parse(currentPrediction.momentum_data)
                            : currentPrediction.momentum_data || { home_vs_away: [] },
                        defense_data: typeof currentPrediction.defense_data === 'string'
                            ? JSON.parse(currentPrediction.defense_data)
                            : currentPrediction.defense_data || []
                    };
                } else {
                    const { data: predData } = await supabase
                        .from('game_predictions')
                        .select('id, home_team, away_team')
                        .or(`and(home_team.eq."${teamA.name}",away_team.eq."${teamB.name}"),and(home_team.eq."${teamB.name}",away_team.eq."${teamA.name}")`)
                        .maybeSingle();

                    if (predData?.id) {
                        momentumData = await fetchGameWithMomentum(predData.id);
                    } else {
                        momentumData = {
                            home_record: teamA.record,
                            away_record: teamB.record,
                            momentum_data: { home_vs_away: [] },
                            defense_data: []
                        };
                    }
                }

                // Normalização de perspectiva se o time A for visitante na predição original
                if (momentumData?.away_team) {
                    const isRev = normalizeTeamName(momentumData.away_team) === normalizeTeamName(teamA.name);
                    if (isRev) {
                        // Normaliza defense_data
                        if (Array.isArray(momentumData.defense_data)) {
                            momentumData.defense_data = momentumData.defense_data.map((g: any) => ({
                                ...g,
                                result: g.result === 'V' ? 'D' : (g.result === 'D' ? 'V' : g.result),
                                score: g.score?.includes('-') ? g.score.split('-').reverse().join('-') : g.score
                            }));
                        }
                        // Normaliza momentum_data.home_vs_away
                        if (momentumData.momentum_data?.home_vs_away && Array.isArray(momentumData.momentum_data.home_vs_away)) {
                            momentumData.momentum_data.home_vs_away = momentumData.momentum_data.home_vs_away.map((g: any) => ({
                                ...g,
                                result: g.result === 'V' ? 'D' : (g.result === 'D' ? 'V' : g.result),
                                score: g.score?.includes('-') ? g.score.split('-').reverse().join('-') : g.score
                            }));
                        }
                    }
                }

                // Ensure array copies or original objects are resolved
                const result = await compareTeams(
                    teamA, teamB, playerStats,
                    [...injuriesA, ...injuriesB],
                    marketData, momentumData,
                    databallrA, databallrB
                );
                setAnalysis(result);

                // pickTotal já vem calculado dentro de compareTeams
                await saveMatchupAnalysis(teamA.id, teamB.id, { ...result, result: 'pending' });
                setSavedToCloud(true);
            } catch (e: any) {
                console.error("[SYSTEM_ERROR] Colapso na matriz vetorial:", e);
                setAnalysis({
                    winner: "N/A",
                    confidence: 0,
                    keyFactor: "FALHA_DE_SISTEMA_EXTERNO",
                    detailedAnalysis: "ERRO 503: Motor IA temporariamente indisponível devido a anomalias no servidor. Tente novamente mais tarde.",
                    expectedScoreA: 0,
                    expectedScoreB: 0,
                    projectedPace: 0,
                    result: 'pending'
                });
            } finally {
                setLoading(false);
            }
        };
        fetchAnalysis();
    }, [teamA.id, teamB.id, initialAnalysis]);

    return {
        analysis,
        loading,
        savedToCloud,
        notas,
        injuriesA,
        injuriesB,
        keyPlayersA,
        keyPlayersB,
        bettingLines,
        advantageMatrix,
        getPlayerWeight,
        marketData,
        databallrA,
        databallrB,
    };
};
