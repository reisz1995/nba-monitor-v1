import { z } from 'zod';

export const GameResultSchema = z.enum(['V', 'D']);

export const GameRecordDataSchema = z.object({
  date: z.string(),
  opponent: z.string().optional(),
  result: GameResultSchema,
  score: z.string(),
});

export const TeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  logo: z.string().url(),
  record: z.array(GameRecordDataSchema), // ✅ Elimina o "any"
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  conference: z.enum(['East', 'West']),
  ai_score: z.number().optional(),
  stats: z.object({
    media_pontos_ataque: z.number(),
    media_pontos_defesa: z.number(),
    aproveitamento: z.number(),
    ultimos_5_espn: z.string().optional(),
    ai_score: z.number().optional(),
  }).optional(),
  espnData: z.record(z.any()).optional(), // ESPN data é volátil, manter flexível
  tanking: z.boolean().optional(),
  databallr: z.object({
    ortg: z.number().optional(),
    drtg: z.number().optional(),
    net_rating: z.number().optional(),
    pace: z.number().optional().nullable(),
    offense_rating: z.number().optional(),
    defense_rating: z.number().optional(),
    o_ts: z.number().optional(),
    o_tov: z.number().optional(),
    orb: z.number().optional(),
    drb: z.number().optional(),
    net_poss: z.number().optional(),
  }).optional(),
});

export const PlayerStatSchema = z.object({
  id: z.number(),
  nome: z.string(),
  time: z.string(),
  posicao: z.string().optional(),
  pontos: z.number(),
  rebotes: z.number(),
  assistencias: z.number(),
  min: z.string().optional(),
  created_at: z.string().optional(),
  player_name: z.string().optional(),
  team_name: z.string().optional(),
  position: z.string().optional(),
  pts: z.number().optional(),
  reb: z.number().optional(),
  ast: z.number().optional(),
});

// Infer types automaticamente
export type Team = z.infer<typeof TeamSchema>;
export type PlayerStat = z.infer<typeof PlayerStatSchema>;
export type GameRecordData = z.infer<typeof GameRecordDataSchema>;

// Parser seguro para dados do Supabase
export const parseTeamData = (data: unknown): Team | null => {
  const result = TeamSchema.safeParse(data);
  if (!result.success) {
    console.error('[Zod] Falha ao parsear Team:', result.error.flatten());
    return null;
  }
  return result.data;
};
