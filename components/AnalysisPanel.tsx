
import React from 'react';
import { Insight } from '../types';

interface AnalysisPanelProps {
  insights: Insight[];
  loading: boolean;
  onRefresh: () => void;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ insights, loading, onRefresh }) => {
  return (
    <div className="bg-black/40 backdrop-blur-xl border-2 border-white/10 rounded-xl p-6 shadow-2xl flex flex-col gap-6 glass-morphism h-full">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-widest italic font-mono">
          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_10px_#6366f1]"></span>
          DETECTOR_IA_INSIGHTS
        </h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-[9px] bg-white hover:bg-indigo-500 text-black hover:text-white font-black py-2 px-4 rounded-full uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer border-2 border-transparent hover:border-white shadow-[0_0_15px_rgba(255,255,255,0.1)] font-mono"
        >
          {loading ? 'SYNCING...' : 'RUN_ANALYSIS'}
        </button>
      </div>

      <div className="overflow-auto custom-scrollbar flex-1 pr-2 space-y-4">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 font-mono">NODES_GENERATED // QUANTUM_REPORT</p>

        {loading && insights.length === 0 ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="animate-pulse bg-white/5 border-2 border-white/5 rounded-lg h-24 w-full glass-morphism"></div>
            ))}
          </div>
        ) : (
          insights.map((insight, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border-2 transition-all shadow-[4px_4px_0px_#000] font-mono group ${insight.type === 'warning' ? 'bg-rose-500/10 border-rose-500/30' : 'bg-black border-white/10'
                }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-1 h-3 ${insight.type === 'warning' ? 'bg-rose-500' : 'bg-indigo-500'}`}></div>
                <h3 className="text-white font-black text-[10px] uppercase tracking-tighter truncate">{insight.title}</h3>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed font-bold">{insight.content}</p>
              {insight.sources && insight.sources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-2">
                  {insight.sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" className="text-[9px] text-indigo-400 hover:text-white hover:underline truncate max-w-[150px] block font-black uppercase tracking-tighter">REF_{i + 1}: {s.title}</a>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {!loading && insights.length === 0 && (
          <div className="text-center py-20 opacity-30 text-[10px] font-black uppercase tracking-[0.5em] font-mono animate-pulse">
            IDLE_WAIT_FOR_PROMPT
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPanel;
