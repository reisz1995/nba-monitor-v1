import { supabase } from '../lib/supabase';

// ====================================================
// DATABALLR FULL STATS — Tensor de Eficiência (14 dias)
// ====================================================

export interface DataballrFullStats {
  team_id: number;
  team_name: string;
  team_abbreviation: string;
  /** Offensive Rating: pts por 100 posses */
  ortg: number;
  /** Defensive Rating: pts sofridos por 100 posses */
  drtg: number;
  /** Net Rating = ortg - drtg */
  net_rating: number;
  /** Ataque Relativo vs média da liga */
  offense_rating: number;
  /** Defesa Relativa vs média da liga */
  defense_rating: number;
  /** True Shooting % × 100 */
  o_ts: number;
  /** Turnover Ratio: % posses que terminam em erro */
  o_tov: number;
  /** Offensive Rebound % */
  orb: number;
  /** Opponent True Shooting % (eficiência defensiva) */
  d_ts: number;
  /** Opponent Turnover Ratio (pressão forçada) */
  d_tov: number;
  /** Defensive Rebound % */
  drb: number;
  /** Net Efficiency (espelho de interface = net_rating) */
  net_eff: number;
  /** Saldo líquido de posses */
  net_poss: number;
  /** PACE real: posses por 48min */
  pace: number;
  record_date: string;
  period: string;
}

// Cache em memória para evitar N+1 no banco por sessão
let _cache: DataballrFullStats[] | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Busca e cacheia as stats completas da tabela databallr_team_stats.
 * Retorna apenas o registro mais recente por equipe (period=last_14_days).
 */
export const fetchDataballrFullStats = async (): Promise<DataballrFullStats[]> => {
  if (_cache && Date.now() - _cacheTimestamp < CACHE_TTL_MS) {
    return _cache;
  }

  const { data, error } = await supabase
    .from('databallr_team_stats')
    .select('*')
    .eq('period', 'last_14_days')
    .order('record_date', { ascending: false });

  if (error || !data || data.length === 0) {
    console.warn('[Databallr] Falha ao buscar full stats — fallback para array vazio.', error);
    return _cache ?? [];
  }

  // Deduplica: mantém apenas o registro mais recente por team_id
  // Como a query já está ordenada por record_date DESC, o primeiro registro encontrado para cada time é o mais recente.
  const dedupedMap = new Map<number, DataballrFullStats>();
  data.forEach((row: any) => {
    if (!dedupedMap.has(row.team_id)) {
      dedupedMap.set(row.team_id, row as DataballrFullStats);
    }
  });

  const deduped = Array.from(dedupedMap.values());
  _cache = deduped;
  _cacheTimestamp = Date.now();
  return deduped;
};

/**
 * Localiza as stats de uma equipe por nome (busca fuzzy).
 * Aceita nome completo, parcial ou abreviação.
 */
export const findDataballrStatsByName = (
  teamName: string,
  stats: DataballrFullStats[]
): DataballrFullStats | null => {
  if (!teamName || stats.length === 0) return null;

  const clean = teamName.toLowerCase().trim();

  // Mapeamento de abreviações comuns que não são substrings óbvias
  const abbreviationMap: Record<string, string[]> = {
    'okc': ['thunder', 'oklahoma'],
    'sas': ['spurs', 'san antonio'],
    'gsw': ['warriors', 'golden state'],
    'nyk': ['knicks', 'new york'],
    'nop': ['pelicans', 'new orleans'],
    'lal': ['lakers', 'los angeles lakers'],
    'lac': ['clippers', 'los angeles clippers'],
    'phx': ['suns', 'phoenix'],
    'phi': ['76ers', 'sixers', 'philadelphia'],
    'bkn': ['nets', 'brooklyn'],
    'was': ['wizards', 'washington'],
    'por': ['blazers', 'portland']
  };

  return (
    stats.find((s) => {
      const sName = s.team_name.toLowerCase();
      const sAbbr = s.team_abbreviation.toLowerCase();

      // 1. Match exato ou substring direta
      if (sName === clean || sName.includes(clean) || clean.includes(sName)) return true;
      if (sAbbr === clean || sAbbr.includes(clean) || clean.includes(sAbbr)) return true;

      // 2. Match via mapeamento de abreviação
      const mappedNames = abbreviationMap[sAbbr] || abbreviationMap[sName];
      if (mappedNames && mappedNames.some(m => clean.includes(m) || m.includes(clean))) return true;

      return false;
    }) ?? null
  );
};

/**
 * Formata as stats de uma equipe como bloco de texto compacto para o prompt da IA.
 */
export const formatDataballrForPrompt = (
  label: string,
  s: DataballrFullStats | null
): string => {
  if (!s) return `[${label}] Stats avançadas (14d): INDISPONÍVEL`;
  return [
    `[${label} — Databallr 14d]`,
    `ORTG=${s.ortg.toFixed(1)} | DRTG=${s.drtg.toFixed(1)} | NET=${s.net_rating.toFixed(1)}`,
    `Atq.Rel=${s.offense_rating.toFixed(1)} | Def.Rel=${s.defense_rating.toFixed(1)}`,
    `PACE=${s.pace.toFixed(1)} | TS%=${s.o_ts.toFixed(1)} | TOV%=${s.o_tov.toFixed(1)}`,
    `OReb%=${s.orb.toFixed(1)} | DReb%=${s.drb.toFixed(1)} | Net.Poss=${s.net_poss.toFixed(1)}`,
  ].join('\n');
};
