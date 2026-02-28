import { useState, useEffect, useMemo, useCallback } from 'react';
import { Team, MatchupAnalysis, PlayerStat, UnavailablePlayer, GameResult } from '../types';
import { compareTeams, saveMatchupAnalysis } from '../services/geminiService';
import { supabase } from '../lib/supabase';
import { calculateDeterministicPace } from '../lib/nbaUtils';
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
    const [notas, setNotas] = useState<{ a: number, b: number }>({
        a: teamA.ai_score || 0,
        b: teamB.ai_score || 0
    });

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

    const getInjuriesForTeam = useCallback((teamName: string) => {
        const teamPlayers = (unavailablePlayers || []).filter(p => {
            const pTime = (p.team_name || p.time || p.franquia || '').toLowerCase();
            const tName = teamName.toLowerCase();
            return pTime.includes(tName) || tName.includes(pTime);
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
                const pTime = (p.time || '').toLowerCase();
                return pTime.includes(teamName.toLowerCase()) || teamName.toLowerCase().includes(pTime);
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
            return pTime.includes(tName) || tName.includes(pTime);
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

        const { matchPace, totalPayload, deltaA, deltaB, kineticState } = calculateDeterministicPace(teamA, teamB);
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
    }, [teamA, teamB, injuriesA, injuriesB, playerStats]);

    const advantageMatrix = useMemo(() => {
        const calcMomentum = (record: GameResult[]) => {
            const rec = [...(record || [])].slice(-5);
            return rec.reduce((acc, res, i) => {
                const weight = Math.pow(2, i + 1);
                return acc + (res === 'V' ? weight : -weight);
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

    useEffect(() => {
        if (!!initialAnalysis) return;
        const fetchAnalysis = async () => {
            setLoading(true);
            try {
                const result = await compareTeams(teamA, teamB, playerStats, [...injuriesA, ...injuriesB]);
                setAnalysis(result);
                await saveMatchupAnalysis(teamA.id, teamB.id, { ...result, result: 'pending' });
                setSavedToCloud(true);
            } catch (e: any) {
                console.error(e);
                toast.error("Não foi possível carregar a análise do confronto.");
            } finally {
                setLoading(false);
            }
        };
        fetchAnalysis();
    }, [teamA, teamB, playerStats, injuriesA, injuriesB, initialAnalysis]);

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
        getPlayerWeight
    };
};
