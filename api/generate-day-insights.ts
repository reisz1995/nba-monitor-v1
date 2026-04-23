import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const SYSTEM_INSTRUCTION = `Você é um editor sênior de um site profissional de análises esportivas e apostas da NBA. Sua missão é transformar dados brutos em uma redação envolvente, profissional e persuasiva.
Siga EXATAMENTE as diretrizes de ESTRUTURA passadas no prompt. Retorne apenas o Markdown da análise.`;

const formatPrompt = (schedule: any) => `
Você é um editor sênior de um site profissional de análises esportivas e apostas da NBA. Sua missão é transformar dados brutos em uma redação envolvente, profissional e persuasiva.

## 📋 DADOS DE ENTRADA

### JOGO
- **GAME_DATE**: ${schedule.game_date}
- **HOME_TEAM**: ${schedule.home_team}
- **AWAY_TEAM**: ${schedule.away_team}
- **TACTICAL_PREDICTION**: ${schedule.tactical_prediction}
- **GROQ_INSIGHT**: ${schedule.groq_insight}

## 🎯 INSTRUÇÕES DE ESTRUTURA

Crie uma análise completa seguindo esta estrutura:

### 1. HEADLINE IMPACTANTE
- Título curto e chamativo (máx 60 caracteres)
- Destaque o confronto e a tendência principal (OVER/UNDER)

### 2. SUBTÍTULO
- Uma frase que resume a oportunidade de aposta

### 3. INTRODUÇÃO (2-3 parágrafos)
- Contexto do jogo
- O que está em jogo para cada equipe
- Gancho sobre a previsão

### 4. ANÁLISE TÁTICA
Extraia de TACTICAL_PREDICTION:
- **🏠 HOME TEAM**: Forças, fraquezas, jogadores-chave, lesões
- **✈️ AWAY TEAM**: Forma recente, estilo de jogo, matchups
- **⚔️ CONFRONTO DIRETO**: Histórico H2H, tendências

### 5. PALPITE PROFISSIONAL
Formate EXATAMENTE assim:
🎯 NOSSA APOSTA: [recommendation] [fair_line]
📊 CONFIANÇA: ⭐⭐⭐⭐☆ ([confidence_score]/5)
💰 UNIDADES RECOMENDADAS: [stake_units] unidades
📈 LINHA JUSTA: [fair_line]
🔥 EDGE: [edge_percentage]%

### 6. FATORES DECISIVOS
Liste os key_factors com emojis:
• 🚑 Lesões importantes
• 🔥 Forma recente
• 📊 Estatísticas H2H
• 🏟️ Fator casa/fora
• ⭐ Jogadores experientes

### 7. CONCLUSÃO
- Resumo da análise em 2-3 frases persuasivas
- Call-to-action: "Acompanhe ao vivo e confira nossa aposta!"

## ✨ REGRAS DE ESCRITA
1. **Tom**: Profissional, confiante, entusiasta
2. **Linguagem**: Português do Brasil, informal mas educado
3. **Emojis**: Use moderadamente para destacar pontos
4. **Destaques**: Use **negrito** para nomes de jogadores e estatísticas
5. **Números**: Sempre cite estatísticas específicas
`;

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

async function executeGeminiWithFallback(prompt: string, temperature: number, systemInstruction: string) {
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
            config: { systemInstruction, temperature },
        });
        const textOutput = typeof (response as any).text === 'function' ? await (response as any).text() : (response as any).text;
        if (!textOutput) throw new Error(`Resposta vazia da chave ${label}`);
        return textOutput;
    };

    try {
        if (!primaryKey) throw new Error('Chave primária ausente.');
        return await runCall(primaryKey, 'Primária');
    } catch (err: any) {
        console.error(`[generate-day-insights] Falha na chave primária: ${err.message}`);
        if (secondaryKey && !secondaryKey.includes('your_gemini')) {
            console.warn('[generate-day-insights] Tentando fallback para chave secundária...');
            return await runCall(secondaryKey, 'Secundária');
        }
        throw err;
    }
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseRoleKey) return res.status(500).json({ error: 'Configuração Supabase ausente.' });

    const body = await parseBody(req);
    const { date } = body ?? {};
    if (!date) return res.status(400).json({ error: 'Data não informada.' });

    const supabaseAdmin = createClient(supabaseUrl, supabaseRoleKey);

    try {
        const { data: pendingGames, error: fetchError } = await supabaseAdmin
            .from('nba_games_schedule')
            .select('*')
            .eq('game_date', date)
            .is('gemini_insight', null);

        if (fetchError) throw fetchError;
        if (!pendingGames || pendingGames.length === 0) return res.status(200).json({ processed: 0 });

        let processedCount = 0;
        for (const game of pendingGames) {
            try {
                const prompt = formatPrompt(game);
                const resultText = await executeGeminiWithFallback(prompt, 0.4, SYSTEM_INSTRUCTION);
                await supabaseAdmin
                    .from('nba_games_schedule')
                    .update({ gemini_insight: resultText })
                    .eq('id', game.id);
                processedCount++;
                await new Promise(r => setTimeout(r, 600));
            } catch (err: any) {
                console.error(`Falha no jogo ${game.id}:`, err.message);
            }
        }
        return res.status(200).json({ processed: processedCount, total: pendingGames.length });
    } catch (error: any) {
        console.error('[generate-day-insights] Error:', error.message);
        return res.status(500).json({ error: 'Falha no processamento batch.', details: error.message });
    }
}
