import { createClient } from '@supabase/supabase-js';

const BOOKMAKERS_PRIORITY = ['draftkings', 'fanduel', 'pinnacle', 'betmgm', 'bovada', 'lowvig'];

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido.' });
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
        // v4 endpoint for odds
        const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=decimal`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`The Odds API error: ${response.statusText}`);
        }

        const data = await response.json();
        const recordsToUpsert: any[] = [];

        // Canonical Team mapping for consistency (ensure Clippers etc are right)
        const normalize = (team: string) => {
            if (team === 'LA Clippers') return 'Los Angeles Clippers';
            return team;
        }

        for (const event of data) {
            const awayTeam = normalize(event.away_team);
            const homeTeam = normalize(event.home_team);
            const matchup = `${awayTeam} @ ${homeTeam}`;

            // Procura o melhor bookmaker para esse evento
            let selectedBookmaker = null;
            for (const b of BOOKMAKERS_PRIORITY) {
                const found = event.bookmakers.find((bm: any) => bm.key === b);
                if (found) {
                    selectedBookmaker = found;
                    break;
                }
            }
            if (!selectedBookmaker && event.bookmakers.length > 0) {
                selectedBookmaker = event.bookmakers[0];
            }

            if (!selectedBookmaker) continue;

            const h2hMarket = selectedBookmaker.markets.find((m: any) => m.key === 'h2h');
            const spreadMarket = selectedBookmaker.markets.find((m: any) => m.key === 'spreads');
            const totalMarket = selectedBookmaker.markets.find((m: any) => m.key === 'totals');

            const spreadVal = spreadMarket?.outcomes[0]?.point;
            const totalVal = totalMarket?.outcomes[0]?.point;

            // H2H Prices
            const awayML = h2hMarket?.outcomes.find((o: any) => o.name === event.away_team)?.price || null;
            const homeML = h2hMarket?.outcomes.find((o: any) => o.name === event.home_team)?.price || null;

            recordsToUpsert.push({
                matchup,
                spread: spreadVal !== undefined ? spreadVal : null,
                total: totalVal !== undefined ? totalVal : null,
                moneyline_away: awayML,
                moneyline_home: homeML,
                updated_at: new Date().toISOString()
            });
        }

        if (recordsToUpsert.length > 0) {
            const { error } = await supabaseAdmin
                .from('nba_odds_matrix')
                .upsert(recordsToUpsert, { onConflict: 'matchup' });

            if (error) throw error;
        }

        return res.status(200).json({
            success: true,
            message: `${recordsToUpsert.length} matchups atualizados via The Odds API!`
        });

    } catch (err: any) {
        console.error('Market Odds Scraper error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
