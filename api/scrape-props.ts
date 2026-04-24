import { createClient } from '@supabase/supabase-js';
import { withRetry, delay } from '../lib/resilience.js';

const BOOKMAKERS_PRIORITY = ['draftkings', 'fanduel', 'pinnacle', 'betmgm', 'bovada', 'lowvig'];

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const authHeader = req.headers.authorization;
    const isUiTrigger = req.query.ui_trigger === 'true';
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && req.query.cron_bypass !== 'true' && !isUiTrigger) {
        return res.status(401).json({ error: 'ACESSO NEGADO: Gatilho não reconhecido.' });
    }

    const API_KEY = process.env.ODDS_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: 'Falta ODDS_API_KEY no ambiente.' });
    }

    const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // 1. Primeiro, obtemos a lista de eventos para pegar os IDs
        // Usamos o endpoint de odds básico com mercado h2h para ser leve
        const eventsUrl = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${API_KEY}&regions=us&markets=h2h&oddsFormat=decimal`;
        
        const eventsResponse = await fetch(eventsUrl);
        if (!eventsResponse.ok) {
            throw new Error(`Erro ao buscar lista de eventos: ${eventsResponse.statusText}`);
        }
        const events = await eventsResponse.json();
        
        console.log(`[scrape-props] ${events.length} eventos encontrados para busca de props.`);

        const recordsToUpsert: any[] = [];

        // 2. Para cada evento, buscamos os player props individualmente
        for (const event of events) {
            const eventId = event.id;
            const commenceTime = event.commence_time;
            
            await withRetry(async () => {
                const propsUrl = `https://api.the-odds-api.com/v4/sports/basketball_nba/events/${eventId}/odds?apiKey=${API_KEY}&regions=us&markets=player_points,player_rebounds,player_assists&oddsFormat=decimal`;
                
                const response = await fetch(propsUrl);
                if (!response.ok) {
                    // Se for 404 ou 400 para um evento específico, podemos pular
                    if (response.status === 404 || response.status === 400) {
                        console.warn(`[scrape-props] Props não disponíveis para o evento ${eventId}`);
                        return;
                    }
                    throw new Error(`The Odds API error (${response.status}) para evento ${eventId}`);
                }

                const eventData = await response.json();
                const gameDate = new Date(commenceTime).toISOString().split('T')[0];

                // Procura o bookmaker favorito que possua props neste evento
                let selectedBookmaker = null;
                for (const b of BOOKMAKERS_PRIORITY) {
                    const found = eventData.bookmakers.find((bm: any) => bm.key === b);
                    if (found) {
                        selectedBookmaker = found;
                        break;
                    }
                }
                
                if (!selectedBookmaker && eventData.bookmakers.length > 0) {
                    selectedBookmaker = eventData.bookmakers[0];
                }

                if (!selectedBookmaker) return;

                for (const market of selectedBookmaker.markets) {
                    const marketKey = market.key;
                    const playerMap = new Map<string, { over: number, under: number, point: number }>();

                    for (const outcome of market.outcomes) {
                        const pName = outcome.description;
                        if (!pName) continue;

                        if (!playerMap.has(pName)) {
                            playerMap.set(pName, { over: 0, under: 0, point: outcome.point || 0 });
                        }
                        const stats = playerMap.get(pName)!;

                        if (outcome.name === 'Over') stats.over = outcome.price;
                        if (outcome.name === 'Under') stats.under = outcome.price;
                        stats.point = outcome.point || stats.point;
                    }

                    for (const [playerName, stats] of playerMap.entries()) {
                        if (stats.point) {
                            recordsToUpsert.push({
                                game_date: gameDate,
                                player_name: playerName,
                                market: marketKey,
                                line: stats.point,
                                over_odds: stats.over,
                                under_odds: stats.under,
                                updated_at: new Date().toISOString()
                            });
                        }
                    }
                }
            }, { retries: 2, initialDelay: 500 });

            // Pequeno delay para evitar Rate Limit (429)
            await delay(150);
        }

        // 3. Upsert final no Supabase
        if (recordsToUpsert.length > 0) {
            console.log(`[scrape-props] Iniciando upsert de ${recordsToUpsert.length} registros...`);
            const { error } = await supabaseAdmin
                .from('nba_player_props')
                .upsert(recordsToUpsert, { onConflict: 'game_date,player_name,market' });

            if (error) throw error;
        }

        return res.status(200).json({
            success: true,
            message: `${recordsToUpsert.length} props catalogadas com sucesso para ${events.length} jogos!`
        });

    } catch (err: any) {
        console.error('Props Scraper error:', err.message);
        return res.status(500).json({ 
            error: 'Falha na sincronização de Player Props.',
            details: err.message 
        });
    }
}
