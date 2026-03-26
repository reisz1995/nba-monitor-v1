import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Team, MatchupAnalysis, PlayerStat, UnavailablePlayer, GameResult, MarketData } from '../types';
import { compareTeams, saveMatchupAnalysis, fetchGameWithMomentum } from '../services/geminiService';
import { supabase } from '../lib/supabase';
import { calculateDeterministicPace, DataballrInput } from '../lib/nbaUtils';
import { fetchDataballrFullStats, findDataballrStatsByName } from '../services/databallrService';
import { toast } from 'sonner';

interface UseTeamComparisonDataProps {
    teamA: Team;
    teamB: Team;
    playerStats: PlayerStat[];
    unavailablePlayers: UnavailablePlayer[];
    initialAnalysis?: MatchupAnalysis;
}

export const useTeamComparisonData = ({
    teamA,
    teamB,
    playerStats,
    unavailablePlayers,
    initialAnalysis
}: UseTeamComparisonDataProps) => {
    const [analysis, setAnalysis] = useState<MatchupAnalysis | null>(initialAnalysis || null);
    const [loading, setLoading] = useState(!initialAnalysis);
    const [savedToCloud, setSavedToCloud] = useState(!!initialAnalysis);
    const [marketData, setMarketData] = useState<MarketData | null>(null);
    const [notas, setNotas] = useState<{ a: number, b: number }>({
        a: teamA.ai_score || 0,
        b: teamB.ai_score || 0
    });
    const [databallrA, setDataballrA] = useState<DataballrInput | null>(null);
    const [databallrB, setDataballrB] = useState<DataballrInput | null>(null);

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

    // Busca as métricas avançadas do Databallr (últimos 14 dias) para os dois times
    useEffect(() => {
        const fetchDataballrStats = async () => {
            try {
                const allStats = await fetchDataballrFullStats();
                if (allStats.length === 0) return;
                const sA = findDataballrStatsByName(teamA.name, allStats);
                const sB = findDataballrStatsByName(teamB.name, allStats);
                if (sA) {
                    setDataballrA({
                        ortg: Number(sA.ortg) || undefined,
                        drtg: Number(sA.drtg) || undefined,
                        pace: sA.pace ? Number(sA.pace) : null,
                        o_ts: Number(sA.o_ts) || undefined,
                        o_tov: Number(sA.o_tov) || undefined,
                        orb: Number(sA.orb) || undefined,
                        drb: Number(sA.drb) || undefined,
                        net_rating: Number(sA.net_rating) || undefined,
                        offense_rating: Number(sA.offense_rating) || undefined,
                        defense_rating: Number(sA.defense_rating) || undefined,
                    });
                    console.info(`[Databallr] ✅ Stats carregadas para ${teamA.name}: ORTG=${sA.ortg} | DRTG=${sA.drtg} | NET=${sA.net_rating}`);
                } else {
                    console.warn(`[Databallr] ⚠️ Nenhuma stat encontrada para "${teamA.name}"`);
                }
                if (sB) {
                    setDataballrB({
                        ortg: Number(sB.ortg) || undefined,
                        drtg: Number(sB.drtg) || undefined,
                        pace: sB.pace ? Number(sB.pace) : null,
                        o_ts: Number(sB.o_ts) || undefined,
                        o_tov: Number(sB.o_tov) || undefined,
                        orb: Number(sB.orb) || undefined,
                        drb: Number(sB.drb) || undefined,
                        net_rating: Number(sB.net_rating) || undefined,
                        offense_rating: Number(sB.offense_rating) || undefined,
                        defense_rating: Number(sB.defense_rating) || undefined,
                    });
                    console.info(`[Databallr] ✅ Stats carregadas para ${teamB.name}: ORTG=${sB.ortg} | DRTG=${sB.drtg} | NET=${sB.net_rating}`);
                } else {
                    console.warn(`[Databallr] ⚠️ Nenhuma stat encontrada para "${teamB.name}"`);
                }
            } catch (e) {
                console.error('[Databallr] Falha ao buscar full stats:', e);
            }
        };
        fetchDataballrStats();
    }, [teamA.name, teamB.name]);

    // Busca odds da nba_odds_matrix — tolerante a falhas com maybeSingle()
    // Se o cron job ainda não correu ou não há linhas abertas, oddsData será null
    // e o motor de IA calcula apenas a projeção pura (sem colapso HTTP 406)
    useEffect(() => {
        const fetchMarketOdds = async () => {
            try {
                const { data: oddsData } = await supabase
                    .from('nba_odds_matrix')
                    .select('*')
                    .eq('matchup', `${teamB.name} @ ${teamA.name}`)
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

        const calculateHWImpact = (players: PlayerStat[], injuries: { nome: string, isOut: boolean }[]) => {
            let activeHW = 0;
            let penalty = 0;
            players.forEach(player => {
                const weight = getPlayerWeight(player.pontos || player.pts || 0);
                const injury = injuries.find(inj =>
                    inj.nome.toLowerCase() === (player.nome || player.player_name || '').toLowerCase()
                );
                if (injury) {
                    penalty += injury.isOut ? weight : (weight / 2);
                } else {
                    activeHW += weight;
                }
            });
            return { activeHW, penalty };
        };

        const impactA = calculateHWImpact(allPlayersA, injuriesA);
        const impactB = calculateHWImpact(allPlayersB, injuriesB);

        const { matchPace, totalPayload, deltaA, deltaB, kineticState, databallrEnhanced } = calculateDeterministicPace(
            teamA, teamB, undefined, databallrA, databallrB
        );
        let projA = deltaA;
        let projB = deltaB;

        projA -= impactA.penalty;
        projB -= impactB.penalty;

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
            penaltyA: impactA.penalty,
            penaltyB: impactB.penalty,
            activeHWA: impactA.activeHW,
            activeHWB: impactB.activeHW,
            spread: spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1),
            favorite: spread < 0 ? teamA.name : teamB.name
        };
    }, [teamA, teamB, injuriesA, injuriesB, playerStats, databallrA, databallrB]);

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
                // Find prediction ID to fetch momentum
                const { data: predData } = await supabase
                    .from('game_predictions')
                    .select('id')
                    .eq('home_team', teamA.name)
                    .eq('away_team', teamB.name)
                    .maybeSingle();

                let momentumData = {
                    home_record: teamA.record,
                    away_record: teamB.record,
                    momentum_data: { home_vs_away: [] }
                };

                if (predData?.id) {
                    const fetchedMomentum = await fetchGameWithMomentum(predData.id);
                    if (fetchedMomentum) momentumData = fetchedMomentum;
                }

                // Ensure array copies or original objects are resolved
                const result = await compareTeams(
                    teamA, teamB, playerStats,
                    [...injuriesA, ...injuriesB],
                    marketData, momentumData,
                    databallrA, databallrB
                );
                setAnalysis(result);
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
