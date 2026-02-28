
import React, { useMemo, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { Team, PlayerStat, PalpiteData, UnavailablePlayer, PredictionIA } from '../types';
import { useTipsDashboardLogic } from '../hooks/useTipsDashboardLogic';
import { findTeamByName } from '../lib/nbaUtils';
import PowerRankingSection from './TipsDashboard/PowerRankingSection';
import PredictionsSection from './TipsDashboard/PredictionsSection';
import PropsSection from './TipsDashboard/PropsSection';

interface TipsDashboardProps {
  teams: Team[];
  playerStats: PlayerStat[];
  unavailablePlayers: UnavailablePlayer[];
  dbPredictions?: PredictionIA[];
}

const TipsDashboard: React.FC<TipsDashboardProps> = ({ playerStats, teams, unavailablePlayers, dbPredictions }) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const {
    tipsDate,
    setTipsDate,
    predictions,
    tierScores,
    isSavingNotas,
    isSavingPalpites,
    isImporting,
    handleSaveAllNotas,
    handleSaveAllPalpites,
    handleImportFromIA,
    addPredictionRow,
    removePredictionRow,
    handleLocalScoreChange,
    handleLocalPredictionChange
  } = useTipsDashboardLogic({ teams });

  const getInjuriesForTeam = useCallback((teamName: string) => {
    const teamPlayers = (unavailablePlayers || []).filter(p => {
      const pTime = (p.team_name || p.time || p.franquia || '').toLowerCase();
      const tName = teamName.toLowerCase();
      return pTime.includes(tName) || tName.includes(pTime);
    });

    const seen = new Set();
    return teamPlayers.filter(p => {
      const name = p.player_name || p.nome;
      if (!name || seen.has(name.toLowerCase())) return false;
      seen.add(name.toLowerCase());
      return true;
    }).map(p => {
      const status = (p.injury_status || p.gravidade || 'OUT').toUpperCase();
      const isOut = status.includes('OUT') || status.includes('GRAVE') || status.includes('FORA');
      return {
        nome: p.player_name || p.nome,
        status: status,
        isOut
      };
    });
  }, [unavailablePlayers]);

  const getTeamLogo = (teamName: string) => {
    const team = findTeamByName(teamName, teams);
    return team?.logo || 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nba.png';
  };

  const handleOnSaveNotas = async () => {
    const result = await handleSaveAllNotas();
    alert(result.message);
  };

  const handleOnSavePalpites = async () => {
    const result = await handleSaveAllPalpites();
    alert(result.message);
  };

  const handleOnImportIA = async () => {
    const result = await handleImportFromIA();
    alert(result.message);
  };

  const exportAsImage = async () => {
    if (!tableRef.current) return;
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      const dataUrl = await toPng(tableRef.current, {
        cacheBust: true,
        backgroundColor: '#000000',
        pixelRatio: 2,
        style: {
          color: '#ffffff',
          background: '#000000'
        }
      });
      const link = document.createElement('a');
      link.download = `nba-tips-${tipsDate.replace(/\//g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao exportar PNG:', err);
    }
  };

  const exportAsText = async () => {
    if (predictions.length === 0) {
      alert('DETERMINISTIC_NULL: NO_PREDICTIONS_TO_EXPORT');
      return;
    }

    let text = `🏀 *NBA MONITOR - PREDIÇÕES* 🏀\n`;
    text += `📅 Data: ${tipsDate}\n\n`;

    predictions.forEach(p => {
      const timeCasa = p.time_casa || 'CASA';
      const timeFora = p.time_fora || 'FORA';
      const palpite = p.palpite_principal && p.palpite_principal !== '-' ? p.palpite_principal : 'A Definir';
      const overLine = p.over_line && p.over_line !== '-' ? p.over_line : 'N/A';
      const underLine = p.under_line && p.under_line !== '-' ? p.under_line : 'N/A';
      const confianca = p.confianca && p.confianca !== '-' ? p.confianca : 'N/A';

      text += `*${timeCasa} vs ${timeFora}*\n`;
      text += `🏆 Palpite: *${palpite}*\n`;
      text += `📈 Linhas: Over ${overLine} | Under ${underLine}\n`;
      text += `📊 Confiança: ${confianca}\n\n`;
    });

    text += `_Gerado por NBA Monitor v5.0_`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        alert('SUCCESS: ARCHIVE_COPIED_TO_CLIPBOARD');
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          alert('SUCCESS: ARCHIVE_COPIED_v2 (FALLBACK)');
        } catch (error) {
          console.error(error);
          alert('ERROR: BROWSER_SECURITY_EXCEPTION_COPY_FAILED');
        } finally {
          textArea.remove();
        }
      }
    } catch (err) {
      console.error('Erro ao copiar:', err);
      alert('ERROR: UNEXPECTED_COPY_FAILURE');
    }
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
    <div className="flex flex-col gap-24 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20 font-mono">
      <PowerRankingSection
        teams={teams}
        tierScores={tierScores}
        isSavingNotas={isSavingNotas}
        onSaveNotas={handleOnSaveNotas}
        onScoreChange={handleLocalScoreChange}
      />

      <PredictionsSection
        tipsDate={tipsDate}
        setTipsDate={setTipsDate}
        predictions={predictions}
        teams={teams}
        isImporting={isImporting}
        isExporting={false}
        isSavingPalpites={isSavingPalpites}
        onImportIA={handleOnImportIA}
        onExportPNG={exportAsImage}
        onCopyText={exportAsText}
        onAddNewRow={addPredictionRow}
        onSavePalpites={handleOnSavePalpites}
        onLocalPredictionChange={handleLocalPredictionChange}
        onRemoveRow={removePredictionRow}
        tableRef={tableRef}
      />

      <PropsSection
        playersPlayingToday={playersPlayingToday}
        teams={teams}
        getInjuriesForTeam={getInjuriesForTeam}
        getTeamLogo={getTeamLogo}
      />
    </div>
  );
};

export default TipsDashboard;
