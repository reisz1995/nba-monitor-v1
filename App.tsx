
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
    <div className="min-h-screen bg-nba-background text-white font-sans flex flex-col selection:bg-nba-blue/30">
      <header className="sticky top-0 z-50 bg-nba-surface border-b border-nba-surface-elevated shadow-[0_4px_20px_rgba(0,0,0,0.5)] px-4 py-3 md:px-6 md:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex flex-col -space-y-0.5 md:-space-y-1">
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white font-oswald uppercase leading-none">NBA MONITOR</h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] md:text-xs font-bold text-nba-red font-oswald uppercase tracking-[0.2em] md:tracking-[0.3em]">Live Scores & AI Analytics</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center bg-nba-surface-elevated rounded-sm p-1 border border-white/5 overflow-hidden">
            <button
              onClick={() => setActiveTab('monitor')}
              className={`px-8 py-2 rounded-sm text-[10px] font-oswald font-black uppercase tracking-widest transition-all ${activeTab === 'monitor' ? 'bg-nba-blue text-white shadow-[0_0_15px_rgba(29,66,138,0.5)]' : 'text-slate-400 hover:text-white'}`}
            >
              Monitor
            </button>
            <button
              onClick={() => setActiveTab('tips')}
              className={`px-8 py-2 rounded-sm text-[10px] font-oswald font-black uppercase tracking-widest transition-all ${activeTab === 'tips' ? 'bg-nba-red text-white shadow-[0_0_15px_rgba(200,16,46,0.5)]' : 'text-slate-400 hover:text-white'}`}
            >
              Tips
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-8 py-2 rounded-sm text-[10px] font-oswald font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-nba-gold text-nba-black shadow-[0_0_15px_rgba(255,215,0,0.4)]' : 'text-slate-400 hover:text-white'}`}
            >
              Histórico
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <div className="md:hidden flex items-center gap-2 bg-nba-surface-elevated rounded-sm p-1 border border-white/5">
              <button onClick={() => setActiveTab('monitor')} className={`px-3 py-1.5 rounded-sm font-oswald text-xs font-bold uppercase transition-colors ${activeTab === 'monitor' ? 'bg-nba-blue text-white' : 'text-slate-400'}`}>Mon</button>
              <button onClick={() => setActiveTab('tips')} className={`px-3 py-1.5 rounded-sm font-oswald text-xs font-bold uppercase transition-colors ${activeTab === 'tips' ? 'bg-nba-red text-white' : 'text-slate-400'}`}>Tips</button>
              <button onClick={() => setActiveTab('history')} className={`px-3 py-1.5 rounded-sm font-oswald text-xs font-bold uppercase transition-colors ${activeTab === 'history' ? 'bg-nba-gold text-nba-black' : 'text-slate-400'}`}>Hist</button>
            </div>
            {selectedTeamIds.length > 0 && (
              <div className="hidden md:flex items-center gap-2 bg-nba-blue/10 px-3 py-1.5 rounded-sm border border-nba-blue/30 animate-in fade-in slide-in-from-right-4">
                <span className="text-[10px] font-black text-nba-blue font-oswald uppercase tracking-widest">{selectedTeamIds.length} / 2 Times</span>
                <button onClick={() => setSelectedTeamIds([])} className="text-nba-blue hover:text-white text-xs font-bold">✕</button>
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
                <h2 className="text-3xl md:text-5xl font-black text-white font-oswald tracking-tighter italic uppercase border-l-4 border-nba-red pl-4">DASHBOARD_MONITOR</h2>
                <p className="text-slate-500 text-[10px] mt-4 pl-6 font-mono font-black uppercase tracking-[0.4em]">REAL_TIME_ANALYSIS // MOMENTUM_STATS_v2.0</p>
              </div>

              {loading.teams && teams.length === 0 ? (
                <div className="h-64 bg-nba-surface animate-pulse rounded-sm border border-nba-surface-elevated" />
              ) : (
                <div className="space-y-16">
                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-2 h-2 bg-nba-blue shadow-[0_0_12px_rgba(29,66,138,0.5)]"></div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] font-oswald">01_POWER_RANKING_MATRIX</h3>
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
                      <div className="w-2 h-2 bg-nba-red shadow-[0_0_12px_rgba(200,16,46,0.5)]"></div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] font-oswald">02_ESPN_PERFORMANCE_LOGS</h3>
                    </div>
                    <ESPNTable teams={sortedTeams} selectedTeams={selectedTeamIds} />
                  </section>

                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-2 h-2 bg-nba-gold shadow-[0_0_12px_rgba(255,215,0,0.5)]"></div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] font-oswald">03_HEALTH_INTEGRITY_REPORT</h3>
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
                      <div className="w-2 h-2 bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]"></div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] font-oswald">04_STATISTICAL_LEADER_NODES</h3>
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
