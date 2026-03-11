
import React from 'react';
import { GameResult } from '../types';

interface MomentumBarProps {
  record: GameResult[];
  className?: string;
  showLabel?: boolean;
}

const MomentumBar: React.FC<MomentumBarProps> = ({ record, className = "", showLabel = false }) => {
  const lastFive = record || [];
  let streakCount = 0;
  const lastResultObj = lastFive[lastFive.length - 1];
  const lastResult = typeof lastResultObj === 'object' && lastResultObj !== null ? (lastResultObj as any).result : lastResultObj;

  for (let i = lastFive.length - 1; i >= 0; i--) {
    const res = typeof lastFive[i] === 'object' && lastFive[i] !== null ? (lastFive[i] as any).result : lastFive[i];
    if (res === lastResult) streakCount++;
    else break;
  }

  let intensityColor = 'bg-slate-800'; // Oscillating
  let glowStyle = {};
  let label = 'STABLE_ORBIT';

  if (lastResult === 'V') {
    if (streakCount >= 4) {
      intensityColor = 'bg-emerald-400';
      glowStyle = { boxShadow: '0 0 12px #34d399' };
      label = 'CRITICAL_ASCENSION';
    } else {
      intensityColor = 'bg-emerald-600';
      label = 'POSITIVE_MOMENTUM';
    }
  } else if (lastResult === 'D') {
    if (streakCount >= 3) {
      intensityColor = 'bg-rose-600';
      glowStyle = { boxShadow: '0 0 12px #e11d48' };
      label = 'NEGATIVE_CASCADE';
    } else {
      intensityColor = 'bg-rose-900';
      label = 'DECAYING_TREND';
    }
  }

  return (
    <div className={`flex flex-col gap-1 shrink-0 ${className} font-mono`}>
      {showLabel && (
        <span className="text-[7px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1 text-center opacity-70">
          {label}
        </span>
      )}
      {/* Mini Results Map */}
      <div className="flex gap-0.5 h-1.5 w-full bg-black/60 border border-white/5 overflow-hidden rounded-sm glass-morphism">
        {lastFive.map((r, i) => {
          const resStr = typeof r === 'object' && r !== null ? (r as any).result : r;
          return (
            <div
              key={i}
              className={`flex-1 ${resStr === 'V' ? 'bg-emerald-500/80' : 'bg-rose-500/80'}`}
            />
          );
        })}
      </div>
      {/* Main Intensity Bar */}
      <div className="h-2 w-full bg-black/40 border border-white/10 rounded-sm glass-morphism overflow-hidden">
        <div
          className={`h-full w-full transition-all duration-700 ${intensityColor}`}
          style={glowStyle}
        />
      </div>
    </div>
  );
};

export default MomentumBar;
