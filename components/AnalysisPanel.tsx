
import React from 'react';
import { Insight } from '../types';

interface AnalysisPanelProps {
  insights: Insight[];
  loading: boolean;
  onRefresh: () => void;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ insights, loading, onRefresh }) => {
  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 shadow-xl flex flex-col gap-6">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-indigo-400">✨</span> IA Insights
        </h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-[9px] bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2 px-3 rounded-full uppercase tracking-widest transition-all disabled:opacity-50"
        >
          {loading ? '...' : 'Analisar'}
        </button>
      </div>

      <div className="overflow-auto custom-scrollbar max-h-[450px] pr-2 space-y-4">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Relatórios Gerados</p>
        {loading && insights.length === 0 ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="animate-pulse bg-slate-700/50 rounded-lg h-24 w-full"></div>
            ))}
          </div>
        ) : (
          insights.map((insight, idx) => (
            <div 
              key={idx} 
              className={`p-4 rounded-lg border transition-all ${
                insight.type === 'warning' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-indigo-500/10 border-indigo-500/20'
              }`}
            >
              <h3 className="text-slate-100 font-bold text-xs mb-1">{insight.title}</h3>
              <p className="text-slate-400 text-[11px] leading-relaxed">{insight.content}</p>
              {insight.sources && insight.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-2">
                  {insight.sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" className="text-[9px] text-indigo-400 hover:underline truncate max-w-[150px] block">🔗 {s.title}</a>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        
        {!loading && insights.length === 0 && (
          <div className="text-center py-10 opacity-40 text-[10px] font-black uppercase tracking-widest">Aguardando Análise</div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPanel;
