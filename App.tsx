
import React, { useState } from 'react';
import { Team, MatchupAnalysis } from './types';
import StandingsTable from './components/StandingsTable';
import TeamComparison from './components/TeamComparison';
import ESPNTable from './components/ESPNTable';
import Scoreboard from './components/Scoreboard';
import UnavailablePlayers from './components/UnavailablePlayers';
import MatchupHistory from './components/MatchupHistory';
import TipsDashboard from './components/TipsDashboard';
import ChatBot from './components/ChatBot';
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
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col selection:bg-orange-500/30">
      <header className="sticky top-0 z-50 bg-[#1e293b] border-b-2 border-orange-500 shadow-[0_4px_20px_rgba(249,115,22,0.1)] px-4 py-3 md:px-6 md:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex flex-col -space-y-0.5 md:-space-y-1">
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-orange-500 uppercase font-['Inter'] leading-none drop-shadow-md">NBA MONITOR</h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] md:text-xs font-bold text-rose-500 uppercase tracking-[0.2em] md:tracking-[0.3em]">Live Scores & Stats 🏆</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center bg-slate-950/50 rounded-2xl p-1 border border-slate-800 shadow-inner">
            <button
              onClick={() => setActiveTab('monitor')}
              className={`px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'monitor' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-500 hover:text-white'}`}
            >
              Monitor
            </button>
            <button
              onClick={() => setActiveTab('tips')}
              className={`px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'tips' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'}`}
            >
              Tips
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-500 hover:text-white'}`}
            >
              Histórico
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <div className="md:hidden flex items-center gap-2 bg-slate-950 rounded-lg p-1">
              <button onClick={() => setActiveTab('monitor')} className={`p-2 rounded-md ${activeTab === 'monitor' ? 'bg-orange-600' : ''}`}>📊</button>
              <button onClick={() => setActiveTab('tips')} className={`p-2 rounded-md ${activeTab === 'tips' ? 'bg-indigo-600' : ''}`}>💡</button>
              <button onClick={() => setActiveTab('history')} className={`p-2 rounded-md ${activeTab === 'history' ? 'bg-emerald-600' : ''}`}>📜</button>
            </div>
            {selectedTeamIds.length > 0 && (
              <div className="hidden md:flex items-center gap-2 bg-orange-500/10 px-3 py-1.5 rounded-full border border-orange-500/20 animate-in fade-in slide-in-from-right-4">
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{selectedTeamIds.length} / 2 Times</span>
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
                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter italic uppercase border-l-4 border-orange-500 pl-4">Dashboard Monitor</h2>
                <p className="text-slate-500 text-sm mt-2 pl-5">Análise em tempo real: <span className="text-orange-400 font-bold underline decoration-2 underline-offset-4">Momento Recente & Estatísticas Detalhadas</span></p>
              </div>

              {loading.teams && teams.length === 0 ? (
                <div className="h-64 bg-slate-800/20 animate-pulse rounded-2xl border border-slate-800" />
              ) : (
                <div className="space-y-12">
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div>
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">01. Power Ranking</h3>
                    </div>
                    <StandingsTable
                      teams={sortedTeams}
                      selectedTeams={selectedTeamIds}
                      onToggleRecord={actions.handleToggleRecord}
                      onToggleSelect={toggleTeamSelection}
                    />
                  </section>

                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">02. Performance ESPN</h3>
                    </div>
                    <ESPNTable teams={sortedTeams} selectedTeams={selectedTeamIds} />
                  </section>

                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.5)]"></div>
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">03. Relatório de Lesões</h3>
                    </div>
                    <UnavailablePlayers
                      players={unavailablePlayers}
                      loading={loading.unavailable}
                      teams={teams}
                      onRefresh={actions.mutateUnavailable}
                    />
                  </section>

                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">04. Líderes de Estatísticas</h3>
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

      <ChatBot />

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
