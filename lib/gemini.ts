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
        // Ignora chaves que ainda estão com o valor de exemplo ou vazias
        if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'your_gemini_api_key_secondary_here') {
            throw new Error(`Chave ${isFallback ? 'secundária' : 'primária'} inválida ou não configurada.`);
        }

        const ai = new GoogleGenAI({ apiKey });

        try {
            const config: any = {
                temperature: options.temperature ?? 0.1,
            };

            if (options.systemInstruction) config.systemInstruction = options.systemInstruction;
            if (options.responseMimeType) config.responseMimeType = options.responseMimeType;
            if (options.responseSchema) config.responseSchema = options.responseSchema;

            console.log(`[Gemini] Chamando API com chave ${isFallback ? 'secundária' : 'primária'}...`);

            const response = await ai.models.generateContent({
                model: options.model || 'gemini-3-flash-preview',
                contents: prompt,
                config
            });

            if (!response) {
                throw new Error('Resposta nula retornada pelo SDK do Gemini.');
            }

            // O SDK pode retornar text tanto como propriedade quanto como função em algumas versões
            const textValue = typeof response.text === 'function' ? await response.text() : response.text;

            if (!textValue) {
                throw new Error('Campo text ausente ou vazio na resposta do Gemini.');
            }

            // Garante que o retorno tenha a propriedade .text para compatibilidade com o código existente
            return {
                ...response,
                text: textValue
            };
        } catch (error: any) {
            const errorMsg = error.message || 'Erro desconhecido no SDK';
            console.error(`[Gemini] Falha na ${isFallback ? 'chave secundária' : 'chave primária'}:`, errorMsg);
            throw new Error(`${isFallback ? 'Secundária' : 'Primária'}: ${errorMsg}`);
        }
    };

    if (!primaryKey) {
        console.error('[Gemini] GEMINI_API_KEY ausente.');
        if (!secondaryKey) throw new Error('Nenhuma chave de API Gemini configurada nas variáveis de ambiente.');
    }

    try {
        if (!primaryKey) throw new Error('Primary key missing');
        return await executeWithKey(primaryKey);
    } catch (error: any) {
        // Fallback apenas se houver uma chave secundária e ela parecer válida
        if (secondaryKey && secondaryKey !== 'your_gemini_api_key_secondary_here') {
            console.warn('[Gemini] Iniciando fallback para chave secundária...');
            try {
                return await executeWithKey(secondaryKey, true);
            } catch (fallbackError: any) {
                throw fallbackError;
            }
        }
        throw error;
    }
}
