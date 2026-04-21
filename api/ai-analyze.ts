import { Type, GoogleGenAI } from '@google/genai';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Upstash Redis for Rate Limiting
let ratelimit: Ratelimit | null = null;
try {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (redisUrl && redisToken) {
        ratelimit = new Ratelimit({
            redis: new Redis({ url: redisUrl, token: redisToken }),
            limiter: Ratelimit.slidingWindow(10, '1 m'),
            analytics: true,
            prefix: 'nba_monitor_ratelimit',
        });
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

async function parseBody(req: any): Promise<any> {
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

async function executeGeminiWithFallback(prompt: string, options: any) {
    const primaryKey = process.env.GEMINI_API_KEY;
    const secondaryKey = process.env.GEMINI_API_KEY_SECONDARY;

    const runCall = async (apiKey: string, label: string) => {
        if (!apiKey || apiKey.includes('your_gemini')) {
            throw new Error(`API Key ${label} não configurada.`);
        }
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: options.systemInstruction,
                responseMimeType: options.responseMimeType,
                responseSchema: options.responseSchema,
                temperature: options.temperature,
            },
        });
        const textOutput = typeof response.text === 'function' ? await response.text() : response.text;
        if (!textOutput) throw new Error(`Resposta vazia da chave ${label}`);
        return textOutput;
    };

    try {
        if (!primaryKey) throw new Error('Chave primária ausente.');
        return await runCall(primaryKey, 'Primária');
    } catch (err: any) {
        console.error(`[ai-analyze] Falha na chave primária: ${err.message}`);
        if (secondaryKey && !secondaryKey.includes('your_gemini')) {
            console.warn('[ai-analyze] Tentando fallback para chave secundária...');
            return await runCall(secondaryKey, 'Secundária');
        }
        throw err;
    }
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

    if (ratelimit) {
        try {
            const identifier = req.headers['x-forwarded-for'] || 'anonymous';
            const { success } = await ratelimit.limit(identifier as string);
            if (!success) return res.status(429).json({ error: 'Limite de requisições excedido.' });
        } catch (error) { }
    }

    const body = await parseBody(req);
    const { mode, prompt } = body ?? {};
    if (!mode || !prompt) return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });

    const schema = mode === 'compareTeams' ? COMPARE_SCHEMA : INSIGHTS_SCHEMA;

    try {
        const text = await executeGeminiWithFallback(prompt, {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.1,
        });
        return res.status(200).json({ text });
    } catch (error: any) {
        console.error('[ai-analyze] Falha:', error.message);
        return res.status(500).json({ error: 'Falha na inferência IA.', details: error.message });
    }
}
