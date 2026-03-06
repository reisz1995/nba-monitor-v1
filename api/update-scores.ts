import { createClient } from '@supabase/supabase-js';
import { withRetry } from '../lib/resilience.js';

// ESPN status type IDs: 1 = pre-game, 2 = in-progress, 3 = final
const LIVE_STATUS_ID = '2';

function hasLiveGames(events: any[]): boolean {
    if (!Array.isArray(events)) return false;
    return events.some(
        (event) => event?.status?.type?.id === LIVE_STATUS_ID
    );
}

export default async function handler(req: any, res: any) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    try {
        await withRetry(async () => {
            // 1. Fetch fresh scores from ESPN
            const espnRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard');
            if (!espnRes.ok) throw new Error(`ESPN API returned ${espnRes.status}`);
            const data = await espnRes.json();
            const events: any[] = data.events ?? [];

            // 2. Skip update if no games are currently live
            if (!hasLiveGames(events)) {
                return; // Normal exit from withRetry, logic continues below
            }

            // 3. Initialize Supabase using SERVICE_ROLE_KEY to bypass RLS
            const supabaseAdmin = createClient(
                process.env.VITE_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            // 4. Update the single row (id=1) in our table
            const { error } = await supabaseAdmin
                .from('live_scoreboard')
                .update({
                    games_data: events,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', 1);

            if (error) throw error;
        }, { retries: 3 });

        // Need to re-fetch or re-calculate for the response if skipped happened inside withRetry
        // Better: refactor to handle the "skipped" state properly.

        const espnRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard');
        const data = await espnRes.json();
        const events: any[] = data.events ?? [];

        if (!hasLiveGames(events)) {
            return res.status(200).json({
                success: true,
                skipped: true,
                message: 'Nenhum jogo ao vivo. Supabase não foi atualizado.',
                liveGames: 0,
            });
        }

        const liveCount = events.filter(
            (e) => e?.status?.type?.id === LIVE_STATUS_ID
        ).length;

        return res.status(200).json({
            success: true,
            skipped: false,
            message: 'Placares atualizados com sucesso.',
            liveGames: liveCount,
        });
    } catch (error: any) {
        console.error('Erro no Cron Job:', error);
        return res.status(500).json({ error: 'Falha ao sincronizar dados.', details: error.message });
    }
}
