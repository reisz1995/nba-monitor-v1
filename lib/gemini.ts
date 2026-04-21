import { GoogleGenAI } from '@google/genai';

export interface GeminiOptions {
    model?: string;
    systemInstruction?: string;
    temperature?: number;
    responseMimeType?: string;
    responseSchema?: any;
}

/**
 * Utilitário centralizado para gerar conteúdo com Gemini, 
 * suportando fallback automático para GEMINI_API_KEY_SECONDARY 
 * caso a chave primária falhe.
 */
export async function generateGeminiContent(
    prompt: string | any,
    options: GeminiOptions = {}
) {
    const primaryKey = process.env.GEMINI_API_KEY;
    const secondaryKey = process.env.GEMINI_API_KEY_SECONDARY;

    const executeWithKey = async (apiKey: string, isFallback = false) => {
        const ai = new GoogleGenAI({ apiKey });

        try {
            const response = await ai.models.generateContent({
                model: options.model || 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    systemInstruction: options.systemInstruction,
                    responseMimeType: options.responseMimeType,
                    responseSchema: options.responseSchema,
                    temperature: options.temperature ?? 0.1,
                },
            });

            if (!response || !response.text) {
                throw new Error('Resposta vazia ou inválida do Gemini.');
            }

            return response;
        } catch (error: any) {
            console.error(`[Gemini] Falha na ${isFallback ? 'chave secundária' : 'chave primária'}:`, error.message);
            throw error;
        }
    };

    if (!primaryKey) {
        console.error('[Gemini] GEMINI_API_KEY ausente.');
        if (!secondaryKey) throw new Error('Nenhuma chave de API Gemini configurada.');
    }

    try {
        if (!primaryKey) throw new Error('Primary key missing');
        return await executeWithKey(primaryKey);
    } catch (error: any) {
        // Fallback apenas se houver uma chave secundária e o erro permitir retentativa
        if (secondaryKey) {
            console.warn('[Gemini] Iniciando fallback para chave secundária...');
            return await executeWithKey(secondaryKey, true);
        }
        throw error;
    }
}
