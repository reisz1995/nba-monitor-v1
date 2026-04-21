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
            redis: new Redis({ url: redisUrl, token: redisToken }),
            limiter: Ratelimit.slidingWindow(20, '1 m'),
            analytics: true,
            prefix: 'nba_monitor_ratelimit_format',
        });
    }
} catch (e) {
    console.error('[Upstash-Redis] Falha ao inicializar Ratelimit:', e);
}

const SYSTEM_INSTRUCTION = `Você é um editor sênior de um site profissional de análises esportivas e apostas da NBA. Sua missão é transformar dados brutos em uma redação envolvente, profissional e persuasiva.
Siga EXATAMENTE as diretrizes de ESTRUTURA passadas no prompt. Retorne apenas o Markdown da análise.`;

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

/**
 * Funcao interna de geracao com fallback para suportar resiliencia em um unico arquivo (debug/unblock)
 */
async function executeGeminiWithFallback(prompt: string, temperature: number, systemInstruction: string) {
    const primaryKey = process.env.GEMINI_API_KEY;
    const secondaryKey = process.env.GEMINI_API_KEY_SECONDARY;

    const runCall = async (apiKey: string, label: string) => {
        if (!apiKey || apiKey.includes('your_gemini')) {
            throw new Error(`API Key ${label} não configurada ou inválida.`);
        }
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction,
                temperature,
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
        console.error(`[format-context] Falha na chave primária: ${err.message}`);
        if (secondaryKey && !secondaryKey.includes('your_gemini')) {
            console.warn('[format-context] Tentando fallback para chave secundária...');
            return await runCall(secondaryKey, 'Secundária');
        }
        throw err;
    }
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    if (ratelimit) {
        try {
            const identifier = req.headers['x-forwarded-for'] || 'anonymous';
            const { success } = await ratelimit.limit(identifier as string);
            if (!success) return res.status(429).json({ error: 'Limite de requisições excedido.' });
        } catch (error) { }
    }

    const body = await parseBody(req);
    const { prompt, scheduleId } = body ?? {};

    if (!prompt) return res.status(400).json({ error: 'prompt ausente.' });

    try {
        console.log('[format-context] Iniciando geração IA...');
        const resultText = await executeGeminiWithFallback(prompt, 0.4, SYSTEM_INSTRUCTION);

        // Save to Supabase using admin key
        if (scheduleId && process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            try {
                const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                await supabaseAdmin
                    .from('nba_games_schedule')
                    .update({ gemini_insight: resultText })
                    .eq('id', scheduleId);
            } catch (dbError) {
                console.error('[format-context] Erro DB:', dbError);
            }
        }

        return res.status(200).json({ text: resultText });
    } catch (error: any) {
        console.error('[format-context] Falha fatal:', error.message);
        return res.status(500).json({
            error: 'Falha crítica na formatação IA.',
            details: error.message
        });
    }
}
