
import React from 'react';
import { Team } from '../types';
import MomentumBar from './MomentumBar';

interface StandingsTableProps {
  teams: Team[];
  selectedTeams: number[];
  onToggleRecord: (teamId: number, recordIndex: number) => void;
  onToggleSelect: (teamId: number) => void;
}

const StandingsTable: React.FC<StandingsTableProps> = ({ teams, selectedTeams, onToggleRecord, onToggleSelect }) => {
  const lesteTeams = teams.filter(t => t.conference === 'East');
  const oesteTeams = teams.filter(t => t.conference === 'West');

  const renderTeamRow = (team: Team, index: number) => {
    const record = team.record || [];
    const isSelected = selectedTeams.includes(team.id);
    const rank = index + 1;

    return (
      <div
        key={team.id}
        className={`flex flex-col md:grid md:grid-cols-12 items-center px-4 md:px-6 py-3.5 hover:bg-slate-800/40 transition-all group border-b border-slate-800/30 ${isSelected ? 'bg-orange-500/5' : ''}`}
      >
        <div className="flex md:contents">
          <div className="w-12 md:col-span-1 flex items-center gap-2 md:gap-3 border-r border-slate-800/40 h-full py-1">
            <button
              onClick={() => onToggleSelect(team.id)}
              className={`w-4 h-4 rounded-sm border transition-all flex items-center justify-center shrink-0 ${isSelected
                ? 'bg-orange-600 border-orange-500 text-white'
                : 'border-slate-700 hover:border-orange-500 bg-slate-900/50'
                }`}
            >
              {isSelected && <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>}
            </button>
            <span className={`text-[11px] font-black w-6 text-center shrink-0 ${rank <= 6 ? 'text-indigo-400' :
              rank <= 10 ? 'text-orange-400' : 'text-slate-600'
              }`}>
              {String(rank).padStart(2, '0')}
            </span>
          </div>

          <div className="flex-1 md:col-span-7 flex items-center gap-3 md:gap-4 pl-3 md:pl-4 h-full py-1 min-w-0">
            <div className="relative group/logo cursor-pointer shrink-0" onClick={() => onToggleSelect(team.id)}>
              <img
                src={team.logo}
                alt={team.name}
                className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] transition-transform group-hover/logo:scale-110 duration-300 relative z-10"
              />
            </div>

            <MomentumBar record={record} className="w-8 md:w-10" />

            <div className="flex flex-col cursor-pointer min-w-0" onClick={() => onToggleSelect(team.id)}>
              <span className="text-slate-100 font-black text-xs md:text-base tracking-tighter uppercase italic group-hover:text-orange-400 transition-colors truncate">
                {team.name}
              </span>
              <span className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                {team.conference === 'East' ? 'LESTE' : 'OESTE'}
              </span>
            </div>
          </div>
        </div>

        <div className="w-full md:col-span-4 mt-3 md:mt-0 flex justify-center md:justify-end gap-1.5 md:gap-2 md:border-l border-slate-800/40 h-full py-1 md:pl-4 border-t md:border-t-0 pt-3 md:pt-1">
          {record.map((result, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                onToggleRecord(team.id, i);
              }}
              className={`w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-sm text-[9px] md:text-[10px] font-black transition-all border shadow-lg ${result === 'V'
                ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                : 'bg-rose-900/40 text-rose-400 border-rose-500/30 hover:bg-rose-500/30'
                }`}
            >
              {result}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderConferenceSection = (title: string, colorClass: string, teams: Team[]) => (
    <>
      <div className={`px-4 md:px-6 py-2 bg-slate-900/80 border-y border-slate-800 flex items-center justify-between`}>
        <h4 className={`text-[10px] md:text-[11px] font-black ${colorClass} uppercase tracking-[0.2em] md:tracking-[0.3em] italic`}>{title}</h4>
        <span className="text-[8px] md:text-[9px] text-slate-500 font-bold uppercase">{teams.length} TIMES</span>
      </div>
      {teams.map((team, idx) => renderTeamRow(team, idx))}
    </>
  );

  return (
    <div className="bg-[#0f172a]/80 backdrop-blur-xl border-2 border-slate-800 rounded-sm overflow-hidden shadow-2xl flex flex-col">
      <div className="table-container custom-scrollbar">
        <div className="w-full min-w-0">
          <div className="hidden md:grid sticky top-0 z-20 grid-cols-12 px-6 py-4 bg-[#111827] text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 border-slate-800 shadow-xl">
            <div className="col-span-1 border-r border-slate-800/40">#</div>
            <div className="col-span-7 pl-4">Franquia / Força Atual</div>
            <div className="col-span-4 text-right pr-4 border-l border-slate-800/40 pl-4">Ação / Sequência</div>
          </div>

          <div className="flex flex-col">
            {lesteTeams.length > 0 && renderConferenceSection('Conferência Leste', 'text-indigo-400', lesteTeams)}
            {oesteTeams.length > 0 && renderConferenceSection('Conferência Oeste', 'text-orange-400', oesteTeams)}
            {lesteTeams.length === 0 && oesteTeams.length === 0 && teams.map((team, index) => renderTeamRow(team, index))}
          </div>
        </div>
      </div>

      <div className="px-6 py-3 bg-[#111827]/60 border-t-2 border-slate-800 flex gap-6 items-center flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-sm"></div>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Conferência Leste</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-orange-500 rounded-sm"></div>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Conferência Oeste</span>
        </div>
        <div className="h-4 w-px bg-slate-800 hidden md:block"></div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 bg-emerald-400 rounded-sm shadow-[0_0_8px_rgba(52,211,153,0.3)]"></div>
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest italic">Vitória</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 bg-rose-600 rounded-sm"></div>
          <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest italic">Derrota</span>
        </div>
      </div>
    </div>
  );
};

export default StandingsTable;
