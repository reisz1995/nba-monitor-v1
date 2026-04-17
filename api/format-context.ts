import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
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
            limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 requests per minute
            analytics: true,
            prefix: 'nba_monitor_ratelimit_format',
        });
    }
} catch (e) {
    console.error('[Upstash-Redis] Falha ao inicializar Ratelimit:', e);
}

const SYSTEM_INSTRUCTION = `Você é um editor sênior de um site profissional de análises esportivas e apostas da NBA. Sua missão é transformar dados brutos em uma redação envolvente, profissional e persuasiva.
Siga EXATAMENTE as diretrizes de ESTRUTURA passadas no prompt. Retorne apenas o Markdown da análise.`;

/** Reads full body from a Node.js IncomingMessage stream if req.body is unavailable. */
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

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    if (ratelimit) {
        try {
            const identifier = req.headers['x-forwarded-for'] || 'anonymous';
            const { success, limit, remaining } = await ratelimit.limit(identifier as string);
            res.setHeader('X-RateLimit-Limit', limit.toString());
            res.setHeader('X-RateLimit-Remaining', remaining.toString());
            if (!success) {
                return res.status(429).json({ error: 'Limite de requisições excedido.' });
            }
        } catch (error) { }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY ausente.' });
    }

    const body = await parseBody(req);
    const { prompt, scheduleId } = body ?? {};

    if (!prompt) {
        return res.status(400).json({ error: 'prompt ausente.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.4,
            },
        });

        if (!response.text) {
            throw new Error('Payload nulo retornado pelo modelo.');
        }

        // Save to Supabase using admin key
        if (scheduleId && process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            try {
                const supabaseAdmin = createClient(
                    process.env.VITE_SUPABASE_URL,
                    process.env.SUPABASE_SERVICE_ROLE_KEY
                );

                const { error: updateError } = await supabaseAdmin
                    .from('nba_games_schedule')
                    .update({ gemini_insight: response.text })
                    .eq('id', scheduleId);

                if (updateError) {
                    console.error('[format-context] Erro ao salvar nó:', updateError.message);
                }
            } catch (dbError) {
                console.error('[format-context] Erro DB interno:', dbError);
            }
        }

        return res.status(200).json({ text: response.text });
    } catch (error: any) {
        console.error('[format-context] Falha:', error.message);
        return res.status(500).json({ error: 'Falha na formatação IA.', details: error.message });
    }
}
