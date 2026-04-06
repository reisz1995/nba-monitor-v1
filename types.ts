import { Team as TeamValidated, GameRecordData as GameRecordDataValidated, PlayerStat as PlayerStatValidated } from './lib/schemas';

// 1. Definição estrita da nova matriz temporal
export type GameResult = 'V' | 'D';

export type GameRecordData = GameRecordDataValidated;

// 2. Mutações na interface da Franquia
export type Team = TeamValidated; // ✅ Type-safe com runtime validation

export type PlayerStat = PlayerStatValidated;

export interface PalpiteData {
  id?: number;
  created_at?: string;
  data_jogo?: string;
  time_casa: string;
  time_fora: string;
  palpite_principal: string;
  over_line: string;
  under_line: string;
  p_combinados: string;
  confianca: string;
  n_casa: string;
  n_fora: string;
  handicap_line?: string; // INJEÇÃO: Permitir o trânsito do Handicap para a UI
  user_id?: string;
}

export interface NotaData {
  id?: number;
  created_at?: string;
  franquia: string;
  nota_ia: string;
  criterio?: string;
  user_id?: string;
}

export interface UnavailablePlayer {
  id?: number;
  nome?: string;
  player_name?: string;
  time?: string;
  team_name?: string;
  franquia?: string;
  motivo?: string;
  injury_status?: string;
  retorno_previsto?: string;
  gravidade?: string;
  injury_description?: string;
  retorno?: string;
}

export interface PredictionIA {
  id: number;
  date: string;
  home_team: string;
  away_team: string;
  main_pick?: string;
  over_line?: string;
  under_line?: string;
  confidence?: number;
  prediction?: {
    handicap_line?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface Source {
  title: string;
  url: string;
}

export interface Insight {
  title: string;
  content: string;
  type: 'prediction' | 'analysis' | 'warning';
  sources?: Source[];
}

export interface MatchupAnalysis {
  winner: string;
  confidence: number;
  keyFactor: string;
  detailedAnalysis: string;
  expectedScoreA?: number;
  expectedScoreB?: number;
  projectedPace?: number;
  result?: 'green' | 'red' | 'pending';
  sources?: Source[];
  momentumData?: {
    scoreA: number;
    scoreB: number;
    [key: string]: unknown;
  };
}

export interface ESPNData {
  id: number;
  time?: string;
  ultimos_5?: string;
  strk?: string;
  streak?: string;
  last_5?: string;
  media_pontos_ataque?: number;
  media_pontos_defesa?: number;
  aproveitamento?: number;
  vitorias?: number;
  derrotas?: number;
  pct_vit?: number;
  pace?: number | null;
  [key: string]: unknown;
}

export interface MarketData {
  matchup?: string;
  spread?: number | null;
  total?: number | null;
  moneyline_away?: number | null;
  moneyline_home?: number | null;
  updated_at?: string;
}

export interface HistoryLog {
  id: string;
  action: string;
  details?: Record<string, unknown>;
  created_at: string;
}
