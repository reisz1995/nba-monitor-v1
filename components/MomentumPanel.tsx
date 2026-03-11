import React from 'react';

export interface GameResultData {
  date: string;
  score: string;
  result: 'V' | 'D';
  opponent: string;
}

interface MomentumPanelProps {
  homeRecord: GameResultData[];
  awayRecord: GameResultData[];
  h2hRecord: GameResultData[];
}

export const MomentumPanel: React.FC<MomentumPanelProps> = ({ homeRecord, awayRecord, h2hRecord }) => {
  
  const renderRecordRow = (title: string, record: GameResultData[]) => (
    <div className="mb-[24px]">
      <h3 className="font-mono uppercase text-[14px] text-zinc-400 mb-[12px] tracking-widest">{title}</h3>
      <div className="flex gap-[12px] flex-wrap">
        {record.map((game, idx) => (
          <div 
            key={idx} 
            className="bg-zinc-900 p-[12px] border-2 border-zinc-800 flex flex-col items-center min-w-[84px] transition-transform hover:-translate-y-1"
            style={{ boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)' }}
          >
            <span className={`font-mono font-bold text-[18px] uppercase ${game.result === 'V' ? 'text-emerald-400' : 'text-red-400'}`}>
              {game.result}
            </span>
            <span className="font-mono text-[10px] text-zinc-500 mt-[12px]">{game.opponent}</span>
            <span className="font-mono text-[10px] text-zinc-600">{game.date}</span>
          </div>
        ))}
        {record.length === 0 && (
          <div className="bg-zinc-900 p-[12px] border-2 border-zinc-800 font-mono text-[10px] text-zinc-600" style={{ boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)' }}>
            DADOS INDISPONÍVEIS
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-zinc-950 p-[24px] border-4 border-black w-full" style={{ boxShadow: '8px 8px 0px 0px rgba(0,0,0,1)' }}>
      <h2 className="font-mono uppercase text-[24px] text-white tracking-tighter mb-[24px] border-b-2 border-zinc-800 pb-[12px]">
        Matriz Temporal (Momentum)
      </h2>
      
      <div className="flex flex-col gap-[12px]">
        {renderRecordRow("Últimos 5 (Casa)", homeRecord)}
        {renderRecordRow("Últimos 5 (Visitante)", awayRecord)}
        {renderRecordRow("Confrontos Diretos (H2H)", h2hRecord)}
      </div>
    </div>
  );
};

export default MomentumPanel;
