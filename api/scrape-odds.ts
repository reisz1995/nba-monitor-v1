import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { withRetry } from '../lib/resilience.js';

const PICKDAWGZ_API_URL =
    'https://stats.pickdawgz.com/get-upcoming-games-data?sport=basketball&league=nba&page=upcoming-games&location=&widget_view=false';

// Canonical team name mapping (PickDawgz abbreviations → full names)
const TEAM_MAP: Record<string, string> = {
    Atlanta: 'Atlanta Hawks',
    Boston: 'Boston Celtics',
    Brooklyn: 'Brooklyn Nets',
    Charlotte: 'Charlotte Hornets',
    Chicago: 'Chicago Bulls',
    Cleveland: 'Cleveland Cavaliers',
    Dallas: 'Dallas Mavericks',
    Denver: 'Denver Nuggets',
    Detroit: 'Detroit Pistons',
    'Golden State': 'Golden State Warriors',
    Houston: 'Houston Rockets',
    Indiana: 'Indiana Pacers',
    'LA Clippers': 'LA Clippers',
    'L.A. Clippers': 'LA Clippers',
    'L.A. Lakers': 'Los Angeles Lakers',
    'LA Lakers': 'Los Angeles Lakers',
    Memphis: 'Memphis Grizzlies',
    Miami: 'Miami Heat',
    Milwaukee: 'Milwaukee Bucks',
    Minnesota: 'Minnesota Timberwolves',
    'New Orleans': 'New Orleans Pelicans',
    'New York': 'New York Knicks',
    'Oklahoma City': 'Oklahoma City Thunder',
    Orlando: 'Orlando Magic',
    Philadelphia: 'Philadelphia 76ers',
    Phoenix: 'Phoenix Suns',
    Portland: 'Portland Trail Blazers',
    Sacramento: 'Sacramento Kings',
    'San Antonio': 'San Antonio Spurs',
    Toronto: 'Toronto Raptors',
    Utah: 'Utah Jazz',
    Washington: 'Washington Wizards',
    ATL: 'Atlanta Hawks',
    BOS: 'Boston Celtics',
    BKN: 'Brooklyn Nets',
    CHA: 'Charlotte Hornets',
    CHI: 'Chicago Bulls',
    CLE: 'Cleveland Cavaliers',
    DAL: 'Dallas Mavericks',
    DEN: 'Denver Nuggets',
    DET: 'Detroit Pistons',
    GSW: 'Golden State Warriors',
    HOU: 'Houston Rockets',
    IND: 'Indiana Pacers',
    LAC: 'LA Clippers',
    LAL: 'Los Angeles Lakers',
    MEM: 'Memphis Grizzlies',
    MIA: 'Miami Heat',
    MIL: 'Milwaukee Bucks',
    MIN: 'Minnesota Timberwolves',
    NOP: 'New Orleans Pelicans',
    NYK: 'New York Knicks',
    OKC: 'Oklahoma City Thunder',
    ORL: 'Orlando Magic',
    PHI: 'Philadelphia 76ers',
    PHX: 'Phoenix Suns',
    POR: 'Portland Trail Blazers',
    SAC: 'Sacramento Kings',
    SAS: 'San Antonio Spurs',
    TOR: 'Toronto Raptors',
    UTA: 'Utah Jazz',
    WAS: 'Washington Wizards',
};

function normalizeTeamName(raw: string): string {
    const clean = raw.trim();
    return TEAM_MAP[clean] ?? clean;
}

function extractNumeric(text: string): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

export default async function handler(req: any, res: any) {
    // Security gate: only Vercel Cron (or verified callers) may trigger this
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'ACESSO NEGADO: Gatilho não reconhecido.' });
    }

    let gamesUpserted = 0;

    try {
        await withRetry(
            async () => {
                // 1. Initialize Supabase with service-role to bypass RLS
                const supabaseAdmin = createClient(
                    process.env.VITE_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                );

                // 2. Fetch HTML payload from PickDawgz
                const response = await fetch(PICKDAWGZ_API_URL);
                if (!response.ok) {
                    throw new Error(`PickDawgz retornou status ${response.status}`);
                }

                const data = await response.json();
                if (!data.html) {
                    throw new Error('Payload PickDawgz sem campo html.');
                }

                // 3. Parse: extract teams and odds columns
                const $ = cheerio.load(data.html);

                const allTeams = $('.team-name strong.ms-none')
                    .map((_, el) => $(el).text().trim())
                    .get();
                const allML = $('.up-ml-cell .up-odds-point')
                    .map((_, el) => $(el).text().trim())
                    .get();
                const allSpread = $('.up-spread-cell .up-odds-c')
                    .map((_, el) => $(el).text().trim())
                    .get();
                const allTotal = $('.up-total-cell .up-odds-c')
                    .map((_, el) => $(el).text().trim())
                    .get();

                console.log(`[scrape-odds] Teams extraídos: ${allTeams.length}`);

                // 4. Build game objects (pairs: away[i], home[i+1])
                const games: any[] = [];
                for (let i = 0; i + 1 < allTeams.length; i += 2) {
                    const awayTeam = normalizeTeamName(allTeams[i]);
                    const homeTeam = normalizeTeamName(allTeams[i + 1]);
                    const matchup = `${awayTeam} @ ${homeTeam}`;

                    games.push({
                        matchup,
                        moneyline_away: extractNumeric(allML[i] ?? ''),
                        moneyline_home: extractNumeric(allML[i + 1] ?? ''),
                        // Spread and total are symmetric; take first non-null value
                        spread: extractNumeric(allSpread[i] ?? '') ?? extractNumeric(allSpread[i + 1] ?? ''),
                        total: extractNumeric(allTotal[i] ?? '') ?? extractNumeric(allTotal[i + 1] ?? ''),
                        updated_at: new Date().toISOString(),
                    });
                }

                // 5. Upsert into Supabase
                for (const game of games) {
                    const { error } = await supabaseAdmin
                        .from('nba_odds_matrix')
                        .upsert(game, { onConflict: 'matchup' });
                    if (error) throw error;
                }

                gamesUpserted = games.length;
                console.log(`[scrape-odds] ${gamesUpserted} jogos injetados na nba_odds_matrix.`);
            },
            { retries: 3, initialDelay: 2000 }
        );

        return res.status(200).json({
            success: true,
            message: 'MATRIZ DE ODDS ATUALIZADA.',
            gamesUpserted,
        });
    } catch (error: any) {
        console.error('[scrape-odds] FALHA DE SISTEMA:', error);
        return res.status(500).json({
            error: 'Colapso na extração de mercado.',
            details: error.message,
        });
    }
}
