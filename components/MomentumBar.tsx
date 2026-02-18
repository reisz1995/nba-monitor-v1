
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
  const lastResult = lastFive[lastFive.length - 1];
  
  for (let i = lastFive.length - 1; i >= 0; i--) {
    if (lastFive[i] === lastResult) streakCount++;
    else break;
  }

  let intensityColor = 'bg-slate-600'; // Oscilando
  let glowStyle = {};
  let label = 'Oscilando';

  if (lastResult === 'V') {
    if (streakCount >= 4) {
      intensityColor = 'bg-emerald-400';
      glowStyle = { boxShadow: '0 0 15px rgba(52, 211, 153, 0.6)' };
      label = 'Hot Streak 🔥';
    } else {
      intensityColor = 'bg-emerald-600';
      label = 'Em Ascensão';
    }
  } else if (lastResult === 'D') {
    if (streakCount >= 3) {
      intensityColor = 'bg-rose-600';
      glowStyle = { boxShadow: '0 0 12px rgba(225, 29, 72, 0.4)' };
      label = 'Cold Streak ❄️';
    } else {
      intensityColor = 'bg-rose-900';
      label = 'Em Queda';
    }
  }

  return (
    <div className={`flex flex-col gap-1 shrink-0 ${className}`}>
      {showLabel && (
        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 text-center">
          {label}
        </span>
      )}
      {/* Mini Mapa de Resultados */}
      <div className="flex gap-0.5 h-1 w-full bg-slate-800/50 rounded-full overflow-hidden">
        {lastFive.map((r, i) => (
          <div 
            key={i} 
            className={`flex-1 ${r === 'V' ? 'bg-emerald-500/40' : 'bg-rose-500/40'}`}
          />
        ))}
      </div>
      {/* Barra de Intensidade Principal */}
      <div 
        className={`h-1.5 w-full rounded-full transition-all duration-700 ${intensityColor}`}
        style={glowStyle}
      />
    </div>
  );
};

export default MomentumBar;
