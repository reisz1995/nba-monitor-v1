import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    // Optional: Protect the route with a secret key
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    try {
        // 1. Fetch fresh scores from ESPN
        const espnRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard');
        const data = await espnRes.json();

        // 2. Initialize Supabase using SERVICE_ROLE_KEY to bypass RLS
        // Make sure these are set in Vercel Environment Variables
        const supabaseAdmin = createClient(
            process.env.VITE_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 3. Update the single row (id=1) in our table
        const { error } = await supabaseAdmin
            .from('live_scoreboard')
            .update({
                games_data: data.events,
                updated_at: new Date().toISOString()
            })
            .eq('id', 1);

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'Placares atualizados com sucesso.' });
    } catch (error: any) {
        console.error('Erro no Cron Job:', error);
        return res.status(500).json({ error: 'Falha ao sincronizar dados.', details: error.message });
    }
}
