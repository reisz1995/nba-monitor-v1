import React, { memo } from 'react';
import { List, RowComponentProps } from 'react-window';
import { Team } from '../types';
import { Clock, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

export interface AnalysisRecord {
  id: number;
  team_a_id: number;
  team_b_id: number;
  winner: string;
  confidence: number;
  key_factor: string;
  detailed_analysis: string;
  sources: any[];
  result: 'green' | 'red' | 'pending';
  momentum_ma?: any;
  created_at: string;
}

interface VirtualizedTableProps {
  records: AnalysisRecord[];
  teams: Team[];
  onItemClick: (record: AnalysisRecord) => void;
  onUpdateStatus: (e: React.MouseEvent, id: number, status: 'green' | 'red' | 'pending') => void;
  onDeleteRecord: (e: React.MouseEvent, id: number) => void;
  rowHeight?: number;
  height?: number;
}

const HistoryRow = memo(({
  record,
  teams,
  onItemClick,
  onUpdateStatus,
  onDeleteRecord,
  style
}: {
  record: AnalysisRecord;
  teams: Team[];
  onItemClick: (record: AnalysisRecord) => void;
  onUpdateStatus: (e: React.MouseEvent, id: number, status: 'green' | 'red' | 'pending') => void;
  onDeleteRecord: (e: React.MouseEvent, id: number) => void;
  style: React.CSSProperties;
}) => {
  // ✅ Proteção crucial no início
  if (!record || !Array.isArray(teams)) {
    return <div style={style} className="h-full bg-slate-950/50" />;
  }

  const teamA = teams.find(t => t?.id === record.team_a_id);
  const teamB = teams.find(t => t?.id === record.team_b_id);

  if (!teamA || !teamB) {
    return <div style={style} className="h-full bg-slate-950/50" />;
  }

  return (
    <div
      style={style}
      onClick={() => onItemClick(record)}
      className="flex items-center border-b border-slate-900 hover:bg-white/[0.02] transition-all group cursor-pointer w-full min-w-[900px]"
    >
      <div className="w-[35%] px-6 py-4 flex items-center gap-5">
        <div className="flex items-center -space-x-4">
          <div className="w-12 h-12 bg-slate-900 border-2 border-slate-800 p-2 transform -rotate-3 group-hover:rotate-0 transition-transform shadow-lg overflow-hidden flex items-center justify-center">
            {teamA?.logo && <img src={teamA.logo} className="max-w-full max-h-full object-contain" alt="" />}
          </div>
          <div className="w-12 h-12 bg-slate-900 border-2 border-slate-800 p-2 transform rotate-6 group-hover:rotate-0 transition-transform shadow-lg z-10 overflow-hidden flex items-center justify-center">
            {teamB?.logo && <img src={teamB.logo} className="max-w-full max-h-full object-contain" alt="" />}
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-base font-black uppercase tracking-tighter leading-none mb-1 text-slate-100 font-mono">
            {teamA?.name} <span className="text-slate-700 text-xs">VS</span> {teamB?.name}
          </span>
          <span className="text-[9px] text-slate-600 font-extrabold uppercase tracking-widest flex items-center gap-2 mb-2 font-mono">
            <Clock className="w-2.5 h-2.5" /> {new Date(record.created_at).toLocaleDateString('pt-BR')} {new Date(record.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>

          {record.momentum_ma && typeof record.momentum_ma === 'object' && !Array.isArray(record.momentum_ma) && (
            <div className="flex gap-2 items-center">
              <div className="flex -space-x-1">
                {(record.momentum_ma.home_record || []).slice(-3).map((g: any, idx: number) => (
                  g && (
                    <div key={idx} className={`w-4 h-6 border border-black flex flex-col items-center justify-center ${g.result === 'V' ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                      <span className={`text-[7px] font-black font-mono ${g.result === 'V' ? 'text-emerald-400' : 'text-rose-400'}`}>{g.result || '?'}</span>
                      <span className="text-[5px] text-zinc-500 leading-none font-mono">{g.score?.split('-')[0] || '-'}</span>
                    </div>
                  )
                ))}
              </div>
              <div className="w-[1px] h-4 bg-slate-800"></div>
              <div className="flex -space-x-1">
                {(record.momentum_ma.away_record || []).slice(-3).map((g: any, idx: number) => (
                  g && (
                    <div key={idx} className={`w-4 h-6 border border-black flex flex-col items-center justify-center ${g.result === 'V' ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                      <span className={`text-[7px] font-black font-mono ${g.result === 'V' ? 'text-emerald-400' : 'text-rose-400'}`}>{g.result || '?'}</span>
                      <span className="text-[5px] text-zinc-500 leading-none font-mono">{g.score?.split('-')[0] || '-'}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="w-[25%] px-6 py-4 flex flex-col gap-1">
        <span className="text-sm font-black text-indigo-400 italic uppercase leading-none border-l-2 border-indigo-500/30 pl-3 font-mono">
          {record.winner}
        </span>
        <p className="text-[10px] text-slate-500 font-bold uppercase leading-tight pl-3 line-clamp-2 font-mono">
          {record.key_factor}
        </p>
      </div>
      
      <div className="w-[20%] px-6 py-4 flex items-center justify-center gap-1.5">
        <button
          onClick={(e) => onUpdateStatus(e, record.id, 'green')}
          className={`w-10 h-10 border-2 transition-all flex items-center justify-center ${record.result === 'green'
            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
            : 'bg-slate-950 border-slate-800 text-slate-800 hover:border-emerald-500/50'
            }`}
        >
          <CheckCircle2 className="w-5 h-5" />
        </button>
        <button
          onClick={(e) => onUpdateStatus(e, record.id, 'red')}
          className={`w-10 h-10 border-2 transition-all flex items-center justify-center ${record.result === 'red'
            ? 'bg-rose-600/20 border-rose-500 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
            : 'bg-slate-950 border-slate-800 text-slate-800 hover:border-rose-500/50'
            }`}
        >
          <XCircle className="w-5 h-5" />
        </button>
        <button
          onClick={(e) => onUpdateStatus(e, record.id, 'pending')}
          className={`w-10 h-10 border-2 transition-all flex items-center justify-center ${record.result === 'pending'
            ? 'bg-amber-600/20 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
            : 'bg-slate-950 border-slate-800 text-slate-800 hover:border-amber-500/50'
            }`}
        >
          <Clock className="w-5 h-5" />
        </button>
      </div>
      
      <div className="w-[10%] px-6 py-4 text-center">
        <div className="inline-block px-3 py-1 bg-slate-900 border border-slate-800 rounded-sm">
          <span className="text-base font-black text-white italic font-mono">
            {record.confidence}<span className="text-[10px] text-slate-600 not-italic ml-0.5 font-sans">%</span>
          </span>
        </div>
      </div>
      
      <div className="w-[10%] px-6 py-4 text-center">
        <button
          onClick={(e) => onDeleteRecord(e, record.id)}
          className="p-2 text-slate-800 hover:text-rose-500 transition-colors transform hover:scale-110"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.record.id === nextProps.record.id &&
         prevProps.record.result === nextProps.record.result;
});

interface RowData {
  records: AnalysisRecord[];
  teams: Team[];
  onItemClick: (record: AnalysisRecord) => void;
  onUpdateStatus: (e: React.MouseEvent, id: number, status: 'green' | 'red' | 'pending') => void;
  onDeleteRecord: (e: React.MouseEvent, id: number) => void;
}

const Row = memo(({ index, style, records, teams, onItemClick, onUpdateStatus, onDeleteRecord }: RowComponentProps<RowData>) => {
  // ✅ Proteção contra arrays inválidos
  if (!Array.isArray(records) || !Array.isArray(teams)) {
    return null;
  }
  
  const record = records[index];

  if (!record) return null;

  return (
    <HistoryRow
      record={record}
      teams={teams}
      onItemClick={onItemClick}
      onUpdateStatus={onUpdateStatus}
      onDeleteRecord={onDeleteRecord}
      style={style}
    />
  );
});

const VirtualizedTable = memo(({
  records = [],
  teams = [],
  onItemClick,
  onUpdateStatus,
  onDeleteRecord,
  rowHeight = 120,
  height = 600
}: VirtualizedTableProps) => {
  
  // ✅ Garantir arrays válidos
  const safeRecords = Array.isArray(records) ? records : [];
  const safeTeams = Array.isArray(teams) ? teams : [];
  
  const rowProps = React.useMemo(() => ({
    records: safeRecords,
    teams: safeTeams,
    onItemClick,
    onUpdateStatus,
    onDeleteRecord
  }), [safeRecords, safeTeams, onItemClick, onUpdateStatus, onDeleteRecord]);

  // ✅ Proteção: não renderizar List se dados inválidos
  if (!Array.isArray(records) || !Array.isArray(teams)) {
    return <div className="py-20 text-center text-slate-500">Carregando dados...</div>;
  }

  return (
    <div className="w-full min-w-[900px]">
      <div className="flex bg-slate-900/80 backdrop-blur-md text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b-2 border-slate-800 font-mono">
        <div className="w-[35%] px-6 py-4">CONFRONTATION</div>
        <div className="w-[25%] px-6 py-4">AI SELECTION</div>
        <div className="w-[20%] px-6 py-4 text-center">RESULT</div>
        <div className="w-[10%] px-6 py-4 text-center">CONFIDENCE</div>
        <div className="w-[10%] px-6 py-4 text-center">ACTIONS</div>
      </div>
      <List
        height={height}
        rowCount={safeRecords.length}
        rowHeight={rowHeight}
        width={900}
        rowProps={rowProps}
        rowComponent={Row}
        className="custom-scrollbar"
      />
    </div>
  );
});

export default VirtualizedTable;
