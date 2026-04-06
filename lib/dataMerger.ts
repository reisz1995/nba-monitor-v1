import { Team, ESPNData, GameResult, DataballrInput } from './types';
import { getMomentumScore, parseStreakToRecord, normalizeTeamName } from './nbaUtils';

/**
 * Helper para verificar se dois nomes de times são correspondentes.
 */
export const isTeamMatch = (nameA: string, nameB: string): boolean => {
    const normA = normalizeTeamName(nameA);
    const normB = normalizeTeamName(nameB);
    if (!normA || !normB) return false;

    return normA === normB ||
        normA.startsWith(normB + ' ') ||
        normA.endsWith(' ' + normB) ||
        normB.startsWith(normA + ' ') ||
        normB.endsWith(' ' + normA);
};

/**
 * Mescla os dados brutos da ESPN com as métricas base.
 */
export const mergeESPNData = (rawEspn: any[], initialEspn: any[]): ESPNData[] => {
    const baseMap = new Map<string, Partial<ESPNData>>();

    initialEspn.forEach(d => {
        baseMap.set(normalizeTeamName(d.time), { ...d });
    });

    rawEspn.forEach((d: any) => {
        const name = d.time || d.nome || d.equipe || '';
        if (!name) return;

        const normName = normalizeTeamName(name);
        const targetKey = Array.from(baseMap.keys()).find(key => isTeamMatch(normName, key)) || normName;

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
        ultimos_5: String(d.ultimos_5 || ''),
        pace: d.pace ? Number(d.pace) : null
    } as ESPNData));
};

/**
 * Mescla todas as fontes de dados em uma lista unificada de times.
 */
export const mergeTeams = (
    initialTeams: Team[],
    dbTeams: Team[],
    espnData: ESPNData[],
    databallrFull: any[]
): Team[] => {
    return initialTeams.map(initial => {
        let dbTeam = dbTeams.find((t: Team) => t.id === initial.id);
        if (!dbTeam || (dbTeam.name && !isTeamMatch(dbTeam.name, initial.name))) {
            dbTeam = dbTeams.find((t: any) => t.name && isTeamMatch(t.name, initial.name));
        }

        const espnStats = espnData.find(e => e.time && isTeamMatch(e.time, initial.name));

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
            databallr: (() => {
                const s = databallrFull.find(stat => isTeamMatch(stat.team_name || stat.name || '', initial.name));
                if (!s) return undefined;
                return {
                    ortg: s.ortg,
                    drtg: s.drtg,
                    net_rating: s.net_rating,
                    pace: s.pace,
                    offense_rating: s.offense_rating,
                    defense_rating: s.defense_rating,
                    o_ts: s.o_ts,
                    o_tov: s.o_tov,
                    orb: s.orb,
                    drb: s.drb,
                    net_poss: s.net_poss
                };
            })(),
            stats: espnStats ? {
                media_pontos_ataque: espnStats.media_pontos_ataque,
                media_pontos_defesa: espnStats.media_pontos_defesa,
                aproveitamento: espnStats.aproveitamento,
                ultimos_5_espn: espnStats.ultimos_5
            } : undefined
        };
    });
};

/**
 * Ordena os times baseado em Momentum e Aproveitamento.
 */
export const sortTeams = (teams: Team[]): Team[] => {
    return [...teams].sort((a, b) => {
        const scoreA = getMomentumScore(a.record || []);
        const scoreB = getMomentumScore(b.record || []);
        if (scoreB !== scoreA) return scoreB - scoreA;
        if ((b.wins ?? 0) !== (a.wins ?? 0)) return (b.wins ?? 0) - (a.wins ?? 0);
        return (b.stats?.aproveitamento || 0) - (a.stats?.aproveitamento || 0);
    });
};
