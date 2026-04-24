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
  pick_total?: string;
  created_at: string;
}

const TEAM_ABBR: Record<string, string> = {
  'Thunder': 'OKC', 'Pistons': 'DET', 'Spurs': 'SAS', 'Nuggets': 'DEN',
  'Timberwolves': 'MIN', 'Lakers': 'LAL', 'Celtics': 'BOS', 'Knicks': 'NYK',
  'Rockets': 'HOU', 'Suns': 'PHX', 'Raptors': 'TOR', '76ers': 'PHI',
  'Cavaliers': 'CLE', 'Warriors': 'GSW', 'Magic': 'ORL', 'Heat': 'MIA',
  'Trail Blazers': 'POR', 'Hawks': 'ATL', 'Bulls': 'CHI', 'Bucks': 'MIL',
  'Grizzlies': 'MEM', 'Clippers': 'LAC', 'Hornets': 'CHA', 'Mavericks': 'DAL',
  'Jazz': 'UTA', 'Nets': 'BKN', 'Wizards': 'WAS', 'Pelicans': 'NOP',
  'Kings': 'SAC', 'Pacers': 'IND'
};

const getAbbr = (name: string) => TEAM_ABBR[name] || name.substring(0, 3).toUpperCase();

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
      className="flex flex-col md:flex-row md:items-center border-b border-slate-900 hover:bg-white/[0.02] transition-all group cursor-pointer w-full"
    >
      <div className="w-full md:w-[30%] px-4 md:px-6 py-3 md:py-4 flex items-center gap-4 md:gap-5">
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
            {getAbbr(teamA?.name || '')} <span className="text-slate-700 text-xs mx-1">VS</span> {getAbbr(teamB?.name || '')}
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

      <div className="w-full md:w-[20%] px-4 md:px-6 py-2 md:py-4 flex flex-col gap-1">
        <span className="text-xs md:sm font-black text-indigo-400 italic uppercase leading-none border-l-2 border-indigo-500/30 pl-3 font-mono">
          {getAbbr(record.winner)}
        </span>
        <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase leading-tight pl-3 line-clamp-1 md:line-clamp-2 font-mono">
          {record.key_factor}
        </p>
      </div>

      <div className="w-full md:w-[12%] px-4 md:px-4 py-2 md:py-4 flex items-center justify-start md:justify-center">
        {record.pick_total ? (
          <span className={`text-[9px] md:text-[10px] font-black uppercase px-2 py-1 border-2 font-mono tracking-tight ${record.pick_total.startsWith('PREV_OVER')
              ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
              : record.pick_total.startsWith('PREV_UNDER')
                ? 'bg-rose-600/20 border-rose-500 text-rose-400'
                : 'bg-slate-700/30 border-slate-600 text-slate-400'
            }`}>
            {record.pick_total}
          </span>
        ) : (
          <span className="text-[8px] text-slate-700 font-mono">NO_PICK</span>
        )}
      </div>

      <div className="w-full md:w-[18%] px-4 md:px-6 py-2 md:py-4 flex items-center justify-between md:justify-center gap-1.5 border-t md:border-t-0 border-white/5 mt-2 md:mt-0 pt-2 md:pt-0">
        <div className="flex md:hidden items-center gap-4">
            <div className="inline-block px-3 py-1 bg-slate-900 border border-slate-800 rounded-sm">
                <span className="text-sm font-black text-white italic font-mono">
                    {record.confidence}<span className="text-[8px] text-slate-600 not-italic ml-0.5 font-sans">%</span>
                </span>
            </div>
            <button
                onClick={(e) => onDeleteRecord(e, record.id)}
                className="p-2 text-slate-800 hover:text-rose-500 transition-colors"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
        <div className="flex items-center gap-1.5">
            <button
            onClick={(e) => onUpdateStatus(e, record.id, 'green')}
            className={`w-8 h-8 md:w-10 md:h-10 border-2 transition-all flex items-center justify-center ${record.result === 'green'
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-glow-success'
                : 'bg-slate-950 border-slate-800 text-slate-800 hover:border-emerald-500/50'
                }`}
            >
            <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
            onClick={(e) => onUpdateStatus(e, record.id, 'red')}
            className={`w-8 h-8 md:w-10 md:h-10 border-2 transition-all flex items-center justify-center ${record.result === 'red'
                ? 'bg-rose-600/20 border-rose-500 text-rose-400 shadow-glow-error'
                : 'bg-slate-950 border-slate-800 text-slate-800 hover:border-rose-500/50'
                }`}
            >
            <XCircle className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
            onClick={(e) => onUpdateStatus(e, record.id, 'pending')}
            className={`w-8 h-8 md:w-10 md:h-10 border-2 transition-all flex items-center justify-center ${record.result === 'pending'
                ? 'bg-amber-600/20 border-amber-500 text-amber-400 shadow-glow-gold'
                : 'bg-slate-950 border-slate-800 text-slate-800 hover:border-amber-500/50'
                }`}
            >
            <Clock className="w-4 h-4 md:w-5 md:h-5" />
            </button>
        </div>
      </div>

      <div className="hidden md:flex w-[10%] px-6 py-4 text-center items-center justify-center">
        <div className="inline-block px-3 py-1 bg-slate-900 border border-slate-800 rounded-sm">
          <span className="text-base font-black text-white italic font-mono">
            {record.confidence}<span className="text-[10px] text-slate-600 not-italic ml-0.5 font-sans">%</span>
          </span>
        </div>
      </div>

      <div className="hidden md:flex w-[10%] px-6 py-4 text-center items-center justify-center">
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

  const [containerWidth, setContainerWidth] = React.useState(1050);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
    }
    const handleResize = () => {
        if (containerRef.current) {
            setContainerWidth(containerRef.current.offsetWidth);
        }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = containerWidth < 768;
  const effectiveRowHeight = isMobile ? 220 : rowHeight;

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
    <div ref={containerRef} className="w-full">
      <div className="hidden md:flex bg-slate-900/80 backdrop-blur-md text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b-2 border-slate-800 font-mono">
        <div className="w-[30%] px-6 py-4">CONFRONTATION</div>
        <div className="w-[20%] px-6 py-4">AI SELECTION</div>
        <div className="w-[12%] px-4 py-4 text-center">PICK TOTAL</div>
        <div className="w-[18%] px-6 py-4 text-center">RESULT</div>
        <div className="w-[10%] px-6 py-4 text-center">CONFIDENCE</div>
        <div className="w-[10%] px-6 py-4 text-center">ACTIONS</div>
      </div>
      <List
        height={height}
        rowCount={safeRecords.length}
        rowHeight={effectiveRowHeight}
        width={containerWidth}
        rowProps={rowProps}
        rowComponent={Row}
        className="custom-scrollbar"
      />
    </div>
  );
});

export default VirtualizedTable;
