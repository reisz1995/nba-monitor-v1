
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
                <div className="flex items-center justify-between flex-wrap gap-6 border-b-4 border-slate-100 pb-6">
                    <div className="flex items-center gap-6">
                        <div className="bg-white p-3 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
                            <BrainCircuit className="w-8 h-8 text-slate-950" />
                        </div>
                        <div>
                            <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">
                                Predictor <span className="text-slate-500">Node</span>
                            </h3>
                            <div className="flex items-center gap-4 mt-3">
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-2">
                                    <Database className="w-3 h-3" /> painel_palpites
                                </p>
                                <div className="bg-slate-800 h-3 w-[1px]" />
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-3 h-3 text-red-500" />
                                    <input
                                        type="text" value={tipsDate} onChange={(e) => setTipsDate(e.target.value)}
                                        placeholder="DD/MM/YYYY"
                                        className="bg-transparent border-0 focus:ring-0 text-red-500 font-mono font-bold text-[11px] w-28 tracking-wider p-0"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        <button
                            onClick={onImportIA}
                            disabled={isImporting}
                            className="bg-slate-900 border-2 border-amber-600 hover:bg-amber-600 text-white text-[10px] font-black px-6 py-4 uppercase tracking-[0.2em] transition-all shadow-[4px_4px_0px_0px_rgba(217,119,6,0.2)] hover:shadow-none flex items-center gap-2 disabled:opacity-50"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            IMPORT IA
                        </button>
                        <button
                            onClick={onExportPNG}
                            disabled={isExporting}
                            className="bg-slate-900 border-2 border-slate-600 hover:bg-slate-600 text-white text-[10px] font-black px-6 py-4 uppercase tracking-[0.2em] transition-all shadow-[4px_4px_0px_0px_rgba(71,85,105,0.2)] hover:shadow-none flex items-center gap-3 disabled:opacity-50"
                        >
                            <Download className="w-3.5 h-3.5" />
                            EXPORT PNG
                        </button>
                        <button
                            onClick={onCopyText}
                            className="bg-slate-900 border-2 border-emerald-600 hover:bg-emerald-600 text-white text-[10px] font-black px-6 py-4 uppercase tracking-[0.2em] transition-all shadow-[4px_4px_0px_0px_rgba(5,150,105,0.2)] hover:shadow-none flex items-center gap-3"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            COPIAR TEXTO
                        </button>
                        <button
                            onClick={onAddNewRow}
                            className="bg-slate-900 border-2 border-slate-200 hover:bg-white hover:text-slate-950 text-white text-[10px] font-black px-6 py-4 uppercase tracking-[0.2em] transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] hover:shadow-none"
                        >
                            + NEW NODE
                        </button>
                        <button
                            onClick={onSavePalpites}
                            disabled={isSavingPalpites}
                            className="bg-indigo-600 border-2 border-indigo-400 hover:bg-indigo-500 text-white text-[10px] font-black px-8 py-4 uppercase tracking-[0.2em] shadow-[6px_6px_0px_0px_rgba(99,102,241,0.2)] hover:shadow-none transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSavingPalpites ? <Zap className="w-3.5 h-3.5 animate-pulse" /> : <Save className="w-3.5 h-3.5" />}
                            SYNC LOGS
                        </button>
                    </div>
                </div>
            </div>

            <div ref={tableRef} className="bg-slate-950 border-2 border-slate-800 overflow-x-auto shadow-[30px_30px_0px_0px_rgba(0,0,0,0.4)]">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr className="bg-slate-900 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-800">
                            <th className="px-3 py-3 border-r border-slate-800/50 w-[18%]">MATCHUP: HOME</th>
                            <th className="px-3 py-3 border-r border-slate-800/50 w-[18%]">MATCHUP: AWAY</th>
                            <th className="px-3 py-3 border-r border-slate-800/50 bg-slate-950/40 text-emerald-500/80 w-[15%]">CORE_PICK</th>
                            <th className="px-2 py-3 border-r border-slate-800/50 text-center text-amber-500/80 w-[8%]">OVER_L</th>
                            <th className="px-2 py-3 border-r border-slate-800/50 text-center text-rose-500/80 w-[8%]">UNDER_L</th>
                            <th className="px-2 py-3 border-r border-slate-800/50 text-center w-[10%]">T_POINTS</th>
                            <th className="px-3 py-3 border-r border-slate-800/50 text-center text-red-500/80 w-[10%]">CONF_IDX</th>
                            <th className="px-2 py-3 border-r border-slate-800/50 text-center w-[5%]">N_C</th>
                            <th className="px-2 py-3 border-r border-slate-800/50 text-center w-[5%]">N_F</th>
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
                                <td colSpan={10} className="py-32 text-center bg-slate-950">
                                    <div className="flex flex-col items-center gap-6">
                                        <Database className="w-12 h-12 text-slate-800" />
                                        <span className="text-xs font-black text-slate-600 uppercase tracking-[0.4em] italic">No active nodes for {tipsDate}</span>
                                        <div className="flex gap-4">
                                            <button onClick={onImportIA} className="text-[10px] font-black text-amber-600 border-2 border-amber-600/30 px-8 py-3 uppercase tracking-widest hover:bg-amber-600 hover:text-white transition-all">RECOVER IA DATA</button>
                                            <button onClick={onAddNewRow} className="text-[10px] font-black text-white bg-slate-900 border-2 border-slate-800 px-8 py-3 uppercase tracking-widest hover:border-white transition-all">+ INITIALIZE NODE</button>
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
