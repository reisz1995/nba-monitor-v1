
import React from 'react';
import { BrainCircuit, Database, Calendar, Plus, Download, Copy, Save, Zap } from 'lucide-react';
import { Team, PalpiteData } from '../../types';
import PredictionRow from './PredictionRow';

interface PredictionsSectionProps {
    tipsDate: string;
    setTipsDate: (date: string) => void;
    predictions: PalpiteData[];
    teams: Team[];
    isImporting: boolean;
    isExporting: boolean;
    isSavingPalpites: boolean;
    onImportIA: () => void;
    onExportPNG: () => void;
    onCopyText: () => void;
    onAddNewRow: () => void;
    onSavePalpites: () => void;
    onLocalPredictionChange: (id: number, field: keyof PalpiteData, value: string) => void;
    onRemoveRow: (id: number) => void;
    tableRef: React.RefObject<HTMLDivElement>;
}

const PredictionsSection: React.FC<PredictionsSectionProps> = ({
    tipsDate,
    setTipsDate,
    predictions,
    teams,
    isImporting,
    isExporting,
    isSavingPalpites,
    onImportIA,
    onExportPNG,
    onCopyText,
    onAddNewRow,
    onSavePalpites,
    onLocalPredictionChange,
    onRemoveRow,
    tableRef
}) => {
    return (
        <section className="space-y-8">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-6 border-b border-white/10 pb-6">
                    <div className="flex items-center gap-6">
                        <div className="bg-white p-3 shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                            <BrainCircuit className="w-8 h-8 text-nba-black" />
                        </div>
                        <div>
                            <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none font-oswald">
                                Predictor <span className="text-nba-text-secondary">Node</span>
                            </h3>
                            <div className="flex items-center gap-4 mt-3">
                                <p className="text-nba-text-secondary text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-2 font-oswald">
                                    <Database className="w-3 h-3" /> painel_palpites
                                </p>
                                <div className="bg-white/10 h-3 w-[1px]" />
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-3 h-3 text-nba-red" />
                                    <input
                                        type="text" value={tipsDate} onChange={(e) => setTipsDate(e.target.value)}
                                        placeholder="DD/MM/YYYY"
                                        className="bg-transparent border-0 focus:ring-0 text-nba-red font-bebas text-lg w-28 tracking-wider p-0 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        <button
                            onClick={onImportIA}
                            disabled={isImporting}
                            className="bg-nba-surface border border-nba-gold hover:bg-nba-gold hover:text-nba-black text-nba-gold text-[10px] font-black px-6 py-4 uppercase tracking-[0.2em] transition-all shadow-[0_0_10px_rgba(255,215,0,0.2)] hover:shadow-glow-gold flex items-center gap-2 disabled:opacity-50 font-oswald rounded-sm"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            IMPORT IA
                        </button>
                        <button
                            onClick={onExportPNG}
                            disabled={isExporting}
                            className="bg-nba-surface border border-white/20 hover:bg-white hover:text-nba-black text-white text-[10px] font-black px-6 py-4 uppercase tracking-[0.2em] transition-all flex items-center gap-3 disabled:opacity-50 font-oswald rounded-sm"
                        >
                            <Download className="w-3.5 h-3.5" />
                            EXPORT PNG
                        </button>
                        <button
                            onClick={onCopyText}
                            className="bg-nba-surface border border-nba-blue hover:bg-nba-blue hover:text-white text-nba-blue text-[10px] font-black px-6 py-4 uppercase tracking-[0.2em] transition-all flex items-center gap-3 font-oswald rounded-sm hover:shadow-glow-blue"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            COPIAR TEXTO
                        </button>
                        <button
                            onClick={onAddNewRow}
                            className="bg-nba-surface border border-white hover:bg-white hover:text-nba-black text-white text-[10px] font-black px-6 py-4 uppercase tracking-[0.2em] transition-all font-oswald rounded-sm"
                        >
                            + NEW NODE
                        </button>
                        <button
                            onClick={onSavePalpites}
                            disabled={isSavingPalpites}
                            className="btn-primary flex items-center gap-2 text-[10px] disabled:opacity-50"
                        >
                            {isSavingPalpites ? <Zap className="w-3.5 h-3.5 animate-pulse" /> : <Save className="w-3.5 h-3.5" />}
                            SYNC LOGS
                        </button>
                    </div>
                </div>
            </div>

            <div ref={tableRef} className="bg-nba-surface border border-white/5 overflow-x-auto shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-sm">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr className="bg-nba-surface-elevated text-[10px] font-black text-nba-text-secondary uppercase tracking-widest border-b border-white/5 font-oswald">
                            <th className="px-3 py-3 border-r border-white/5 w-[30%]">MATCHUP: HOME</th>
                            <th className="px-3 py-3 border-r border-white/5 w-[30%]">MATCHUP: AWAY</th>
                            <th className="px-3 py-3 border-r border-white/5 bg-nba-background/40 text-nba-success w-[50%]">CORE_PICK</th>
                            <th className="px-2 py-3 border-r border-white/5 text-center text-nba-gold w-[8%]">OVER_L</th>
                            <th className="px-2 py-3 border-r border-white/5 text-center text-nba-red w-[8%]">UNDER_L</th>
                            <th className="px-3 py-3 w-50 border-r border-white/5 text-center text-nba-gold font-black tracking-widest uppercase bg-nba-gold/5 shadow-[inset_0_0_15px_rgba(255,215,0,0.05)]">
                                <span className="flex items-center justify-center gap-2">
                                    <Zap className="w-3 h-3 animate-pulse" />
                                    HANDICAP_EDGE
                                </span>
                            </th>
                            <th className="px-3 py-3 border-r border-white/5 text-center text-nba-red w-[10%]">CONF_ID</th>
                            <th className="px-2 py-3 border-r border-white/5 text-center w-[5%]">N_C</th>
                            <th className="px-2 py-3 border-r border-white/5 text-center w-[5%]">N_F</th>
                            <th className="px-2 py-3 text-center w-[3%]">ACT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {predictions.length > 0 ? (
                            predictions.map((pred) => (
                                <PredictionRow
                                    key={pred.id}
                                    pred={pred}
                                    isExporting={isExporting}
                                    onLocalChange={onLocalPredictionChange}
                                    onRemove={onRemoveRow}
                                />
                            ))
                        ) : (
                            <tr>
                                <td colSpan={10} className="py-32 text-center bg-nba-surface">
                                    <div className="flex flex-col items-center gap-6">
                                        <Database className="w-12 h-12 text-white/20" />
                                        <span className="text-xs font-black text-nba-text-secondary uppercase tracking-[0.4em] italic font-oswald">No active nodes for {tipsDate}</span>
                                        <div className="flex gap-4">
                                            <button onClick={onImportIA} className="text-[10px] font-black text-nba-gold border border-nba-gold/30 px-8 py-3 uppercase tracking-widest hover:bg-nba-gold hover:text-nba-black transition-all font-oswald rounded-sm">RECOVER IA DATA</button>
                                            <button onClick={onAddNewRow} className="text-[10px] font-black text-white bg-nba-surface border border-white/20 px-8 py-3 uppercase tracking-widest hover:border-white hover:text-nba-black transition-all font-oswald rounded-sm">+ INITIALIZE NODE</button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                <datalist id="nba-teams">
                    {teams.map(t => <option key={t.id} value={t.name} />)}
                </datalist>
            </div>
        </section>
    );
};

export default PredictionsSection;
