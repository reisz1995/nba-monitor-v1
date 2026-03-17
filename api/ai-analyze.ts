import { GoogleGenAI, Type } from '@google/genai';

// Server-side only — never sent to the browser bundle.
// GEMINI_API_KEY (no VITE_ prefix) is read from process.env at runtime.
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
- Ausência da Estrela Alfa HW >= 7 (Jokic, SGA, Doncic, etc) causa colapso sistêmico imediato, exceto se a equipa tiver Rating > 4.5.`;

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

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('[ai-analyze] GEMINI_API_KEY não configurada no ambiente servidor.');
        return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
    }

    const { mode, prompt } = req.body ?? {};
    if (!mode || !prompt) {
        return res.status(400).json({ error: 'Campos obrigatórios: mode, prompt.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const schema = mode === 'compareTeams' ? COMPARE_SCHEMA : INSIGHTS_SCHEMA;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: 'application/json',
                responseSchema: schema,
                temperature: 0.1,
            },
        });

        if (!response.text) {
            throw new Error('Payload nulo retornado pelo modelo.');
        }

        return res.status(200).json({ text: response.text });
    } catch (error: any) {
        console.error('[ai-analyze] Falha na inferência:', error);
        return res.status(500).json({ error: 'Colapso na inferência do motor IA.', details: error.message });
    }
}
