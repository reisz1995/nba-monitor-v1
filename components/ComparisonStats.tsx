import React from 'react';

export const StatBar: React.FC<{ label: string; valA: number; valB: number; isPercent?: boolean }> = ({ label, valA, valB, isPercent }) => {
    const total = valA + valB;
    const pctA = total > 0 ? (valA / total) * 100 : 50;
    const displayA = isPercent ? `${valA.toFixed(1)}%` : valA.toFixed(1);
    const displayB = isPercent ? `${valB.toFixed(1)}%` : valB.toFixed(1);

    return (
        <div aria-label="Stat Bar" className="flex flex-col gap-2 w-full font-['Space_Mono']">
            <div className="flex justify-between items-end px-1">
                <span className="text-white font-bold text-lg">{displayA}</span>
                <span className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">{label}</span>
                <span className="text-slate-300 font-bold text-lg">{displayB}</span>
            </div>
            <div className="h-4 w-full bg-black border-2 border-slate-800 p-0.5 flex relative">
                <div style={{ width: `${pctA}%` }} className="h-full bg-indigo-500 transition-all duration-1000 ease-out"></div>
                <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
                    <div className="h-full w-px bg-slate-800"></div>
                    <div className="h-full w-px bg-slate-800"></div>
                    <div className="h-full w-px bg-slate-800"></div>
                </div>
            </div>
        </div>
    );
};

export const PlayerCard: React.FC<{ name: string; status?: string; isOut?: boolean; weight?: number }> = ({ name, status, isOut, weight }) => (
    <div aria-label="Player Card" className={`flex items-center justify-between p-2 border-2 transition-all w-full font-['Space_Mono'] shadow-[4px_4px_0px_#000] ${isOut
        ? 'bg-rose-500/10 border-rose-500 text-rose-500'
        : status
            ? 'bg-amber-500/10 border-amber-500 text-amber-500'
            : 'bg-black border-slate-800 text-slate-200'
        }`}>
        <span className="text-[10px] md:text-xs font-bold uppercase truncate">
            {name}
        </span>
        <div className="flex items-center gap-2">
            {weight !== undefined && (
                <span title="Handicap de Estrela" className="text-[10px] font-bold border border-current px-1 py-0.5">
                    HW: {weight.toFixed(1)}
                </span>
            )}
            {status && (
                <span className="text-[8px] font-bold px-1 py-0.5 border border-current uppercase">
                    {status}
                </span>
            )}
        </div>
    </div>
);

export const AdvantageItem: React.FC<{ label: string; valA: string | number; valB: string | number; winner: 'a' | 'b' | 'none'; sub?: string }> = ({ label, valA, valB, winner, sub }) => (
    <div aria-label="Advantage Item" className="flex flex-col border-r-4 border-white last:border-r-0 px-6 py-4 flex-1 min-w-[150px] bg-black hover:bg-zinc-900 transition-colors group relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800 group-hover:bg-indigo-500 transition-colors"></div>
        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter mb-6 group-hover:text-zinc-300">{label}</span>
        <div className="flex justify-between items-end mb-4">
            <div className="flex flex-col">
                <span className={`text-2xl font-black leading-none ${winner === 'a' ? 'text-white' : 'text-zinc-700'}`}>{valA}</span>
                <span className="text-[6px] font-bold text-zinc-600 mt-1 uppercase">TEAM_A</span>
            </div>
            <div className="h-8 w-px bg-zinc-800 mb-1"></div>
            <div className="flex flex-col items-end">
                <span className={`text-2xl font-black leading-none ${winner === 'b' ? 'text-white' : 'text-zinc-700'}`}>{valB}</span>
                <span className="text-[6px] font-bold text-zinc-600 mt-1 uppercase">TEAM_B</span>
            </div>
        </div>
        {sub && (
            <div className="mt-auto pt-4 border-t border-zinc-900">
                <span className="text-[7px] font-bold text-indigo-500 uppercase leading-none block italic">{sub}</span>
            </div>
        )}
    </div>
);
