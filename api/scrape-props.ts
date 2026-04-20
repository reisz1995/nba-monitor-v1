import { createClient } from '@supabase/supabase-js';

const BOOKMAKERS_PRIORITY = ['draftkings', 'fanduel', 'pinnacle', 'betmgm', 'bovada'];

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
        return res.status(500).json({ error: 'Falta ODDS_API_KEY.' });
    }

    const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${API_KEY}&regions=us&markets=player_points,player_rebounds,player_assists&oddsFormat=decimal`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`The Odds API error: ${response.statusText}`);
        }

        const data = await response.json();
        const recordsToUpsert: any[] = [];

        for (const event of data) {
            // Usa commence_time para definir local date de jogo
            const gameDate = new Date(event.commence_time).toISOString().split('T')[0];

            // Procura o bookmaker favorito que possua props neste evento
            let selectedBookmaker = null;
            for (const b of BOOKMAKERS_PRIORITY) {
                const found = event.bookmakers.find((bm: any) => bm.key === b);
                if (found) {
                    selectedBookmaker = found;
                    break;
                }
            }
            if (!selectedBookmaker && event.bookmakers.length > 0) {
                selectedBookmaker = event.bookmakers[0]; // fallback
            }

            if (!selectedBookmaker) continue;

            for (const market of selectedBookmaker.markets) {
                // market: { key: 'player_points', outcomes: [...] }
                const marketKey = market.key;

                // Agrupa outcomes pelo nome do jogador
                const playerMap = new Map<string, { over: number, under: number, point: number }>();

                for (const outcome of market.outcomes) {
                    // outcome format: { name: "Over"/"Under", description: "LeBron James", price: 1.9, point: 26.5 }
                    const pName = outcome.description;
                    if (!pName) continue;

                    if (!playerMap.has(pName)) playerMap.set(pName, { over: 0, under: 0, point: outcome.point || 0 });
                    const stats = playerMap.get(pName)!;

                    if (outcome.name === 'Over') stats.over = outcome.price;
                    if (outcome.name === 'Under') stats.under = outcome.price;
                    stats.point = outcome.point || stats.point;
                }

                // Push to UPSERT list
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
        }

        if (recordsToUpsert.length > 0) {
            const { error } = await supabaseAdmin
                .from('nba_player_props')
                .upsert(recordsToUpsert, { onConflict: 'game_date,player_name,market' });

            if (error) throw error;
        }

        return res.status(200).json({
            success: true,
            message: `${recordsToUpsert.length} props catalogadas com sucesso!`
        });

    } catch (err: any) {
        console.error('Props Scraper error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
