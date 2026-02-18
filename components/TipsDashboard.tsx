
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { Team, PlayerStat, PalpiteData, NotaData } from '../types';
import TeamComparison from './TeamComparison';
import { supabase } from '../lib/supabase';
import {
  Trophy,
  Target,
  Users,
  ChevronRight,
  Download,
  Save,
  Plus,
  Trash2,
  Zap,
  AlertCircle,
  Database,
  Calendar,
  LayoutDashboard,
  BrainCircuit
} from 'lucide-react';

interface TipsDashboardProps {
  teams: Team[];
  playerStats: PlayerStat[];
  unavailablePlayers: any[];
  dbPredictions?: any[];
}

const TipsDashboard: React.FC<TipsDashboardProps> = ({ playerStats, teams, unavailablePlayers, dbPredictions }) => {
  const isB2B = useCallback((teamName: string, dateStr: string) => {
    if (!dbPredictions || !teamName) return { yesterday: false, tomorrow: false };

    const [d, m, y] = dateStr.split('/');
    const current = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));

    const yesterday = new Date(current);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];

    const tomorrow = new Date(current);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tStr = tomorrow.toISOString().split('T')[0];

    const playedYesterday = dbPredictions.some(p =>
      (p.home_team.toLowerCase().includes(teamName.toLowerCase()) ||
        p.away_team.toLowerCase().includes(teamName.toLowerCase())) &&
      p.date === yStr
    );

    const playsTomorrow = dbPredictions.some(p =>
      (p.home_team.toLowerCase().includes(teamName.toLowerCase()) ||
        p.away_team.toLowerCase().includes(teamName.toLowerCase())) &&
      p.date === tStr
    );

    return { yesterday: playedYesterday, tomorrow: playsTomorrow };
  }, [dbPredictions]);

  const getFormattedDate = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const [tipsDate, setTipsDate] = useState(getFormattedDate(new Date()));
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingNotas, setIsSavingNotas] = useState(false);
  const [isSavingPalpites, setIsSavingPalpites] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const [predictions, setPredictions] = useState<PalpiteData[]>([]);
  const [tierScores, setTierScores] = useState<Record<string, string>>({});
  const [dbNotas, setDbNotas] = useState<NotaData[]>([]);
  const [matchToAnalyze, setMatchToAnalyze] = useState<{ teamA: Team, teamB: Team } | null>(null);

  const fetchNotas = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('tabela_notas').select('*');
      if (!error && data) {
        setDbNotas(data);
        const scoreMap: Record<string, string> = {};
        data.forEach((n: NotaData) => {
          scoreMap[n.franquia] = n.nota_ia;
        });
        setTierScores(scoreMap);
      }
    } catch (err) {
      console.error("Erro ao carregar notas:", err);
    }
  }, []);

  const fetchPalpites = useCallback(async () => {
    const [d, m, y] = tipsDate.split('/');
    const isoDate = `${y}-${m}-${d}`;

    try {
      const { data, error } = await supabase
        .from('painel_palpites')
        .select('*')
        .eq('data_jogo', isoDate)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setPredictions(data);
      } else {
        setPredictions([]);
      }
    } catch (err) {
      console.error("Erro ao carregar palpites:", err);
    }
  }, [tipsDate]);

  useEffect(() => {
    fetchNotas();
    fetchPalpites();
  }, [fetchNotas, fetchPalpites]);

  const findTeam = (name: string) => {
    if (!name) return null;
    const clean = name.toLowerCase().trim();
    return teams.find(t =>
      t.name.toLowerCase() === clean ||
      t.name.toLowerCase().includes(clean) ||
      clean.includes(t.name.toLowerCase())
    );
  };

  const getTeamLogo = (teamName: string) => {
    const team = findTeam(teamName);
    return team?.logo || 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nba.png';
  };

  const getTeamScore = (name: string) => tierScores[name] || '-';

  const handleLocalScoreChange = (franquia: string, nota: string) => {
    setTierScores(prev => ({ ...prev, [franquia]: nota }));
  };

  const handleSaveAllNotas = async () => {
    setIsSavingNotas(true);
    try {
      const entries = Object.entries(tierScores);
      for (const [franquia, nota_ia] of entries) {
        const existing = dbNotas.find(n => n.franquia === franquia);
        if (existing) {
          await supabase.from('tabela_notas').update({ nota_ia }).eq('id', existing.id);
        } else if (nota_ia !== '-') {
          await supabase.from('tabela_notas').insert([{ franquia, nota_ia, criterio: 'Power Ranking 2026' }]);
        }
      }
      await fetchNotas();
      alert('Tabela de Notas sincronizada!');
    } catch (error) {
      console.error('Erro ao salvar notas:', error);
      alert('Falha na sincronização.');
    } finally {
      setIsSavingNotas(false);
    }
  };

  const handleLocalPredictionChange = (id: number, field: keyof PalpiteData, value: string) => {
    setPredictions(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, [field]: value };
        if (field === 'time_casa') {
          const team = findTeam(value);
          updated.n_casa = team ? getTeamScore(team.name) : '-';
        } else if (field === 'time_fora') {
          const team = findTeam(value);
          updated.n_fora = team ? getTeamScore(team.name) : '-';
        }
        return updated;
      }
      return p;
    }));
  };

  const handleSaveAllPalpites = async () => {
    setIsSavingPalpites(true);
    try {
      for (const pred of predictions) {
        if (pred.id) {
          const { error } = await supabase
            .from('painel_palpites')
            .update({
              time_casa: pred.time_casa,
              time_fora: pred.time_fora,
              palpite_principal: pred.palpite_principal,
              over_line: pred.over_line,
              under_line: pred.under_line,
              p_combinados: pred.p_combinados,
              confianca: pred.confianca,
              n_casa: pred.n_casa,
              n_fora: pred.n_fora
            })
            .eq('id', pred.id);
          if (error) throw error;
        }
      }
      alert('Alterações no Painel salvas!');
    } catch (error) {
      console.error('Erro ao salvar palpites:', error);
      alert('Erro ao salvar alterações.');
    } finally {
      setIsSavingPalpites(false);
    }
  };

  // NOVA FUNÇÃO: Importar de game_predictions
  const handleImportFromIA = async () => {
    const [d, m, y] = tipsDate.split('/');
    const isoDate = `${y}-${m}-${d}`;

    setIsImporting(true);
    try {
      const { data: aiData, error } = await supabase
        .from('game_predictions')
        .select('*')
        .eq('date', isoDate);

      if (error) throw error;
      if (!aiData || aiData.length === 0) {
        alert('Nenhum dado da IA encontrado para esta data.');
        return;
      }

      const imports = aiData.map(ai => {
        const teamCasa = findTeam(ai.home_team);
        const teamFora = findTeam(ai.away_team);

        return {
          data_jogo: isoDate,
          time_casa: ai.home_team,
          time_fora: ai.away_team,
          palpite_principal: ai.main_pick || '-',
          over_line: ai.over_line || '-',
          under_line: ai.under_line || '-',
          p_combinados: ai.prediction?.total_score || '-',
          confianca: ai.confidence ? `${ai.confidence}%` : '-',
          n_casa: teamCasa ? getTeamScore(teamCasa.name) : '-',
          n_fora: teamFora ? getTeamScore(teamFora.name) : '-'
        };
      });

      const { data: inserted, error: insError } = await supabase
        .from('painel_palpites')
        .insert(imports)
        .select();

      if (insError) throw insError;

      // Atualiza lista local
      if (inserted) {
        setPredictions(prev => [...prev, ...inserted]);
      }

      alert(`${aiData.length} registros importados da IA com sucesso!`);
    } catch (err) {
      console.error('Erro na importação:', err);
      alert('Erro ao importar dados da IA.');
    } finally {
      setIsImporting(false);
    }
  };

  const addPredictionRow = async () => {
    const [d, m, y] = tipsDate.split('/');
    const isoDate = `${y}-${m}-${d}`;

    const newRow: Omit<PalpiteData, 'id' | 'created_at'> = {
      data_jogo: isoDate,
      time_casa: '',
      time_fora: '',
      palpite_principal: '',
      over_line: '',
      under_line: '',
      p_combinados: '-',
      confianca: '',
      n_casa: '-',
      n_fora: '-'
    };

    try {
      const { data, error } = await supabase.from('painel_palpites').insert([newRow]).select();
      if (error) throw error;
      if (data && data.length > 0) setPredictions(prev => [...prev, data[0]]);
    } catch (error) {
      console.error('Erro ao criar palpite:', error);
    }
  };

  const removePredictionRow = async (id: number) => {
    try {
      const { error } = await supabase.from('painel_palpites').delete().eq('id', id);
      if (error) throw error;
      setPredictions(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error("Erro ao deletar palpite:", error);
    }
  };

  const exportAsImage = async () => {
    if (!tableRef.current) return;
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      const dataUrl = await toPng(tableRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });
      const link = document.createElement('a');
      link.download = `nba-tips-${tipsDate.replace(/\//g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao exportar:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const categorizedNotes = useMemo(() => {
    const tierData = teams.map(t => ({
      name: t.name,
      score: getTeamScore(t.name)
    })).sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0));

    return {
      TOP: tierData.filter(t => (parseFloat(t.score) || 0) >= 4.5),
      BOM: tierData.filter(t => (parseFloat(t.score) || 0) >= 4.0 && (parseFloat(t.score) || 0) < 4.5),
      REGULAR: tierData.filter(t => (parseFloat(t.score) || 0) >= 3.0 && (parseFloat(t.score) || 0) < 4.0),
      RUINS: tierData.filter(t => (parseFloat(t.score) || 0) < 3.0)
    };
  }, [teams, tierScores]);

  const renderTierRows = (items: { name: string, score: string }[], label: string) => {
    if (items.length === 0) return null;
    return (
      <>
        <tr className="bg-slate-900/80">
          <td colSpan={2} className="py-2 px-8 text-left text-slate-500 font-mono text-[10px] uppercase tracking-[0.3em] bg-slate-950/50 border-y border-slate-800/50">
            {label}
          </td>
        </tr>
        {items.map((item) => (
          <tr key={item.name} className="border-b border-slate-800/40 hover:bg-red-600/[0.03] transition-all group">
            <td className="px-8 py-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded flex items-center justify-center p-1.5 group-hover:border-red-600/30 transition-colors">
                <img src={getTeamLogo(item.name)} className="w-full h-full object-contain grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all" alt="" />
              </div>
              <span className="text-slate-100 font-mono font-bold text-sm uppercase tracking-tight">{item.name}</span>
            </td>
            <td className="px-8 py-3 text-center">
              <input
                type="text"
                value={item.score}
                onChange={(e) => handleLocalScoreChange(item.name, e.target.value)}
                className="bg-slate-950 text-red-500 font-mono font-black text-center text-lg w-24 px-2 py-1.5 border-2 border-slate-800 focus:border-red-600 rounded-none outline-none transition-all shadow-[4px_4px_0px_0px_rgba(220,38,38,0.1)] focus:shadow-[4px_4px_0px_0px_rgba(220,38,38,0.3)]"
                placeholder="-"
              />
            </td>
          </tr>
        ))}
      </>
    );
  };

  const playersPlayingToday = useMemo(() => {
    const activeTeams = new Set(
      predictions.flatMap(p => [p.time_casa.toLowerCase().trim(), p.time_fora.toLowerCase().trim()]).filter(Boolean)
    );
    return [...playerStats]
      .filter(p => activeTeams.has(p.time.toLowerCase().trim()))
      .sort((a, b) => b.pontos - a.pontos);
  }, [playerStats, predictions]);

  return (
    <div className="flex flex-col gap-20 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 font-mono">

      {/* SEÇÃO 1: TABELA DE NOTAS */}
      <section className="space-y-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-6 border-b-4 border-red-600 pb-6">
            <div className="flex items-center gap-6">
              <div className="bg-red-600 p-3 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">
                  Power <span className="text-red-600 underline decoration-white/20 underline-offset-8">Ranking</span>
                </h3>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
                  <Database className="w-3 h-3" /> DATABASE: tabela_notas
                </p>
              </div>
            </div>
            <button
              onClick={handleSaveAllNotas}
              disabled={isSavingNotas}
              className="bg-slate-900 border-2 border-red-600 hover:bg-red-600 text-white text-xs font-black px-8 py-4 uppercase tracking-widest transition-all active:translate-x-1 active:translate-y-1 shadow-[6px_6px_0px_0px_rgba(220,38,38,0.2)] hover:shadow-none flex items-center gap-3 disabled:opacity-50"
            >
              {isSavingNotas ? <Zap className="w-4 h-4 animate-pulse" /> : <Save className="w-4 h-4" />}
              {isSavingNotas ? 'Sincronizando...' : 'SYNC POWER NODES'}
            </button>
          </div>
        </div>

        <div className="bg-slate-950 border-2 border-slate-800 overflow-hidden shadow-[20px_20px_0px_0px_rgba(0,0,0,0.5)] relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-3xl -z-10 animate-pulse" />
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-slate-900 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b-2 border-slate-800">
                <th className="px-10 py-5">Franquia / Organization</th>
                <th className="px-10 py-5 text-center w-48">AI Power Rating</th>
              </tr>
            </thead>
            <tbody>
              {renderTierRows(categorizedNotes.TOP, 'LEVEL 01: ELITE (4.5+)')}
              {renderTierRows(categorizedNotes.BOM, 'LEVEL 02: COMPETITORS (4.0 - 4.4)')}
              {renderTierRows(categorizedNotes.REGULAR, 'LEVEL 03: MID-TIER (3.0 - 3.9)')}
              {renderTierRows(categorizedNotes.RUINS, 'LEVEL 04: REBUILDING (< 3.0)')}
            </tbody>
          </table>
        </div>
      </section>

      {/* SEÇÃO 2: PAINEL DE PALPITES */}
      <section className="space-y-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-6 border-b-4 border-slate-100 pb-6">
            <div className="flex items-center gap-6">
              <div className="bg-white p-3 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
                <BrainCircuit className="w-8 h-8 text-slate-950" />
              </div>
              <div>
                <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">
                  Predictor <span className="text-slate-500">Node</span>
                </h3>
                <div className="flex items-center gap-4 mt-3">
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-2">
                    <Database className="w-3 h-3" /> painel_palpites
                  </p>
                  <div className="bg-slate-800 h-3 w-[1px]" />
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-red-500" />
                    <input
                      type="text" value={tipsDate} onChange={(e) => setTipsDate(e.target.value)}
                      placeholder="DD/MM/YYYY"
                      className="bg-transparent border-0 focus:ring-0 text-red-500 font-mono font-bold text-[11px] w-28 tracking-wider p-0"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={handleImportFromIA}
                disabled={isImporting}
                className="bg-slate-900 border-2 border-amber-600 hover:bg-amber-600 text-white text-[10px] font-black px-6 py-4 uppercase tracking-[0.2em] transition-all shadow-[4px_4px_0px_0px_rgba(217,119,6,0.2)] hover:shadow-none flex items-center gap-2 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                IMPORT IA
              </button>
              <button
                onClick={exportAsImage}
                disabled={isExporting}
                className="bg-slate-900 border-2 border-slate-600 hover:bg-slate-600 text-white text-[10px] font-black px-6 py-4 uppercase tracking-[0.2em] transition-all shadow-[4px_4px_0px_0px_rgba(71,85,105,0.2)] hover:shadow-none flex items-center gap-3 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                EXPORT PNG
              </button>
              <button
                onClick={addPredictionRow}
                className="bg-slate-900 border-2 border-slate-200 hover:bg-white hover:text-slate-950 text-white text-[10px] font-black px-6 py-4 uppercase tracking-[0.2em] transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] hover:shadow-none"
              >
                + NEW NODE
              </button>
              <button
                onClick={handleSaveAllPalpites}
                disabled={isSavingPalpites}
                className="bg-indigo-600 border-2 border-indigo-400 hover:bg-indigo-500 text-white text-[10px] font-black px-8 py-4 uppercase tracking-[0.2em] shadow-[6px_6px_0px_0px_rgba(99,102,241,0.2)] hover:shadow-none transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingPalpites ? <Zap className="w-3.5 h-3.5 animate-pulse" /> : <Save className="w-3.5 h-3.5" />}
                SYNC LOGS
              </button>
            </div>
          </div>
        </div>

        <div ref={tableRef} className="bg-slate-950 border-2 border-slate-800 overflow-x-auto shadow-[30px_30px_0px_0px_rgba(0,0,0,0.4)]">
          <table className="w-full text-left border-collapse min-w-[1250px]">
            <thead>
              <tr className="bg-slate-900/80 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] border-b-2 border-slate-800">
                <th className="px-6 py-5 border-r border-slate-800 w-56">HOME TEAM / LOC</th>
                <th className="px-6 py-5 border-r border-slate-800 w-56">AWAY TEAM / VISIT</th>
                <th className="px-6 py-5 border-r border-slate-800 w-64 bg-slate-900 text-indigo-400">MAIN SELECTION [PRTY]</th>
                <th className="px-4 py-5 border-r border-slate-800 text-center w-28">OVER</th>
                <th className="px-4 py-5 border-r border-slate-800 text-center w-28">UNDER</th>
                <th className="px-4 py-5 border-r border-slate-800 text-center w-32 bg-slate-900">COMBINED</th>
                <th className="px-6 py-5 border-r border-slate-800 text-center w-36 text-red-500 underline decoration-red-500/20 underline-offset-4">CONFIDENCE %</th>
                <th className="px-4 py-5 border-r border-slate-800 text-center w-20">RT. H</th>
                <th className="px-4 py-5 border-r border-slate-800 text-center w-20">RT. A</th>
                <th className="px-4 py-5 text-center w-20">ACTION</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {predictions.length > 0 ? (
                predictions.map((pred) => {
                  const teamA = findTeam(pred.time_casa);
                  const teamB = findTeam(pred.time_fora);
                  const avgA = teamA?.stats?.media_pontos_ataque || 0;
                  const avgB = teamB?.stats?.media_pontos_ataque || 0;
                  const calculatedCombined = (avgA > 0 && avgB > 0) ? (avgA + avgB).toFixed(1) : pred.p_combinados;

                  return (
                    <tr key={pred.id} className="border-b border-slate-800 hover:bg-slate-900/50 transition-all group font-mono">
                      <td className="px-6 py-4 border-r border-slate-800/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center bg-slate-900 border border-slate-800 p-1 group-hover:border-slate-700 transition-colors">
                            <img src={getTeamLogo(pred.time_casa)} className="w-full h-full object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all" alt="" />
                          </div>
                          <div className="flex flex-col gap-1 w-full">
                            <input
                              list="nba-teams" value={pred.time_casa}
                              onChange={(e) => handleLocalPredictionChange(pred.id!, 'time_casa', e.target.value)}
                              className="w-full bg-transparent border-0 focus:ring-0 text-slate-100 font-black uppercase text-xs tracking-tighter p-0"
                              placeholder="HOME_TEAM"
                            />
                            {isB2B(pred.time_casa, tipsDate).yesterday && (
                              <span className="text-[8px] font-black bg-red-600/20 text-red-500 px-1.5 py-0.5 w-fit border border-red-600/30">B2B_YESTERDAY</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 border-r border-slate-800/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center bg-slate-900 border border-slate-800 p-1 group-hover:border-slate-700 transition-colors">
                            <img src={getTeamLogo(pred.time_fora)} className="w-full h-full object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all" alt="" />
                          </div>
                          <div className="flex flex-col gap-1 w-full">
                            <input
                              list="nba-teams" value={pred.time_fora}
                              onChange={(e) => handleLocalPredictionChange(pred.id!, 'time_fora', e.target.value)}
                              className="w-full bg-transparent border-0 focus:ring-0 text-slate-100 font-black uppercase text-xs tracking-tighter p-0"
                              placeholder="AWAY_TEAM"
                            />
                            {isB2B(pred.time_fora, tipsDate).yesterday && (
                              <span className="text-[8px] font-black bg-red-600/20 text-red-500 px-1.5 py-0.5 w-fit border border-red-600/30">B2B_YESTERDAY</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 border-r border-slate-800/50 bg-slate-900/40">
                        <input
                          value={pred.palpite_principal}
                          onChange={(e) => handleLocalPredictionChange(pred.id!, 'palpite_principal', e.target.value)}
                          className="w-full bg-transparent border-0 focus:ring-0 p-0 font-black text-indigo-400 italic uppercase text-sm tracking-tight"
                          placeholder="EX: LAL -4.5 [AUTO]"
                        />
                      </td>
                      <td className="px-4 py-4 border-r border-slate-800/50">
                        <input
                          value={pred.over_line}
                          onChange={(e) => handleLocalPredictionChange(pred.id!, 'over_line', e.target.value)}
                          className="w-full bg-transparent border-0 text-center focus:ring-0 p-0 font-black text-emerald-500 text-sm"
                          placeholder="OVER"
                        />
                      </td>
                      <td className="px-4 py-4 border-r border-slate-800/50">
                        <input
                          value={pred.under_line}
                          onChange={(e) => handleLocalPredictionChange(pred.id!, 'under_line', e.target.value)}
                          className="w-full bg-transparent border-0 text-center focus:ring-0 p-0 font-black text-rose-500 text-sm"
                          placeholder="UNDER"
                        />
                      </td>
                      <td className="px-4 py-4 border-r border-slate-800/50 bg-slate-900/20">
                        <input
                          value={pred.p_combinados !== '-' ? pred.p_combinados : calculatedCombined}
                          onChange={(e) => handleLocalPredictionChange(pred.id!, 'p_combinados', e.target.value)}
                          className="w-full bg-transparent border-0 text-center focus:ring-0 p-0 font-black text-slate-100 text-sm border-b border-dashed border-slate-700 pb-1"
                          placeholder="000.0"
                        />
                      </td>
                      <td className="px-6 py-4 border-r border-slate-800/50">
                        <div className="relative">
                          <input
                            value={pred.confianca}
                            onChange={(e) => handleLocalPredictionChange(pred.id!, 'confianca', e.target.value)}
                            className="w-full bg-slate-900 border-2 border-slate-800 focus:border-red-600 text-center focus:ring-0 font-black text-red-500 py-1.5 text-xs uppercase tracking-widest transition-colors"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 border-r border-slate-800/50 text-center font-bold text-slate-600 text-[10px] bg-slate-900/30">
                        {pred.n_casa}
                      </td>
                      <td className="px-4 py-4 border-r border-slate-800/50 text-center font-bold text-slate-600 text-[10px] bg-slate-900/30">
                        {pred.n_fora}
                      </td>
                      <td className="px-3 py-4 text-center">
                        {!isExporting && (
                          <button
                            onClick={() => removePredictionRow(pred.id!)}
                            className="text-slate-700 hover:text-red-500 transition-all active:scale-90"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-32 text-center bg-slate-950">
                    <div className="flex flex-col items-center gap-6">
                      <AlertCircle className="w-12 h-12 text-slate-800" />
                      <span className="text-xs font-black text-slate-600 uppercase tracking-[0.4em] italic">No active nodes for {tipsDate}</span>
                      <div className="flex gap-4">
                        <button onClick={handleImportFromIA} className="text-[10px] font-black text-amber-600 border-2 border-amber-600/30 px-8 py-3 uppercase tracking-widest hover:bg-amber-600 hover:text-white transition-all">RECOVER IA DATA</button>
                        <button onClick={addPredictionRow} className="text-[10px] font-black text-white bg-slate-900 border-2 border-slate-800 px-8 py-3 uppercase tracking-widest hover:border-white transition-all">+ INITIALIZE NODE</button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <datalist id="nba-teams">
            {teams.map(t => <option key={t.id} value={t.name} />)}
          </datalist>
        </div>
      </section>

      {/* SEÇÃO 3: PROPS INDIVIDUAIS */}
      <section className="space-y-12">
        <div className="flex flex-col gap-4 border-b-4 border-indigo-600 pb-8">
          <div className="flex items-center gap-6">
            <div className="bg-indigo-600 p-3 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
              <Target className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter">
              Indiv. <span className="text-indigo-500">Props</span> [PRO]
            </h3>
          </div>
        </div>

        {playersPlayingToday.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-700">
            {playersPlayingToday.slice(0, 24).map((player) => (
              <div key={player.id} className="bg-slate-950 border-2 border-slate-800 p-0 hover:border-indigo-600 transition-all group overflow-hidden shadow-[10px_10px_0px_0px_rgba(0,0,0,0.3)]">
                <div className="bg-slate-900 border-b-2 border-slate-800 p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rotate-45 translate-x-8 -translate-y-8" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-slate-950 border-2 border-slate-800 p-2 group-hover:border-indigo-600/50 transition-colors">
                      <img src={getTeamLogo(player.time)} className="w-full h-full object-contain grayscale group-hover:grayscale-0 transition-all" alt="" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-500 uppercase leading-none mb-1 tracking-widest underline decoration-indigo-500/30">{player.time}</span>
                      <span className="text-xl font-black text-white italic uppercase truncate w-32 tracking-tight group-hover:text-indigo-400 transition-colors">{player.nome.split(' ').pop()}</span>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-end border-b border-slate-800 pb-4">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5 text-indigo-500" /> AVG_POINTS
                      </span>
                      <span className="text-2xl font-black text-slate-200">{player.pontos.toFixed(1)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter bg-indigo-500/10 px-2 py-0.5">ESTIMATED</span>
                    </div>
                  </div>
                  <div className="bg-slate-900 border-2 border-slate-800 p-4 relative group-hover:bg-slate-800/40 transition-colors">
                    <span className="text-[9px] font-black text-slate-500 uppercase mb-2 block tracking-widest">EXPECTATION_THRESHOLD (PTS)</span>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-black text-indigo-400 italic">{(player.pontos - 1.5).toFixed(1)}+</span>
                      <ChevronRight className="w-6 h-6 text-slate-700 group-hover:translate-x-1 group-hover:text-indigo-500 transition-all" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-32 text-center bg-slate-950 border-2 border-dashed border-slate-800 text-slate-800 font-mono text-sm font-black uppercase tracking-[0.4em] relative overflow-hidden group">
            <div className="absolute inset-0 bg-red-600/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
            WAITING_FOR_ACTIVE_NODES_TO_CALCULATE_PROPS
          </div>
        )}
      </section>

    </div>
  );
};

export default TipsDashboard;
