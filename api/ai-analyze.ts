import { Type } from '@google/genai';
import { generateGeminiContent } from '../lib/gemini';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Upstash Redis for Rate Limiting
let ratelimit: Ratelimit | null = null;

try {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken) {
        ratelimit = new Ratelimit({
            redis: new Redis({
                url: redisUrl,
                token: redisToken,
            }),
            limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute per IP
            analytics: true,
            prefix: 'nba_monitor_ratelimit',
        });
    } else {
        console.warn('[Upstash-Redis] Variáveis de ambiente ausentes. Rate limiting desativado.');
    }
} catch (e) {
    console.error('[Upstash-Redis] Falha ao inicializar Ratelimit:', e);
}

const SYSTEM_INSTRUCTION = `Role: Você é o "Estatístico Chefe do NBA Hub". Operação estrita, brutalista e puramente matemática. Não narre jogos. Emita sentenças técnicas e frias.

DIRETRIZES ESTRATÉGICAS UNIFICADAS (MATRIZ V3.0):

[VETOR 1: RITMO E COLISÃO (PACE)]
- Nunca analise Over/Under usando apenas médias nominais. Use o Fator Cinético.
- HYPER_KINETIC: Linhas abaixo de 225.5 são alvos prioritários para OVER.
- SLOW_GRIND / STATIC_TRENCH: Repudie o OVER. Total baixo favorece sempre o Underdog.

[VETOR 2: MOMENTO TERMODINÂMICO (PRIORIDADE ALFA)]
- DRENO TÉRMICO: Se uma equipa possui 'result': 'D' nos últimos 3 jogos do Momentum, aplique uma severa penalização de confiança (-25%).
- DOMÍNIO H2H: Equipas com vitórias recentes esmagadoras no H2H (Confronto Direto) sobrepujam métricas de Pace isoladas.

[VETOR 3: ASSIMETRIA DE MERCADO E UNDERDOG]
- VALUE BET: Se a sua projeção (Edge) divergir fortemente do Mercado (>= 1.0 pontos no Spread ou Total), classifique o keyFactor como 'VALUE_BET DETECTADO'.
- Underdog_Casa: Underdogs jogando em casa (+8 a +14) tendem a competir mais. Favorito não costuma vencer por grande margem fora.
- Favorito_Back_to_Back: Aplique Dreno de Fadiga. Reduza a projeção do favorito em 1 a 2 pontos.
- Blowout_Regressao: Favorito venceu o último jogo por >35 pontos? O mercado supervaloriza-o. Gere valor no Underdog.
- Defesa Top: Defesas de elite (PTS sofridos < 109.5) anulam blowouts.

[VETOR 4: INTEGRIDADE FÍSICA]
- Ausência da Estrela Alfa HW >= 9 (Jokic, SGA, Doncic, etc) causa colapso sistêmico imediato, exceto se a equipa tiver Rating > 4.5.`;

const COMPARE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        winner: { type: Type.STRING },
        confidence: { type: Type.NUMBER },
        keyFactor: { type: Type.STRING },
        detailedAnalysis: { type: Type.STRING },
        expectedScoreA: { type: Type.NUMBER },
        expectedScoreB: { type: Type.NUMBER },
        projectedPace: { type: Type.NUMBER },
    },
    required: ['winner', 'confidence', 'keyFactor', 'detailedAnalysis', 'expectedScoreA', 'expectedScoreB', 'projectedPace'],
};

const INSIGHTS_SCHEMA = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['prediction', 'analysis', 'warning'] },
        },
        required: ['title', 'content', 'type'],
    },
};

/** Reads full body from a Node.js IncomingMessage stream if req.body is unavailable. */
async function parseBody(req: any): Promise<any> {
    // Vercel with Next.js runtime parses automatically; raw Node runtime does not.
    if (req.body !== undefined) return req.body;

    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
        req.on('end', () => {
            try { resolve(JSON.parse(raw)); } catch { resolve({}); }
        });
        req.on('error', reject);
    });
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    // Rate limiting (only if Upstash is configured)
    if (ratelimit) {
        try {
            const identifier = req.headers['x-forwarded-for'] || 'anonymous';
            const { success, limit, remaining } = await ratelimit.limit(identifier as string);

            res.setHeader('X-RateLimit-Limit', limit.toString());
            res.setHeader('X-RateLimit-Remaining', remaining.toString());

            if (!success) {
                return res.status(429).json({
                    error: 'Limite de requisições excedido. Tente novamente em 1 minuto.'
                });
            }
        } catch (error) {
            console.error('[Upstash-Redis] Erro durante rate limit check:', error);
            // Non-blocking: continue even if rate limit check fails due to Redis issues
        }
    }

    const body = await parseBody(req);
    const { mode, prompt } = body ?? {};

    if (!mode || !prompt) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes: mode, prompt.' });
    }

    const schema = mode === 'compareTeams' ? COMPARE_SCHEMA : INSIGHTS_SCHEMA;

    try {
        const response = await generateGeminiContent(prompt, {
            model: 'gemini-3-flash-preview',
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.1,
        });

        if (!response.text) {
            throw new Error('Payload nulo retornado pelo modelo.');
        }

        return res.status(200).json({ text: response.text });
    } catch (error: any) {
        // Log full error server-side for Vercel function logs
        console.error('[ai-analyze] Falha na inferência:', {
            message: error.message,
            status: error.status,
            stack: error.stack?.slice(0, 500),
        });
        return res.status(500).json({
            error: 'Colapso na inferência do motor IA.',
            details: error.message,
        });
    }
}
