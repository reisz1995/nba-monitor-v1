
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
        <tr className="border-b border-white/5 hover:bg-white/[0.03] transition-all group font-mono">
            <td className="px-3 py-2.5 border-r border-white/5">
                <input
                    list="nba-teams"
                    value={pred.time_casa}
                    onChange={(e) => onLocalChange(pred.id!, 'time_casa', e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/50 text-white focus:ring-0 font-black py-1.5 px-3 text-[10px] uppercase tracking-tighter outline-none rounded-sm transition-all"
                    placeholder="BASE.HOME"
                />
            </td>
            <td className="px-3 py-2.5 border-r border-white/5">
                <input
                    list="nba-teams"
                    value={pred.time_fora}
                    onChange={(e) => onLocalChange(pred.id!, 'time_fora', e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/50 text-white focus:ring-0 font-black py-1.5 px-3 text-[10px] uppercase tracking-tighter outline-none rounded-sm transition-all"
                    placeholder="BASE.AWAY"
                />
            </td>
            <td className="px-3 py-2.5 border-r border-white/5 bg-indigo-500/5">
                <input
                    value={pred.palpite_principal}
                    onChange={(e) => onLocalChange(pred.id!, 'palpite_principal', e.target.value)}
                    className="w-full bg-transparent border border-white/5 focus:border-indigo-500 text-indigo-400 focus:ring-0 font-black py-1.5 px-3 text-[10px] uppercase tracking-[0.1em] outline-none rounded-sm bg-black/20"
                    placeholder="CORE_TARGET"
                />
            </td>
            <td className="px-2 py-2.5 border-r border-white/5">
                <input
                    value={pred.over_line}
                    onChange={(e) => onLocalChange(pred.id!, 'over_line', e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-amber-500 text-amber-500 text-center focus:ring-0 font-black py-1.5 text-[10px] outline-none rounded-sm"
                    placeholder="OVER"
                />
            </td>
            <td className="px-2 py-2.5 border-r border-white/5">
                <input
                    value={pred.under_line}
                    onChange={(e) => onLocalChange(pred.id!, 'under_line', e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-rose-500 text-rose-500 text-center focus:ring-0 font-black py-1.5 text-[10px] outline-none rounded-sm"
                    placeholder="UNDER"
                />
            </td>
            <td className="px-2 py-2.5 border-r border-white/5 bg-white/5">
                <input
                    value={pred.p_combinados}
                    onChange={(e) => onLocalChange(pred.id!, 'p_combinados', e.target.value)}
                    className="w-full bg-transparent border-0 text-slate-300 text-center focus:ring-0 font-mono font-black py-1.5 text-[10px] outline-none"
                    placeholder="COMB"
                />
            </td>
            <td className="px-3 py-2.5 border-r border-white/5">
                <div className="relative">
                    <input
                        value={pred.confianca}
                        onChange={(e) => onLocalChange(pred.id!, 'confianca', e.target.value)}
                        className="w-full bg-black/40 border-2 border-indigo-500/20 focus:border-indigo-500 text-center focus:ring-0 font-black text-indigo-500 py-1.5 text-[10px] uppercase tracking-[0.2em] transition-all outline-none rounded-sm"
                        placeholder="IDX_C"
                    />
                </div>
            </td>
            <td className="px-2 py-2.5 border-r border-white/5 text-center font-black text-slate-600 text-[10px] bg-black/20 italic">
                {pred.n_casa}
            </td>
            <td className="px-2 py-2.5 border-r border-white/5 text-center font-black text-slate-600 text-[10px] bg-black/20 italic">
                {pred.n_fora}
            </td>
            <td className="px-2 py-2.5 text-center">
                {!isExporting && (
                    <button
                        onClick={() => onRemove(pred.id!)}
                        className="text-slate-700 hover:text-white transition-all active:scale-95 cursor-pointer p-1"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </td>
        </tr>
    );
};

export default PredictionRow;
