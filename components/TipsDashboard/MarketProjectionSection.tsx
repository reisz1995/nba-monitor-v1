import React, { useMemo, useEffect, useState } from 'react';
import { TrendingUp, Target, Activity, Zap, Info, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Team, PalpiteData } from '../../types';
import { calculateProjectedScores, findTeamByName, calculateUnderdogValue, getStandardTeamName } from '../../lib/nbaUtils';
import { supabase } from '../../lib/supabase';

interface MarketOdds {
    matchup: string;
    spread: number | null;
    total: number | null;
    moneyline_home: number | null;
    moneyline_away: number | null;
}

interface MarketProjectionSectionProps {
    predictions: PalpiteData[];
    teams: Team[];
    tierScores: Record<string, string>;
}

const MarketProjectionSection: React.FC<MarketProjectionSectionProps> = ({ predictions, teams, tierScores }) => {
    const [marketOdds, setMarketOdds] = useState<Record<string, MarketOdds>>({});

    useEffect(() => {
        const fetchMarketOdds = async () => {
            const { data, error } = await supabase
                .from('nba_odds_matrix')
                .select('*');

            if (error) {
                console.error('Error fetching market odds:', error);
                return;
            }

            if (data) {
                const oddsMap = data.reduce((acc: any, curr: MarketOdds) => {
                    acc[curr.matchup] = curr;
                    return acc;
                }, {});
                setMarketOdds(oddsMap);
            }
        };

        fetchMarketOdds();
    }, []);

    const [allInjuries, setAllInjuries] = useState<any[]>([]);
    const [allStats, setAllStats] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const { data: injData } = await supabase.from('nba_injured_players').select('*');
            const { data: statsData } = await supabase.from('nba_jogadores_stats').select('*');

            if (injData) setAllInjuries(injData);
            if (statsData) setAllStats(statsData);
        };
        fetchData();
    }, []);

    const projections = useMemo(() => {
        const getPlayerWeight = (pts: number) => Math.floor((pts || 0) / 3);
        const mapInjToHW = (teamName: string) => {
            const teamStats = allStats.filter(s => (s.time || s.team_name || '').toLowerCase().includes(teamName.toLowerCase()));
            return teamStats.map(s => {
                const inj = allInjuries.find(i => (i.player_name || i.nome || '').toLowerCase() === (s.player_name || s.nome || '').toLowerCase());
                return {
                    nome: s.player_name || s.nome || '',
                    isOut: !!(inj?.injury_status || inj?.gravidade || '').toUpperCase().includes('OUT'),
                    weight: getPlayerWeight(s.pontos || s.pts || 0)
                };
            });
        };

        const sanityCheckMarketSpread = (marketValue: number | null, fairValue: number) => {
            if (marketValue === null) return null;
            const currentDiff = Math.abs(marketValue - fairValue);
            const flipped = -marketValue;
            const flippedDiff = Math.abs(flipped - fairValue);
            if (currentDiff > 8 && flippedDiff < currentDiff) {
                return flipped;
            }
            return marketValue;
        };

        return predictions
            .map(p => {
                const teamCasa = findTeamByName(p.time_casa, teams);
                const teamFora = findTeamByName(p.time_fora, teams);

                if (!teamCasa || !teamFora) return null;

                const isB2BHome = p.n_casa?.includes('B2B') || false;
                const isB2BAway = p.n_fora?.includes('B2B') || false;

                const injuriesA = mapInjToHW(teamCasa.name);
                const injuriesB = mapInjToHW(teamFora.name);

                const databallrA = teamCasa.databallr;
                const databallrB = teamFora.databallr;

                const notaCasa = tierScores[teamCasa.name] || '-';
                const notaFora = tierScores[teamFora.name] || '-';

                const analysis = calculateProjectedScores(teamCasa, teamFora, {
                    isHomeA: true,
                    isB2BA: isB2BHome,
                    isB2BB: isB2BAway,
                    injuriesA,
                    injuriesB,
                    powerA: Number(notaCasa) || 0,
                    powerB: Number(notaFora) || 0
                }, databallrA, databallrB);

                const fairHandicapNum = Number((analysis.deltaB - analysis.deltaA).toFixed(1));
                const fairHandicapLabel = fairHandicapNum > 0 ? `+${fairHandicapNum}` : fairHandicapNum.toString();

                const matchup = `${getStandardTeamName(teamFora.name)} @ ${getStandardTeamName(teamCasa.name)}`;
                const market = marketOdds[matchup];

                // Sanity Check & Edge calculation
                const rawMarketSpread = market?.spread !== undefined && market?.spread !== null ? market.spread : null;
                const marketSpread = sanityCheckMarketSpread(rawMarketSpread, fairHandicapNum);

                const spreadEdge = marketSpread !== null ? (marketSpread - fairHandicapNum).toFixed(1) : null;
                const totalEdge = market?.total !== undefined && market?.total !== null ? (analysis.totalPayload - market.total).toFixed(1) : null;

                const underdogValue = calculateUnderdogValue(teamCasa, teamFora, analysis, marketSpread);

                return {
                    id: p.id,
                    matchup,
                    home: teamCasa.name,
                    away: teamFora.name,
                    homeLogo: teamCasa.logo,
                    awayLogo: teamFora.logo,
                    pace: analysis.matchPace.toFixed(1),
                    total: analysis.totalPayload.toFixed(1),
                    handicap: fairHandicapLabel,
                    state: analysis.kineticState,
                    projHome: analysis.deltaA.toFixed(1),
                    projAway: analysis.deltaB.toFixed(1),
                    marketSpread,
                    isFlipped: rawMarketSpread !== marketSpread,
                    marketTotal: market?.total,
                    spreadEdge,
                    totalEdge,
                    underdogValue,
                    isB2BHome,
                    isB2BAway
                };
            })
            .filter(Boolean);
    }, [predictions, teams, marketOdds, tierScores, allInjuries, allStats]);

    if (projections.length === 0) return null;

    return (
        <section aria-label="market-projection" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-6 border-b border-nba-blue/30 pb-6">
                    <div className="flex items-center gap-6">
                        <div className="bg-nba-blue p-3 shadow-glow-blue">
                            <TrendingUp className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none font-oswald">
                                Market <span className="text-nba-blue">Projection</span>
                            </h3>
                            <p className="text-nba-text-secondary text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-oswald">
                                <Activity className="w-3 h-3" /> algorithmic_fair_lines_v2.0
                            </p>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center gap-8 px-8 py-4 bg-nba-surface-elevated border border-white/5 rounded-sm">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-oswald">Global Pace</span>
                            <span className="text-xl font-bebas text-white">
                                {(projections.reduce((acc, curr) => acc + Number(curr!.pace), 0) / projections.length).toFixed(1)}
                            </span>
                        </div>
                        <div className="w-[1px] h-8 bg-white/10" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-oswald">Matrix Load</span>
                            <span className="text-xl font-bebas text-nba-success">OPTIMIZED</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {projections.map((proj) => (
                    <div key={proj!.id} className="tip-card-featured p-6 group">
                        {/* Kinetic State Badge */}
                        <div className={`absolute top-0 right-0 px-4 py-1 text-[9px] font-black uppercase tracking-widest border-l border-b ${proj!.state === 'HYPER_KINETIC'
                            ? 'bg-nba-red/10 text-nba-red border-nba-red/30'
                            : 'bg-nba-blue/10 text-nba-blue border-nba-blue/30'
                            }`}>
                            {proj!.state}
                        </div>

                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4 group-hover:translate-x-2 transition-transform">
                                <div className="relative">
                                    <img src={proj!.homeLogo} alt="" className="w-12 h-12 object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]" />
                                    {proj!.isB2BHome && (
                                        <span className="absolute -top-1 -left-1 bg-amber-500 text-black text-[7px] font-black px-1 py-0.5 shadow-[2px_2px_0px_#000]">B2B</span>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Home</span>
                                    <span className="text-lg font-black text-white uppercase italic">{proj!.home}</span>
                                </div>
                            </div>

                            <div className="flex flex-col items-center justify-center w-16">
                                <div className="vs-divider">VS</div>
                                <div className="mt-2 flex flex-col items-center gap-1">
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm ${proj!.underdogValue?.levels?.home?.level === '01' ? 'bg-nba-red text-white' : 'bg-white/10 text-slate-400'}`}>
                                        {proj!.underdogValue?.levels?.home?.type}
                                    </span>
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm ${proj!.underdogValue?.levels?.away?.level === '01' ? 'bg-nba-red text-white' : 'bg-white/10 text-slate-400'}`}>
                                        {proj!.underdogValue?.levels?.away?.type}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 text-right group-hover:-translate-x-2 transition-transform">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Away</span>
                                    <span className="text-lg font-black text-white uppercase italic">{proj!.away}</span>
                                </div>
                                <div className="relative">
                                    <img src={proj!.awayLogo} alt="" className="w-12 h-12 object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]" />
                                    {proj!.isB2BAway && (
                                        <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[7px] font-black px-1 py-0.5 shadow-[2px_2px_0px_#000]">B2B</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {proj!.underdogValue?.hasValue && (
                            <div className="mb-4 bg-nba-gold/10 border border-nba-gold/30 p-2 flex items-center gap-3">
                                <Zap className="w-4 h-4 text-nba-gold" />
                                <div className="flex flex-wrap gap-2">
                                    {proj!.underdogValue.rules.map((rule: string) => (
                                        <span key={rule} className="text-[8px] font-black text-nba-gold/80 uppercase tracking-tighter bg-nba-gold/20 px-1.5 py-0.5 rounded-sm">
                                            {rule}
                                        </span>
                                    ))}
                                </div>
                                <div className="ml-auto flex items-center gap-4">
                                    {proj!.underdogValue.kelly && (
                                        <div className="flex flex-col items-end">
                                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Kelly 1/4</span>
                                            <span className="text-sm font-bebas text-nba-gold">
                                                {(proj!.underdogValue.kelly.quarter * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    )}
                                    <span className="text-[10px] font-black text-nba-gold">VALUE DETECTED</span>
                                </div>
                            </div>
                        )}

                        {proj!.isFlipped && (
                            <div className="mb-4 bg-nba-red/10 border border-nba-red/30 p-2 flex items-center gap-3">
                                <Info className="w-4 h-4 text-nba-red" />
                                <span className="text-[10px] font-black text-nba-red uppercase tracking-widest text-center flex-1">
                                    AVISO: INVERSÃO DE SINAL NO MERCADO DETECTADA E CORRIGIDA (SANITY_CHECK_v2.0)
                                </span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-nba-surface p-4 border border-white/5 rounded-sm relative overflow-hidden group/item">
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap className="w-3 h-3 text-nba-gold" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-oswald">Handicap Analysis</span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-500 uppercase font-inter">Fair</span>
                                        <span className="text-xl font-bebas text-white tracking-tighter">{proj!.handicap}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[8px] font-black text-slate-500 uppercase font-inter">Market</span>
                                        <span className="odds-display text-xl tracking-tighter text-nba-blue shadow-none" style={{ textShadow: 'none' }}>
                                            {proj!.marketSpread !== undefined && proj!.marketSpread !== null ? (proj!.marketSpread! > 0 ? `+${proj!.marketSpread}` : proj!.marketSpread) : '--'}
                                        </span>
                                    </div>
                                </div>
                                {proj!.spreadEdge && (
                                    <div className="flex items-center justify-between mt-2">
                                        <div className={`${Number(proj!.spreadEdge) > 0 ? 'trend-up' : 'trend-down'} text-[12px] flex items-center gap-1`}>
                                            {Number(proj!.spreadEdge) > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                            EDGE: {Math.abs(Number(proj!.spreadEdge))} PTS
                                        </div>
                                        {proj!.underdogValue?.kelly && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[7px] font-black text-slate-500 uppercase">FULL KELLY: {(proj!.underdogValue.kelly.full * 100).toFixed(1)}%</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="bg-nba-surface p-4 border border-white/5 rounded-sm relative overflow-hidden group/item">
                                <div className="flex items-center gap-2 mb-2">
                                    <Target className="w-3 h-3 text-nba-blue" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-oswald">O/U Analysis</span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-500 uppercase font-inter">Fair</span>
                                        <span className="text-xl font-bebas text-white tracking-tighter">{proj!.total}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[8px] font-black text-slate-500 uppercase font-inter">Market</span>
                                        <span className="odds-display text-xl tracking-tighter text-nba-blue shadow-none" style={{ textShadow: 'none' }}>
                                            {proj!.marketTotal || '--'}
                                        </span>
                                    </div>
                                </div>
                                {proj!.totalEdge && (
                                    <div className={`mt-2 ${Number(proj!.totalEdge) > 0 ? 'trend-up' : 'trend-down'} text-[12px]`}>
                                        {Number(proj!.totalEdge) > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                        EDGE: {Math.abs(Number(proj!.totalEdge))} PTS
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4">
                            <div className="bg-nba-surface-elevated p-2 border border-white/5 rounded-sm flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-3 h-3 text-nba-text-secondary" />
                                    <span className="text-[8px] font-black text-nba-text-secondary uppercase tracking-widest font-oswald">Pace</span>
                                </div>
                                <span className="text-sm font-bebas text-slate-300">{proj!.pace}</span>
                            </div>
                            <div className="bg-nba-surface-elevated p-2 border border-white/5 rounded-sm flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-3 h-3 text-nba-text-secondary" />
                                    <span className="text-[8px] font-black text-nba-text-secondary uppercase tracking-widest font-oswald">Matrix</span>
                                </div>
                                <span className="text-xs font-oswald font-black text-slate-300">{proj!.state}</span>
                            </div>
                        </div>

                        <div className="mt-6 flex items-center justify-between px-2 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-2">
                                <Info className="w-3 h-3 text-nba-text-secondary" />
                                <span className="text-[9px] font-black text-nba-text-secondary uppercase tracking-widest leading-none font-oswald">
                                    Projeção: {proj!.projHome} - {proj!.projAway}
                                </span>
                            </div>
                            <div className="text-[9px] font-black text-nba-blue/50 uppercase tracking-widest font-oswald">
                                Deterministic Engine v2.0
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default MarketProjectionSection;
