import React, { useMemo, useEffect, useState } from 'react';
import { TrendingUp, Target, Activity, Zap, Info, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Team, PalpiteData } from '../../types';
import { calculateDeterministicPace, findTeamByName, calculateUnderdogValue } from '../../lib/nbaUtils';
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
}

const MarketProjectionSection: React.FC<MarketProjectionSectionProps> = ({ predictions, teams }) => {
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

    const projections = useMemo(() => {
        return predictions
            .map(p => {
                const teamCasa = findTeamByName(p.time_casa, teams);
                const teamFora = findTeamByName(p.time_fora, teams);

                if (!teamCasa || !teamFora) return null;

                const isB2BHome = p.n_casa?.includes('B2B') || false; // Mock or extracted from string if available
                const isB2BAway = p.n_fora?.includes('B2B') || false;

                const analysis = calculateDeterministicPace(teamCasa, teamFora, {
                    isHomeA: true,
                    isB2BA: isB2BHome,
                    isB2BB: isB2BAway
                });

                const fairHandicapNum = Number((analysis.deltaB - analysis.deltaA).toFixed(1));
                const fairHandicapLabel = fairHandicapNum > 0 ? `+${fairHandicapNum}` : fairHandicapNum.toString();

                const matchup = `${teamFora.name} @ ${teamCasa.name}`;
                const market = marketOdds[matchup];

                // Edge calculation
                const marketSpread = market?.spread !== undefined && market?.spread !== null ? market.spread : null;
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
                    marketTotal: market?.total,
                    spreadEdge,
                    totalEdge,
                    underdogValue,
                    isB2BHome,
                    isB2BAway
                };
            })
            .filter(Boolean);
    }, [predictions, teams, marketOdds]);

    if (projections.length === 0) return null;

    return (
        <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-6 border-b-4 border-indigo-500/30 pb-6">
                    <div className="flex items-center gap-6">
                        <div className="bg-indigo-600 p-3 shadow-[4px_4px_0px_0px_rgba(99,102,241,0.2)]">
                            <TrendingUp className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">
                                Market <span className="text-indigo-400">Projection</span>
                            </h3>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
                                <Activity className="w-3 h-3" /> algorithmic_fair_lines_v2.0
                            </p>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center gap-8 px-8 py-4 bg-slate-900/50 border-2 border-slate-800 rounded-sm">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Global Pace</span>
                            <span className="text-xl font-mono font-black text-white">
                                {(projections.reduce((acc, curr) => acc + Number(curr!.pace), 0) / projections.length).toFixed(1)}
                            </span>
                        </div>
                        <div className="w-[1px] h-8 bg-slate-800" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Matrix Load</span>
                            <span className="text-xl font-mono font-black text-emerald-500">OPTIMIZED</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {projections.map((proj) => (
                    <div key={proj!.id} className="group relative bg-slate-950 border-2 border-slate-800 p-6 shadow-[15px_15px_0px_0px_rgba(0,0,0,0.3)] hover:border-indigo-500/50 transition-all">
                        {/* Kinetic State Badge */}
                        <div className={`absolute top-0 right-0 px-4 py-1 text-[9px] font-black uppercase tracking-widest border-l-2 border-b-2 ${proj!.state === 'HYPER_KINETIC'
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                            : 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30'
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

                            <div className="flex flex-col items-center">
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em]">VS</span>
                                <div className="h-8 w-px bg-slate-800 my-1" />
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
                            <div className="mb-4 bg-indigo-500/10 border border-indigo-500/30 p-2 flex items-center gap-3">
                                <Zap className="w-4 h-4 text-indigo-400" />
                                <div className="flex flex-wrap gap-2">
                                    {proj!.underdogValue.rules.map((rule: string) => (
                                        <span key={rule} className="text-[8px] font-black text-indigo-300 uppercase tracking-tighter bg-indigo-500/20 px-1.5 py-0.5 rounded-sm">
                                            {rule}
                                        </span>
                                    ))}
                                </div>
                                <span className="ml-auto text-[10px] font-black text-indigo-400">VALUE DETECTED</span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900/50 p-4 border border-slate-800 rounded-sm relative overflow-hidden group/item">
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap className="w-3 h-3 text-amber-500" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Handicap Analysis</span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-600 uppercase">Fair</span>
                                        <span className="text-xl font-mono font-black text-white tracking-tighter">{proj!.handicap}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[8px] font-black text-slate-600 uppercase">Market</span>
                                        <span className="text-xl font-mono font-black text-indigo-400 tracking-tighter">
                                            {proj!.marketSpread !== undefined ? (proj!.marketSpread! > 0 ? `+${proj!.marketSpread}` : proj!.marketSpread) : '--'}
                                        </span>
                                    </div>
                                </div>
                                {proj!.spreadEdge && (
                                    <div className={`mt-2 flex items-center gap-1 text-[10px] font-black ${Number(proj!.spreadEdge) > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {Number(proj!.spreadEdge) > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                        EDGE: {Math.abs(Number(proj!.spreadEdge))} PTS
                                    </div>
                                )}
                            </div>

                            <div className="bg-slate-900/50 p-4 border border-slate-800 rounded-sm relative overflow-hidden group/item">
                                <div className="flex items-center gap-2 mb-2">
                                    <Target className="w-3 h-3 text-indigo-500" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">O/U Analysis</span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-600 uppercase">Fair</span>
                                        <span className="text-xl font-mono font-black text-white tracking-tighter">{proj!.total}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[8px] font-black text-slate-600 uppercase">Market</span>
                                        <span className="text-xl font-mono font-black text-indigo-400 tracking-tighter">
                                            {proj!.marketTotal || '--'}
                                        </span>
                                    </div>
                                </div>
                                {proj!.totalEdge && (
                                    <div className={`mt-2 flex items-center gap-1 text-[10px] font-black ${Number(proj!.totalEdge) > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {Number(proj!.totalEdge) > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                        EDGE: {Math.abs(Number(proj!.totalEdge))} PTS
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4">
                            <div className="bg-slate-900/30 p-2 border border-slate-800/50 rounded-sm flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-3 h-3 text-slate-600" />
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Pace</span>
                                </div>
                                <span className="text-xs font-mono font-black text-slate-400">{proj!.pace}</span>
                            </div>
                            <div className="bg-slate-900/30 p-2 border border-slate-800/50 rounded-sm flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-3 h-3 text-slate-600" />
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Matrix</span>
                                </div>
                                <span className="text-xs font-mono font-black text-slate-400">{proj!.state}</span>
                            </div>
                        </div>

                        <div className="mt-6 flex items-center justify-between px-2 pt-4 border-t border-slate-800/50">
                            <div className="flex items-center gap-2">
                                <Info className="w-3 h-3 text-slate-600" />
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none">
                                    Projeção: {proj!.projHome} - {proj!.projAway}
                                </span>
                            </div>
                            <div className="text-[9px] font-black text-indigo-500/50 uppercase tracking-widest">
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
