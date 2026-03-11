
export type GameResult = 'V' | 'D';

export interface Team {
  id: number;
  name: string;
  logo: string;
  record: GameResult[];
  wins: number;
  losses: number;
  conference: 'East' | 'West';
  ai_score?: number;
  stats?: {
    media_pontos_ataque: number;
    media_pontos_defesa: number;
    aproveitamento: number;
    ultimos_5_espn?: string;
    ai_score?: number;
  };
  espnData?: ESPNData;
  tanking?: boolean;
}

export interface PlayerStat {
  id: number;
  nome: string;
  time: string;
  posicao?: string;
  pontos: number;
  rebotes: number;
  assistencias: number;
  min?: string;
  created_at?: string;
  player_name?: string;
  team_name?: string;
  position?: string;
  pts?: number;
  reb?: number;
  ast?: number;
}

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
    total_score?: string;
    [key: string]: any;
  };
  [key: string]: any;
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
  result?: 'green' | 'red' | 'pending';
  sources?: Source[];
  momentumData?: any;
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
  [key: string]: any;
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
  details?: any;
  created_at: string;
}
