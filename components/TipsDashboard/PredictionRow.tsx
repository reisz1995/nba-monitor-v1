
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
            <td className="px-6 py-4 border-r border-slate-800/50">
                <input
                    list="nba-teams"
                    value={pred.time_casa}
                    onChange={(e) => onLocalChange(pred.id!, 'time_casa', e.target.value)}
                    className="w-full bg-slate-900 border-2 border-slate-800 focus:border-indigo-500 text-white focus:ring-0 font-bold py-1.5 px-3 text-xs uppercase tracking-tight"
                    placeholder="TEAM HOME"
                />
            </td>
            <td className="px-6 py-4 border-r border-slate-800/50">
                <input
                    list="nba-teams"
                    value={pred.time_fora}
                    onChange={(e) => onLocalChange(pred.id!, 'time_fora', e.target.value)}
                    className="w-full bg-slate-900 border-2 border-slate-800 focus:border-indigo-500 text-white focus:ring-0 font-bold py-1.5 px-3 text-xs uppercase tracking-tight"
                    placeholder="TEAM AWAY"
                />
            </td>
            <td className="px-6 py-4 border-r border-slate-800/50">
                <input
                    value={pred.palpite_principal}
                    onChange={(e) => onLocalChange(pred.id!, 'palpite_principal', e.target.value)}
                    className="w-full bg-slate-950 border-2 border-slate-800 focus:border-emerald-500 text-emerald-400 focus:ring-0 font-black py-1.5 px-3 text-xs uppercase tracking-widest"
                    placeholder="MAIN PICK"
                />
            </td>
            <td className="px-4 py-4 border-r border-slate-800/50">
                <input
                    value={pred.over_line}
                    onChange={(e) => onLocalChange(pred.id!, 'over_line', e.target.value)}
                    className="w-full bg-slate-900 border-2 border-slate-800 focus:border-amber-500 text-amber-500 text-center focus:ring-0 font-bold py-1.5 text-xs"
                    placeholder="OVER"
                />
            </td>
            <td className="px-4 py-4 border-r border-slate-800/50">
                <input
                    value={pred.under_line}
                    onChange={(e) => onLocalChange(pred.id!, 'under_line', e.target.value)}
                    className="w-full bg-slate-900 border-2 border-slate-800 focus:border-rose-500 text-rose-500 text-center focus:ring-0 font-bold py-1.5 text-xs"
                    placeholder="UNDER"
                />
            </td>
            <td className="px-4 py-4 border-r border-slate-800/50 bg-slate-900/20">
                <input
                    value={pred.p_combinados}
                    onChange={(e) => onLocalChange(pred.id!, 'p_combinados', e.target.value)}
                    className="w-full bg-transparent border-0 text-slate-100 text-center focus:ring-0 font-mono font-bold py-1.5 text-xs"
                />
            </td>
            <td className="px-6 py-4 border-r border-slate-800/50">
                <div className="relative">
                    <input
                        value={pred.confianca}
                        onChange={(e) => onLocalChange(pred.id!, 'confianca', e.target.value)}
                        className="w-full bg-slate-900 border-2 border-slate-800 focus:border-red-600 text-center focus:ring-0 font-black text-red-500 py-1.5 text-xs uppercase tracking-widest transition-colors"
                    />
                </div>
            </td>
            <td className="px-4 py-4 border-r border-slate-800/50 text-center font-bold text-slate-600 text-[10px] bg-slate-900/30">
                {pred.n_casa}
            </td>
            <td className="px-4 py-4 border-r border-slate-800/50 text-center font-bold text-slate-600 text-[10px] bg-slate-900/30">
                {pred.n_fora}
            </td>
            <td className="px-3 py-4 text-center">
                {!isExporting && (
                    <button
                        onClick={() => onRemove(pred.id!)}
                        className="text-slate-700 hover:text-red-500 transition-all active:scale-90"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </td>
        </tr>
    );
};

export default PredictionRow;
