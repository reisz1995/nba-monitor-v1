import React from 'react';
import { Team } from '../types';

export interface GameResultData {
  date: string;
  score: string;
  result: 'V' | 'D';
  opponent: string;
}

interface MomentumPanelProps {
  teamA: Team;
  teamB: Team;
  homeRecord: GameResultData[];
  awayRecord: GameResultData[];
  h2hRecord: GameResultData[];
}

export const MomentumPanel: React.FC<MomentumPanelProps> = ({ teamA, teamB, homeRecord, awayRecord, h2hRecord }) => {

  const renderRecordRow = (title: string, record: GameResultData[]) => (
    <div className="mb-[24px]">
      <h3 className="font-mono uppercase text-[12px] font-black text-zinc-400 mb-[12px] tracking-widest border-b border-zinc-800 pb-1">
        {title}
      </h3>
      <div className="flex gap-[12px] flex-wrap">
        {record.map((game, idx) => (
          <div
            key={idx}
            className="bg-zinc-900 p-[12px] border-2 border-zinc-800 flex flex-col items-center min-w-[84px] transition-transform hover:-translate-y-1"
            style={{ boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)' }}
          >
            <span className={`font-mono font-black text-[18px] uppercase ${game.result === 'V' ? 'text-emerald-400' : 'text-red-400'}`}>
              {game.result}
            </span>
            <span className="font-mono text-[10px] text-zinc-300 font-black mt-1">
              {game.score}
            </span>
            <span className="font-mono text-[10px] text-zinc-400 mt-[8px] font-bold">{game.opponent}</span>
            <span className="font-mono text-[9px] text-zinc-600">{game.date}</span>
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
      <h2 className="font-mono uppercase text-[18px] font-black text-emerald-400 mb-[24px] tracking-widest">
        [ MATRIZ TERMODINÂMICA ]
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[24px]">
        {/* COLUNA ESQUERDA: FORMA INDIVIDUAL */}
        <div>
          {renderRecordRow(`FORMA: ${teamA.name.split(' ').pop()}`, homeRecord)}
          {renderRecordRow(`FORMA: ${teamB.name.split(' ').pop()}`, awayRecord)}
        </div>

        {/* COLUNA DIREITA: COLISÃO DIRETA (H2H) COM LOGOS E PLACARES */}
        <div className="bg-zinc-900/50 p-[16px] border-2 border-zinc-800">
          <h3 className="font-mono uppercase text-[12px] font-black text-zinc-400 mb-[16px] tracking-widest border-b border-zinc-800 pb-1">
            COLISÃO DIRETA (H2H)
          </h3>

          {h2hRecord.length === 0 ? (
            <div className="font-mono text-[10px] text-zinc-600 uppercase mt-4">
              Sem colisões frontais nesta temporada.
            </div>
          ) : (
            <div className="flex flex-col gap-[8px]">
              {h2hRecord.map((game, i) => (
                <div key={i} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 p-[8px] hover:border-zinc-600 transition-colors">
                  {/* DATA */}
                  <div className="text-[10px] text-zinc-600 font-mono w-[40px] shrink-0">
                    {game.date}
                  </div>

                  {/* BLOCO CENTRAL: LOGO A -> PLACAR -> LOGO B */}
                  <div className="flex items-center gap-[12px] flex-1 justify-center">
                    <img
                      src={teamA.logo}
                      alt="Team A"
                      className={`w-6 h-6 object-contain ${game.result === 'V' ? 'opacity-100 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]' : 'opacity-30 grayscale'}`}
                    />

                    <div className={`px-[8px] py-[4px] border-2 font-black font-mono text-[12px] tracking-wider
                      ${game.result === 'V'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'}`}
                    >
                      {game.score}
                    </div>

                    <img
                      src={teamB.logo}
                      alt="Team B"
                      className={`w-6 h-6 object-contain ${game.result === 'D' ? 'opacity-100 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]' : 'opacity-30 grayscale'}`}
                    />
                  </div>

                  {/* STATUS FINAL */}
                  <div className="w-[40px] flex justify-end shrink-0">
                    {game.result === 'V'
                      ? <span className="text-emerald-500 font-black text-[10px] font-mono">WIN</span>
                      : <span className="text-red-500 font-black text-[10px] font-mono">LOSS</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MomentumPanel;

