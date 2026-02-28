
import React, { useState } from 'react';
import { Team, MatchupAnalysis } from './types';
import StandingsTable from './components/StandingsTable';
import TeamComparison from './components/TeamComparison';
import ESPNTable from './components/ESPNTable';
import Scoreboard from './components/Scoreboard';
import UnavailablePlayers from './components/UnavailablePlayers';
import MatchupHistory from './components/MatchupHistory';
import TipsDashboard from './components/TipsDashboard';

import { useNBAData } from './hooks/useNBAData';
import { Toaster } from 'sonner';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'tips' | 'history'>('monitor');
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [historySelection, setHistorySelection] = useState<{ teamA: Team, teamB: Team, analysis: MatchupAnalysis } | null>(null);

  const {
    teams,
    sortedTeams,
    playerStats,
    unavailablePlayers,
    dbPredictions,
    loading,
    actions
  } = useNBAData();

  const toggleTeamSelection = (id: number) => {
    setSelectedTeamIds(prev => {
      if (prev.includes(id)) return prev.filter(tid => tid !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const comparisonTeams = React.useMemo(() => {
    if (selectedTeamIds.length !== 2) return null;
    const tA = teams.find(t => t.id === selectedTeamIds[0]);
    const tB = teams.find(t => t.id === selectedTeamIds[1]);
    return tA && tB ? { teamA: tA, teamB: tB } : null;
  }, [selectedTeamIds, teams]);

  const handleViewHistory = (tA: Team, tB: Team, analysis: MatchupAnalysis) => {
    setHistorySelection({ teamA: tA, teamB: tB, analysis });
  };

  return (
    <div className="min-h-screen bg-black text-slate-200 font-sans flex flex-col selection:bg-indigo-500/30">
      <header className="sticky top-0 z-50 bg-black/50 backdrop-blur-xl border-b-2 border-white/10 px-4 py-3 md:px-6 md:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex flex-col -space-y-0.5 md:-space-y-1">
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white font-mono uppercase leading-none">NBA MONITOR</h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] md:text-xs font-bold text-rose-500 font-mono uppercase tracking-[0.2em] md:tracking-[0.3em]">Live Scores & AI Analytics 🏆</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center bg-white/5 rounded-full p-1 border border-white/10 overflow-hidden">
            <button
              onClick={() => setActiveTab('monitor')}
              className={`px-8 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'monitor' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-500 hover:text-white'}`}
            >
              Monitor
            </button>
            <button
              onClick={() => setActiveTab('tips')}
              className={`px-8 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'tips' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'}`}
            >
              Tips
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-8 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-500 hover:text-white'}`}
            >
              Histórico
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <div className="md:hidden flex items-center gap-2 bg-white/5 rounded-lg p-1">
              <button onClick={() => setActiveTab('monitor')} className={`p-2 rounded-md ${activeTab === 'monitor' ? 'bg-orange-500' : ''}`}>📊</button>
              <button onClick={() => setActiveTab('tips')} className={`p-2 rounded-md ${activeTab === 'tips' ? 'bg-indigo-600' : ''}`}>💡</button>
              <button onClick={() => setActiveTab('history')} className={`p-2 rounded-md ${activeTab === 'history' ? 'bg-emerald-600' : ''}`}>📜</button>
            </div>
            {selectedTeamIds.length > 0 && (
              <div className="hidden md:flex items-center gap-2 bg-orange-500/10 px-3 py-1.5 rounded-full border border-orange-500/20 animate-in fade-in slide-in-from-right-4">
                <span className="text-[10px] font-black text-orange-400 font-mono uppercase tracking-widest">{selectedTeamIds.length} / 2 Times</span>
                <button onClick={() => setSelectedTeamIds([])} className="text-orange-400 hover:text-white text-xs font-bold">✕</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-8 flex-1 w-full">
        {activeTab === 'monitor' ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-6">
              <div className="px-2">
                <h2 className="text-3xl md:text-5xl font-black text-white font-mono tracking-tighter italic uppercase border-l-8 border-orange-500 pl-4 shadow-[8px_0_20px_rgba(249,115,22,0.1)]">DASHBOARD_MONITOR</h2>
                <p className="text-slate-500 text-[10px] mt-4 pl-6 font-mono font-black uppercase tracking-[0.4em]">REAL_TIME_ANALYSIS // MOMENTUM_STATS_v2.0</p>
              </div>

              {loading.teams && teams.length === 0 ? (
                <div className="h-64 bg-white/5 animate-pulse rounded-2xl border-2 border-white/10 glass-morphism" />
              ) : (
                <div className="space-y-16">
                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-2 h-2 bg-orange-500 rounded-full shadow-[0_0_12px_#f97316]"></div>
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] font-mono">01_POWER_RANKING_MATRIX</h3>
                    </div>
                    <StandingsTable
                      teams={sortedTeams}
                      selectedTeams={selectedTeamIds}
                      onToggleRecord={actions.handleToggleRecord}
                      onToggleSelect={toggleTeamSelection}
                    />
                  </section>

                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_12px_#6366f1]"></div>
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] font-mono">02_ESPN_PERFORMANCE_LOGS</h3>
                    </div>
                    <ESPNTable teams={sortedTeams} selectedTeams={selectedTeamIds} />
                  </section>

                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_12px_#f43f5e]"></div>
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] font-mono">03_HEALTH_INTEGRITY_REPORT</h3>
                    </div>
                    <UnavailablePlayers
                      players={unavailablePlayers}
                      loading={loading.unavailable}
                      teams={teams}
                      onRefresh={actions.mutateUnavailable}
                    />
                  </section>

                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_12px_#f59e0b]"></div>
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] font-mono">04_STATISTICAL_LEADER_NODES</h3>
                    </div>
                    <div className="max-w-2xl">
                      <Scoreboard
                        playerStats={playerStats}
                        loading={loading.players}
                        teams={teams}
                        onRefresh={actions.mutatePlayers}
                      />
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'tips' ? (
          <TipsDashboard
            teams={teams}
            playerStats={playerStats}
            unavailablePlayers={unavailablePlayers}
            dbPredictions={dbPredictions}
          />
        ) : (
          <MatchupHistory
            teams={teams}
            onViewHistory={handleViewHistory}
          />
        )}
      </main>



      {comparisonTeams && (
        <TeamComparison
          teamA={comparisonTeams.teamA}
          teamB={comparisonTeams.teamB}
          playerStats={playerStats}
          unavailablePlayers={unavailablePlayers}
          onClose={() => setSelectedTeamIds([])}
        />
      )}

      {historySelection && (
        <TeamComparison
          teamA={historySelection.teamA}
          teamB={historySelection.teamB}
          playerStats={playerStats}
          unavailablePlayers={unavailablePlayers}
          initialAnalysis={historySelection.analysis}
          onClose={() => setHistorySelection(null)}
        />
      )}
      <Toaster position="top-right" theme="dark" richColors />
    </div>
  );
};

export default App;
