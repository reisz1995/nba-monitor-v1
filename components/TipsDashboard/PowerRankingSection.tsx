
import React, { useMemo } from 'react';
import { Trophy, Database, Save, Zap } from 'lucide-react';
import { Team } from '../../types';

interface PowerRankingSectionProps {
    teams: Team[];
    tierScores: Record<string, string>;
    isSavingNotas: boolean;
    onSaveNotas: () => void;
    onScoreChange: (franquia: string, nota: string) => void;
}

const PowerRankingSection: React.FC<PowerRankingSectionProps> = ({
    teams,
    tierScores,
    isSavingNotas,
    onSaveNotas,
    onScoreChange,
}) => {
    const getTeamLogo = (name: string) => {
        const team = teams.find(t => t.name === name);
        return team?.logo || 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nba.png';
    };

    const categorizedNotes = useMemo(() => {
        const tierData = teams.map(t => ({
            name: t.name,
            score: tierScores[t.name] || '-'
        })).sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0));

        return {
            TOP: tierData.filter(t => (parseFloat(t.score) || 0) >= 4.5),
            BOM: tierData.filter(t => (parseFloat(t.score) || 0) >= 4.0 && (parseFloat(t.score) || 0) < 4.5),
            REGULAR: tierData.filter(t => (parseFloat(t.score) || 0) >= 3.0 && (parseFloat(t.score) || 0) < 4.0),
            RUINS: tierData.filter(t => (parseFloat(t.score) || 0) < 3.0)
        };
    }, [teams, tierScores]);

    const renderTierRows = (items: { name: string, score: string }[], label: string) => {
        if (items.length === 0) return null;
        return (
            <>
                <tr>
                    <td colSpan={2} className="py-3 px-8 text-left text-slate-500 font-mono text-[9px] uppercase tracking-[0.4em] bg-white/5 border-y border-white/5 backdrop-blur-sm">
                        {label}
                    </td>
                </tr>
                {items.map((item) => (
                    <tr key={item.name} className="border-b border-white/5 hover:bg-white/[0.03] transition-all group font-mono">
                        <td className="px-6 py-3 flex items-center gap-4">
                            <div className="w-10 h-10 bg-black border-2 border-white/10 rounded-sm flex items-center justify-center p-1.5 group-hover:border-indigo-500/30 transition-colors shadow-[4px_4px_0px_#000]">
                                <img src={getTeamLogo(item.name)} className="w-full h-full object-contain grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]" alt="" />
                            </div>
                            <span className="text-white font-black text-sm uppercase tracking-tighter">{item.name}</span>
                        </td>
                        <td className="px-6 py-2 text-center">
                            <input
                                type="text"
                                value={item.score}
                                onChange={(e) => onScoreChange(item.name, e.target.value)}
                                className="bg-black text-indigo-400 font-black text-center text-lg w-24 px-3 py-1.5 border-2 border-white/10 focus:border-indigo-500 rounded-none outline-none transition-all shadow-[6px_6px_0px_#000] focus:shadow-[4px_4px_0px_#000] italic"
                                placeholder="-"
                            />
                        </td>
                    </tr>
                ))}
            </>
        );
    };

    return (
        <section className="space-y-12 animate-in fade-in duration-1000">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-8 border-b-2 border-white/10 pb-8">
                    <div className="flex items-center gap-6">
                        <div className="bg-white p-4 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] rounded-sm">
                            <Trophy className="w-10 h-10 text-black" />
                        </div>
                        <div>
                            <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">
                                POWER <span className="text-indigo-500 underline decoration-indigo-500/30 underline-offset-8">RANKING</span>
                            </h3>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em] mt-4 flex items-center gap-2 font-mono">
                                <Database className="w-3 h-3 text-indigo-500" /> SOURCE_NODE: tabela_notas_io
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onSaveNotas}
                        disabled={isSavingNotas}
                        className="bg-white hover:bg-indigo-600 text-black hover:text-white text-[10px] font-black px-10 py-5 rounded-full uppercase tracking-[0.2em] transition-all cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95 disabled:opacity-50 font-mono"
                    >
                        {isSavingNotas ? <Zap className="w-4 h-4 animate-pulse inline mr-2" /> : <Save className="w-4 h-4 inline mr-2" />}
                        {isSavingNotas ? 'SYNCING_NODES...' : 'SAVE_QUANTUM_RATING'}
                    </button>
                </div>
            </div>

            <div className="bg-black/40 backdrop-blur-xl border-2 border-white/10 overflow-hidden shadow-[24px_24px_0px_#000] relative max-w-5xl mx-auto rounded-xl glass-morphism">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] -z-10 animate-pulse" />
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-black/60 backdrop-blur-md text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] border-b border-white/10 font-mono">
                            <th className="px-8 py-4">FRANCHISE_IDENTIFIER / HQ</th>
                            <th className="px-8 py-4 text-center w-48">AI_RATING_HEX</th>
                        </tr>
                    </thead>
                    <tbody>
                        {renderTierRows(categorizedNotes.TOP, 'CLUSTER_01: ELITE_ASCENDANT (4.5+)')}
                        {renderTierRows(categorizedNotes.BOM, 'CLUSTER_02: PRIME_COMPETITORS (4.0 - 4.4)')}
                        {renderTierRows(categorizedNotes.REGULAR, 'CLUSTER_03: MID_STABLE (3.0 - 3.9)')}
                        {renderTierRows(categorizedNotes.RUINS, 'CLUSTER_04: SYSTEM_REBUILD (< 3.0)')}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default PowerRankingSection;
