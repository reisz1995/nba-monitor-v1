
import React, { memo, useState, useCallback, useMemo } from 'react';
import { Team } from '../types';
import MomentumBar from './MomentumBar';

interface StandingsTableProps {
  teams: Team[];
  selectedTeams: number[];
  onToggleRecord: (teamId: number, recordIndex: number) => void;
  onToggleSelect: (teamId: number) => void;
}

interface TeamRowProps {
  team: Team;
  index: number;
  isSelected: boolean;
  isFocused: boolean;
  onToggleSelect: (teamId: number) => void;
  onToggleRecord: (teamId: number, recordIndex: number) => void;
  onFocus: (teamId: number) => void;
}

const TeamRow = memo(({
  team,
  index,
  isSelected,
  isFocused,
  onToggleSelect,
  onToggleRecord,
  onFocus
}: TeamRowProps) => {
  const record = team.record || [];
  const rank = index + 1;

  return (
    <div
      role="row"
      tabIndex={isFocused ? 0 : -1}
      aria-selected={isSelected}
      aria-label={`${team.name}, Rank ${rank}, ${team.conference} Conference`}
      onFocus={() => onFocus(team.id)}
      className={`flex flex-col md:grid md:grid-cols-12 items-center px-4 md:px-6 py-3.5 hover:bg-white/5 transition-all group border-b border-white/5 ${isSelected ? 'bg-indigo-500/10' : ''} ${isFocused ? 'ring-2 ring-indigo-500 ring-inset outline-none bg-white/5' : ''} cursor-pointer`}
      onClick={() => onToggleSelect(team.id)}
    >
      <div className="flex md:contents">
        <div className="w-12 md:col-span-1 flex items-center gap-2 md:gap-3 border-r border-white/10 h-full py-1">
          <button
            tabIndex={-1} // Controlled via row keydown
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(team.id);
            }}
            className={`w-4 h-4 rounded-sm border-2 transition-all flex items-center justify-center shrink-0 ${isSelected
              ? 'bg-indigo-600 border-indigo-400 text-white'
              : 'border-white/20 hover:border-indigo-400 bg-white/5'
              }`}
          >
            {isSelected && <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>}
          </button>
          <span className={`text-[11px] font-black w-6 text-center shrink-0 font-mono ${rank <= 6 ? 'text-indigo-400' :
            rank <= 10 ? 'text-orange-400' : 'text-slate-600'
            }`}>
            {String(rank).padStart(2, '0')}
          </span>
        </div>

        <div className="flex-1 md:col-span-7 flex items-center gap-3 md:gap-4 pl-3 md:pl-4 h-full py-1 min-w-0">
          <div className="relative group/logo shrink-0">
            <img
              src={team.logo}
              alt="" // Decorative since name is next to it
              className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] transition-transform group-hover/logo:scale-110 duration-300 relative z-10"
            />
          </div>

          <MomentumBar record={record as GameResult[]} className="w-8 md:w-10" />

          <div className="flex flex-col min-w-0">
            <span className="text-white font-black text-xs md:text-base tracking-tighter uppercase italic group-hover:text-indigo-400 transition-colors truncate font-mono">
              {team.name}
            </span>
            <span className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5 font-mono">
              {team.conference === 'East' ? 'CONFERENCE_EAST' : 'CONFERENCE_WEST'}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full md:col-span-4 mt-3 md:mt-0 flex justify-center md:justify-end gap-1.5 md:gap-2 md:border-l border-white/10 h-full py-1 md:pl-4 border-t md:border-t-0 pt-3 md:pt-1">
        {record.map((result, i) => {
          const resString = typeof result === 'object' && result !== null ? (result as any).result : result;
          return (
            <button
              key={i}
              tabIndex={-1} // Controlled via row keydown
              onClick={(e) => {
                e.stopPropagation();
                onToggleRecord(team.id, i);
              }}
              className={`w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-sm text-[9px] md:text-[10px] font-black transition-all border-2 shadow-lg font-mono ${resString === 'V'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/30'
                }`}
            >
              {resString}
            </button>
          );
        })}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.team.id === nextProps.team.id &&
         prevProps.isSelected === nextProps.isSelected &&
         prevProps.isFocused === nextProps.isFocused &&
         (prevProps.team.record || []).length === (nextProps.team.record || []).length &&
         prevProps.index === nextProps.index;
});

const StandingsTable: React.FC<StandingsTableProps> = memo(({ teams, selectedTeams, onToggleRecord, onToggleSelect }) => {
  const [focusedTeamId, setFocusedTeamId] = useState<number | null>(null);

  const lesteTeams = useMemo(() => teams.filter(t => t.conference === 'East'), [teams]);
  const oesteTeams = useMemo(() => teams.filter(t => t.conference === 'West'), [teams]);
  const flattenedTeams = useMemo(() => [...lesteTeams, ...oesteTeams], [lesteTeams, oesteTeams]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (flattenedTeams.length === 0) return;

    const currentIndex = focusedTeamId !== null 
      ? flattenedTeams.findIndex(t => t.id === focusedTeamId) 
      : -1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, flattenedTeams.length - 1);
        setFocusedTeamId(flattenedTeams[nextIndex === -1 ? 0 : nextIndex].id);
        break;
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        setFocusedTeamId(flattenedTeams[prevIndex].id);
        break;
      case 'Home':
        e.preventDefault();
        setFocusedTeamId(flattenedTeams[0].id);
        break;
      case 'End':
        e.preventDefault();
        setFocusedTeamId(flattenedTeams[flattenedTeams.length - 1].id);
        break;
      case 'Enter':
      case ' ':
        if (focusedTeamId !== null) {
          e.preventDefault();
          onToggleSelect(focusedTeamId);
        }
        break;
    }
  }, [focusedTeamId, flattenedTeams, onToggleSelect]);

  const renderConferenceSection = (title: string, colorClass: string, conferenceTeams: Team[]) => (
    <div className="flex flex-col border-white/10 last:border-l-0 lg:last:border-l">
      <div className={`px-4 md:px-6 py-2 bg-white/5 border-y border-white/10 flex items-center justify-between backdrop-blur-md sticky top-0 z-10`}>
        <h4 className={`text-[10px] md:text-[11px] font-black ${colorClass} uppercase tracking-[0.2em] md:tracking-[0.3em] italic font-mono`}>{title}</h4>
        <span className="text-[8px] md:text-[9px] text-slate-500 font-black uppercase font-mono tracking-widest">{conferenceTeams.length}_ENTITIES</span>
      </div>
      <div className="flex flex-col">
        {conferenceTeams.map((team, idx) => (
          <TeamRow
            key={team.id}
            team={team}
            index={idx}
            isSelected={selectedTeams.includes(team.id)}
            isFocused={focusedTeamId === team.id}
            onToggleSelect={onToggleSelect}
            onToggleRecord={onToggleRecord}
            onFocus={setFocusedTeamId}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div 
      className="bg-black/40 backdrop-blur-xl border-2 border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col glass-morphism focus-within:border-indigo-500/50 transition-colors"
      role="grid"
      aria-label="NBA Standings by Conference"
      onKeyDown={handleKeyDown}
    >
      <div className="table-container custom-scrollbar max-h-[600px] overflow-y-auto">
        <div className="w-full min-w-0">
          <div className="hidden lg:grid sticky top-0 z-30 grid-cols-2 bg-black text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/10 font-mono">
            <div className="grid grid-cols-12 px-6 py-3 border-r border-white/10">
              <div className="col-span-1 border-r border-white/10">#</div>
              <div className="col-span-7 pl-4">EAST_FORCE</div>
              <div className="col-span-4 text-right pr-4 border-l border-white/10 pl-4">SEQUENCE</div>
            </div>
            <div className="grid grid-cols-12 px-6 py-3">
              <div className="col-span-1 border-r border-white/10">#</div>
              <div className="col-span-7 pl-4">WEST_FORCE</div>
              <div className="col-span-4 text-right pr-4 border-l border-white/10 pl-4">SEQUENCE</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2">
            {lesteTeams.length > 0 && renderConferenceSection('EASTERN_CONFERENCE', 'text-indigo-400', lesteTeams)}
            {oesteTeams.length > 0 && renderConferenceSection('WESTERN_CONFERENCE', 'text-orange-400', oesteTeams)}
            {lesteTeams.length === 0 && oesteTeams.length === 0 && (
              <div className="col-span-full">
                {teams.map((team, index) => (
                  <TeamRow
                    key={team.id}
                    team={team}
                    index={index}
                    isSelected={selectedTeams.includes(team.id)}
                    isFocused={focusedTeamId === team.id}
                    onToggleSelect={onToggleSelect}
                    onToggleRecord={onToggleRecord}
                    onFocus={setFocusedTeamId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-3 bg-black/40 border-t border-white/10 flex gap-6 items-center flex-wrap">
        <div className="flex items-center gap-1.5 font-mono">
          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-sm"></div>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">CONF_EAST</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono">
          <div className="w-1.5 h-1.5 bg-orange-500 rounded-sm"></div>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">CONF_WEST</span>
        </div>
        <div className="h-4 w-px bg-white/10 hidden md:block"></div>
        <div className="flex items-center gap-1.5 font-mono">
          <div className="w-3 h-1.5 bg-emerald-500 rounded-sm shadow-[0_0_8px_rgba(16,185,129,0.3)]"></div>
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest italic">WIN</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono">
          <div className="w-3 h-1.5 bg-rose-500 rounded-sm"></div>
          <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest italic">LOSS</span>
        </div>
      </div>
    </div>
  );
});

export default StandingsTable;
