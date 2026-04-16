
import React, { useMemo, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { Team, PlayerStat, PalpiteData, UnavailablePlayer, PredictionIA } from '../types';
import { useTipsDashboardLogic } from '../hooks/useTipsDashboardLogic';
import { findTeamByName } from '../lib/nbaUtils';
import PowerRankingSection from './TipsDashboard/PowerRankingSection';
import PredictionsSection from './TipsDashboard/PredictionsSection';
import MarketProjectionSection from './TipsDashboard/MarketProjectionSection';
import PropsSection from './TipsDashboard/PropsSection';
import ContextoSection from './TipsDashboard/ContextoSection';

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
        backgroundColor: '#0f172a',
        pixelRatio: 2,
        style: {
          color: '#f8fafc',
          background: '#0f172a'
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
      alert('Nenhuma previsão para exportar.');
      return;
    }

    let text = `🏀 *NBA MONITOR - PREDIÇÕES* 🏀\n`;
    text += `📅 Data: ${tipsDate}\n\n`;

    predictions.forEach(p => {
      const timeCasa = p.time_casa || 'CASA';
      const timeFora = p.time_fora || 'FORA';
      const palpite = p.palpite_principal && p.palpite_principal !== '-' ? p.palpite_principal : 'A Definir';
      const handicapEdge = p.handicap_line && p.handicap_line !== '-' ? p.handicap_line : 'N/A';
      const confId = p.confianca && p.confianca !== '-' ? p.confianca : 'N/A';

      text += `*${timeCasa} vs ${timeFora}*\n`;
      text += `🏆 CORE_PICK: *${palpite}*\n`;
      text += `🎯 HANDICAP_EDGE: *${handicapEdge}*\n`;
      text += `📊 CONF_ID: ${confId}\n\n`;
    });

    text += `_Gerado por NBA Monitor v3.0_`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        alert('Análise copiada para a área de transferência! Cole no Whatsapp/Telegram.');
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          alert('Análise copiada para a área de transferência! Cole no Whatsapp/Telegram. (Fallback)');
        } catch (error) {
          console.error(error);
          alert('Erro ao copiar. Seu navegador pode não suportar essa função.');
        } finally {
          textArea.remove();
        }
      }
    } catch (err) {
      console.error('Erro ao copiar:', err);
      alert('Erro ao copiar o texto.');
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
    <div className="flex flex-col gap-20 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <PowerRankingSection
        teams={teams}
        tierScores={tierScores}
        isSavingNotas={isSavingNotas}
        onSaveNotas={handleOnSaveNotas}
        onScoreChange={handleLocalScoreChange}
      />

      <MarketProjectionSection
        predictions={predictions}
        teams={teams}
        tierScores={tierScores}
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

      <ContextoSection tipsDate={tipsDate} />

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
