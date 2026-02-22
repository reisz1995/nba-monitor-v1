
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
                <tr className="bg-slate-900/80">
                    <td colSpan={2} className="py-2 px-8 text-left text-slate-500 font-mono text-[10px] uppercase tracking-[0.3em] bg-slate-950/50 border-y border-slate-800/50">
                        {label}
                    </td>
                </tr>
                {items.map((item) => (
                    <tr key={item.name} className="border-b border-slate-800/40 hover:bg-red-600/[0.03] transition-all group">
                        <td className="px-6 py-2 flex items-center gap-4">
                            <div className="w-8 h-8 bg-slate-900 border border-slate-800 rounded flex items-center justify-center p-1 group-hover:border-red-600/30 transition-colors">
                                <img src={getTeamLogo(item.name)} className="w-full h-full object-contain grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all" alt="" />
                            </div>
                            <span className="text-slate-100 font-mono font-bold text-xs uppercase tracking-tight">{item.name}</span>
                        </td>
                        <td className="px-6 py-1.5 text-center">
                            <input
                                type="text"
                                value={item.score}
                                onChange={(e) => onScoreChange(item.name, e.target.value)}
                                className="bg-slate-950 text-red-500 font-mono font-black text-center text-base w-20 px-2 py-1 border-2 border-slate-800 focus:border-red-600 rounded-none outline-none transition-all shadow-[2px_2px_0px_0px_rgba(220,38,38,0.1)] focus:shadow-[2px_2px_0px_0px_rgba(220,38,38,0.3)]"
                                placeholder="-"
                            />
                        </td>
                    </tr>
                ))}
            </>
        );
    };

    return (
        <section className="space-y-8">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-6 border-b-4 border-red-600 pb-6">
                    <div className="flex items-center gap-6">
                        <div className="bg-red-600 p-3 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
                            <Trophy className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">
                                Power <span className="text-red-600 underline decoration-white/20 underline-offset-8">Ranking</span>
                            </h3>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
                                <Database className="w-3 h-3" /> DATABASE: tabela_notas
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onSaveNotas}
                        disabled={isSavingNotas}
                        className="bg-slate-900 border-2 border-red-600 hover:bg-red-600 text-white text-xs font-black px-8 py-4 uppercase tracking-widest transition-all active:translate-x-1 active:translate-y-1 shadow-[6px_6px_0px_0px_rgba(220,38,38,0.2)] hover:shadow-none flex items-center gap-3 disabled:opacity-50"
                    >
                        {isSavingNotas ? <Zap className="w-4 h-4 animate-pulse" /> : <Save className="w-4 h-4" />}
                        {isSavingNotas ? 'Sincronizando...' : 'SYNC POWER NODES'}
                    </button>
                </div>
            </div>

            <div className="bg-slate-950 border-2 border-slate-800 overflow-hidden shadow-[20px_20px_0px_0px_rgba(0,0,0,0.5)] relative max-w-4xl mx-auto">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-3xl -z-10 animate-pulse" />
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b-2 border-slate-800">
                            <th className="px-6 py-3">Franquia / Organization</th>
                            <th className="px-6 py-3 text-center w-40">AI Rating</th>
                        </tr>
                    </thead>
                    <tbody>
                        {renderTierRows(categorizedNotes.TOP, 'LEVEL 01: ELITE (4.5+)')}
                        {renderTierRows(categorizedNotes.BOM, 'LEVEL 02: COMPETITORS (4.0 - 4.4)')}
                        {renderTierRows(categorizedNotes.REGULAR, 'LEVEL 03: MID-TIER (3.0 - 3.9)')}
                        {renderTierRows(categorizedNotes.RUINS, 'LEVEL 04: REBUILDING (< 3.0)')}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default PowerRankingSection;
