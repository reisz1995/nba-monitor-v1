
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
        <section className="space-y-10 animate-in fade-in duration-1000">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-8 border-b-2 border-white/10 pb-8">
                    <div className="flex items-center gap-6">
                        <div className="bg-white p-4 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] rounded-sm">
                            <BrainCircuit className="w-10 h-10 text-black" />
                        </div>
                        <div>
                            <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">
                                PREDICTOR <span className="text-indigo-500 underline decoration-indigo-500/30 underline-offset-8">NODE</span>
                            </h3>
                            <div className="flex items-center gap-6 mt-4 font-mono">
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em] flex items-center gap-2">
                                    <Database className="w-3 h-3 text-indigo-500" /> SOURCE: painel_palpites_io
                                </p>
                                <div className="bg-white/10 h-3 w-[1px]" />
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-3 h-3 text-indigo-400" />
                                    <input
                                        type="text" value={tipsDate} onChange={(e) => setTipsDate(e.target.value)}
                                        placeholder="DD/MM/YYYY"
                                        className="bg-transparent border-0 focus:ring-0 text-indigo-400 font-black text-[11px] w-32 tracking-[0.2em] p-0 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        <button
                            onClick={onImportIA}
                            disabled={isImporting}
                            className="bg-black border-2 border-amber-600/50 hover:bg-amber-600 text-white text-[10px] font-black px-6 py-4 rounded-sm uppercase tracking-[0.2em] transition-all cursor-pointer shadow-[6px_6px_0px_#000] active:translate-x-1 active:translate-y-1 flex items-center gap-2 disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4 text-amber-500" />
                            RECOVER_IA_DATA
                        </button>
                        <button
                            onClick={onExportPNG}
                            disabled={isExporting}
                            className="bg-black border-2 border-white/10 hover:bg-white hover:text-black text-[10px] font-black px-6 py-4 rounded-sm uppercase tracking-[0.2em] transition-all cursor-pointer shadow-[6px_6px_0px_#000] active:translate-x-1 active:translate-y-1 flex items-center gap-3 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            EXPORT_IMAGE
                        </button>
                        <button
                            onClick={onCopyText}
                            className="bg-black border-2 border-emerald-500/50 hover:bg-emerald-500 text-white text-[10px] font-black px-6 py-4 rounded-sm uppercase tracking-[0.2em] transition-all cursor-pointer shadow-[6px_6px_0px_#000] active:translate-x-1 active:translate-y-1 flex items-center gap-3"
                        >
                            <Copy className="w-4 h-4 text-emerald-400" />
                            COPY_ARCHIVE
                        </button>
                        <button
                            onClick={onAddNewRow}
                            className="bg-black border-2 border-white/20 hover:border-white text-white text-[10px] font-black px-6 py-4 rounded-sm uppercase tracking-[0.2em] transition-all cursor-pointer shadow-[6px_6px_0px_#000] active:translate-x-1 active:translate-y-1"
                        >
                            + NEW_ENTITY
                        </button>
                        <button
                            onClick={onSavePalpites}
                            disabled={isSavingPalpites}
                            className="bg-indigo-600 border-2 border-indigo-400/50 hover:bg-indigo-500 text-white text-[10px] font-black px-8 py-4 rounded-sm uppercase tracking-[0.2em] shadow-[8px_8px_0px_#000] active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer font-mono"
                        >
                            {isSavingPalpites ? <Zap className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            SYNC_SYSTEM_LOGS
                        </button>
                    </div>
                </div>
            </div>

            <div ref={tableRef} className="bg-black/40 backdrop-blur-xl border-2 border-white/10 overflow-x-auto shadow-[32px_32px_0px_#000] rounded-xl glass-morphism">
                <table className="w-full text-left border-collapse min-w-[900px] font-mono">
                    <thead>
                        <tr className="bg-black/60 backdrop-blur-md text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] border-b border-white/10">
                            <th className="px-4 py-4 border-r border-white/5 w-[18%]">MATCHUP_ID: HOME</th>
                            <th className="px-4 py-4 border-r border-white/5 w-[18%]">MATCHUP_ID: AWAY</th>
                            <th className="px-4 py-4 border-r border-white/5 bg-indigo-500/5 text-indigo-400 w-[15%]">QUANTUM_PICK</th>
                            <th className="px-2 py-4 border-r border-white/5 text-center text-amber-500/80 w-[8%]">OVER_v</th>
                            <th className="px-2 py-4 border-r border-white/5 text-center text-rose-500/80 w-[8%]">UNDER_v</th>
                            <th className="px-2 py-4 border-r border-white/5 text-center w-[10%]">TARGET_PTS</th>
                            <th className="px-4 py-4 border-r border-white/5 text-center text-indigo-500 w-[10%] font-black">CONF_IDX</th>
                            <th className="px-2 py-4 border-r border-white/5 text-center w-[5%]">N_C</th>
                            <th className="px-2 py-4 border-r border-white/5 text-center w-[5%]">N_F</th>
                            <th className="px-2 py-4 text-center w-[3%]">ACT</th>
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
                                <td colSpan={10} className="py-40 text-center bg-black/20">
                                    <div className="flex flex-col items-center gap-8">
                                        <Database className="w-16 h-16 text-white/5" />
                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-[1em] italic">NULL_SET: NO_ACTIVE_NODES_DETECTION</span>
                                        <div className="flex gap-6">
                                            <button onClick={onImportIA} className="text-[10px] font-black text-amber-500 border-2 border-amber-500/20 px-10 py-4 uppercase tracking-[0.3em] hover:bg-amber-500/10 transition-all cursor-pointer rounded-sm">INITIALIZE_IA_RESTORE</button>
                                            <button onClick={onAddNewRow} className="text-[10px] font-black text-white bg-white/5 border-2 border-white/10 px-10 py-4 uppercase tracking-[0.3em] hover:border-white transition-all cursor-pointer rounded-sm">+ MANUAL_ENTITY_ADD</button>
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
