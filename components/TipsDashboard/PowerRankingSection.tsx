
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
                <tr className="bg-nba-surface-elevated">
                    <td colSpan={2} className="py-2 px-8 text-left text-nba-text-secondary font-oswald text-[10px] uppercase tracking-[0.3em] border-y border-white/5">
                        {label}
                    </td>
                </tr>
                {items.map((item) => (
                    <tr key={item.name} className="border-b border-white/5 hover:bg-nba-red/[0.05] transition-all group">
                        <td className="px-6 py-2 flex items-center gap-4">
                            <div className="w-8 h-8 bg-nba-background border border-white/5 rounded-sm flex items-center justify-center p-1 group-hover:border-nba-red/30 transition-colors">
                                <img src={getTeamLogo(item.name)} className="w-full h-full object-contain grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all" alt="" />
                            </div>
                            <span className="text-white font-oswald font-bold text-xs uppercase tracking-widest">{item.name}</span>
                        </td>
                        <td className="px-6 py-1.5 text-center">
                            <input
                                type="text"
                                value={item.score}
                                onChange={(e) => onScoreChange(item.name, e.target.value)}
                                className="bg-nba-background text-nba-red font-bebas text-center text-xl w-20 px-2 py-1 border border-white/5 focus:border-nba-red rounded-sm outline-none transition-all focus:shadow-glow-red"
                                placeholder="-"
                            />
                        </td>
                    </tr>
                ))}
            </>
        );
    };

    return (
        <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-6 border-b border-nba-red/30 pb-6">
                    <div className="flex items-center gap-6">
                        <div className="bg-nba-red p-3 shadow-glow-red">
                            <Trophy className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none font-oswald">
                                Power <span className="text-nba-red underline decoration-white/20 underline-offset-8">Ranking</span>
                            </h3>
                            <p className="text-nba-text-secondary text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2 font-oswald">
                                <Database className="w-3 h-3" /> DATABASE: tabela_notas
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onSaveNotas}
                        disabled={isSavingNotas}
                        className="bg-nba-red text-white text-xs font-black px-8 py-4 uppercase tracking-widest transition-all font-oswald shadow-glow-red hover:shadow-[0_0_25px_rgba(200,16,46,0.8)] flex items-center gap-3 disabled:opacity-50 rounded-sm"
                    >
                        {isSavingNotas ? <Zap className="w-4 h-4 animate-pulse" /> : <Save className="w-4 h-4" />}
                        {isSavingNotas ? 'Sincronizando...' : 'SYNC POWER NODES'}
                    </button>
                </div>
            </div>

            <div className="bg-nba-surface border border-white/5 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.8)] relative max-w-4xl mx-auto rounded-sm">
                <div className="absolute top-0 right-0 w-32 h-32 bg-nba-red/5 blur-3xl -z-10 animate-pulse" />
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-nba-surface-elevated text-[11px] font-black text-nba-text-secondary uppercase tracking-[0.2em] border-b border-white/5 font-oswald">
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
