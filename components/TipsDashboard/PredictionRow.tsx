import React from 'react';
import { Trash2 } from 'lucide-react';
import { PalpiteData } from '../../types';

interface PredictionRowProps {
    pred: PalpiteData;
    isExporting: boolean;
    onLocalChange: (id: number, field: keyof PalpiteData, value: string) => void;
    onRemove: (id: number) => void;
}

const PredictionRow: React.FC<PredictionRowProps> = ({
    pred,
    isExporting,
    onLocalChange,
    onRemove
}) => {
    return (
        <tr className="border-b border-slate-800/40 hover:bg-slate-900/50 transition-all group">
            <td className="px-3 py-2 border-r border-slate-800/50">
                <input
                    list="nba-teams"
                    value={pred.time_casa}
                    onChange={(e) => onLocalChange(pred.id!, 'time_casa', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 text-white focus:ring-0 font-bold py-1 px-2 text-[11px] uppercase tracking-tight"
                    placeholder="TEAM HOME"
                />
            </td>
            <td className="px-3 py-2 border-r border-slate-800/50">
                <input
                    list="nba-teams"
                    value={pred.time_fora}
                    onChange={(e) => onLocalChange(pred.id!, 'time_fora', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 text-white focus:ring-0 font-bold py-1 px-2 text-[11px] uppercase tracking-tight"
                    placeholder="TEAM AWAY"
                />
            </td>
            <td className="px-3 py-2 border-r border-slate-800/50">
                <input
                    value={pred.palpite_principal}
                    onChange={(e) => onLocalChange(pred.id!, 'palpite_principal', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 text-emerald-400 focus:ring-0 font-black py-1 px-2 text-[11px] uppercase tracking-widest"
                    placeholder="MAIN PICK"
                />
            </td>
            <td className="px-3 py-2 border-r border-slate-800/50">
                <input
                    value={pred.over_line}
                    onChange={(e) => onLocalChange(pred.id!, 'over_line', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 text-slate-100 text-center focus:ring-0 font-mono font-bold py-1 text-[11px]"
                />
            </td>
            <td className="px-3 py-2 border-r border-slate-800/50">
                <input
                    value={pred.under_line}
                    onChange={(e) => onLocalChange(pred.id!, 'under_line', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 text-slate-100 text-center focus:ring-0 font-mono font-bold py-1 text-[11px]"
                />
            </td>

            {/* === MUTAÇÃO INJETADA: HANDICAP_LINE === */}
            <td className="px-3 py-2 border-r border-slate-800/50 bg-amber-500/5 transition-colors group-hover:bg-amber-500/10 relative">
                <div className="relative group/edge">
                    {Math.abs(parseFloat(pred.handicap_line || '0')) >= 5.0 && (
                        <div className="absolute -top-5 -right-3 bg-gradient-to-r from-red-600 to-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded-sm font-black flex items-center gap-1 shadow-[0_0_15px_rgba(220,38,38,0.8)] z-10 animate-pulse border border-red-400 font-oswald pointer-events-none">
                            🔥 VALUE_EDGE
                        </div>
                    )}

                    <input
                        value={pred.handicap_line || ''}
                        onChange={(e) => onLocalChange(pred.id!, 'handicap_line', e.target.value)}
                        className="w-full bg-slate-950 border border-amber-500/30 focus:border-amber-500 text-amber-500 text-center focus:ring-1 focus:ring-amber-500/50 font-mono font-black py-1 text-[11px] uppercase tracking-tighter transition-all shadow-[0_0_10px_rgba(255,191,0,0.1)] focus:shadow-[0_0_15px_rgba(255,191,0,0.3)] placeholder:text-amber-900/40"
                        placeholder="EDGE_DATA"
                    />
                    <div className="absolute inset-0 pointer-events-none border border-amber-500/0 group-hover/edge:border-amber-500/20 transition-all"></div>
                </div>
            </td>
            {/* ======================================= */}

            <td className="px-3 py-2 border-r border-slate-800/50">
                <div className="relative">
                    <input
                        value={pred.confianca}
                        onChange={(e) => onLocalChange(pred.id!, 'confianca', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-red-600 text-center focus:ring-0 font-black text-red-500 py-1 text-[11px] uppercase tracking-widest transition-colors"
                    />
                </div>
            </td>
            <td className="px-2 py-2 border-r border-slate-800/50 text-center font-bold text-slate-600 text-[10px] bg-slate-900/30">
                {pred.n_casa}
            </td>
            <td className="px-2 py-2 border-r border-slate-800/50 text-center font-bold text-slate-600 text-[10px] bg-slate-900/30">
                {pred.n_fora}
            </td>
            <td className="px-2 py-2 text-center">
                {!isExporting && (
                    <button
                        onClick={() => onRemove(pred.id!)}
                        className="text-slate-700 hover:text-red-500 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </td>
        </tr>
    );
};

export default PredictionRow;
