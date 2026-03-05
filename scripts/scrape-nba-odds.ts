
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PICKDAWGZ_API_URL = 'https://stats.pickdawgz.com/get-upcoming-games-data?sport=basketball&league=nba&page=upcoming-games&location=&widget_view=false';

// Canonical team mapping (PickDawgz to local/Supabase)
const teamMapping: { [key: string]: string } = {
    'Atlanta': 'Atlanta Hawks',
    'Boston': 'Boston Celtics',
    'Brooklyn': 'Brooklyn Nets',
    'Charlotte': 'Charlotte Hornets',
    'Chicago': 'Chicago Bulls',
    'Cleveland': 'Cleveland Cavaliers',
    'Dallas': 'Dallas Mavericks',
    'Denver': 'Denver Nuggets',
    'Detroit': 'Detroit Pistons',
    'Golden State': 'Golden State Warriors',
    'Houston': 'Houston Rockets',
    'Indiana': 'Indiana Pacers',
    'LA Clippers': 'LA Clippers',
    'L.A. Clippers': 'LA Clippers',
    'L.A. Lakers': 'Los Angeles Lakers',
    'LA Lakers': 'Los Angeles Lakers',
    'Memphis': 'Memphis Grizzlies',
    'Miami': 'Miami Heat',
    'Milwaukee': 'Milwaukee Bucks',
    'Minnesota': 'Minnesota Timberwolves',
    'New Orleans': 'New Orleans Pelicans',
    'New York': 'New York Knicks',
    'Oklahoma City': 'Oklahoma City Thunder',
    'Orlando': 'Orlando Magic',
    'Philadelphia': 'Philadelphia 76ers',
    'Phoenix': 'Phoenix Suns',
    'Portland': 'Portland Trail Blazers',
    'Sacramento': 'Sacramento Kings',
    'San Antonio': 'San Antonio Spurs',
    'Toronto': 'Toronto Raptors',
    'Utah': 'Utah Jazz',
    'Washington': 'Washington Wizards',
    'ATL': 'Atlanta Hawks',
    'BOS': 'Boston Celtics',
    'BKN': 'Brooklyn Nets',
    'CHA': 'Charlotte Hornets',
    'CHI': 'Chicago Bulls',
    'CLE': 'Cleveland Cavaliers',
    'DAL': 'Dallas Mavericks',
    'DEN': 'Denver Nuggets',
    'DET': 'Detroit Pistons',
    'GSW': 'Golden State Warriors',
    'HOU': 'Houston Rockets',
    'IND': 'Indiana Pacers',
    'LAC': 'LA Clippers',
    'LAL': 'Los Angeles Lakers',
    'MEM': 'Memphis Grizzlies',
    'MIA': 'Miami Heat',
    'MIL': 'Milwaukee Bucks',
    'MIN': 'Minnesota Timberwolves',
    'NOP': 'New Orleans Pelicans',
    'NYK': 'New York Knicks',
    'OKC': 'Oklahoma City Thunder',
    'ORL': 'Orlando Magic',
    'PHI': 'Philadelphia 76ers',
    'PHX': 'Phoenix Suns',
    'POR': 'Portland Trail Blazers',
    'SAC': 'Sacramento Kings',
    'SAS': 'San Antonio Spurs',
    'TOR': 'Toronto Raptors',
    'UTA': 'Utah Jazz',
    'WAS': 'Washington Wizards'
};

function normalizeTeamName(name: string): string {
    const cleanName = name.trim();
    return teamMapping[cleanName] || cleanName;
}

async function scrapeOdds() {
    console.log('Fetching odds from PickDawgz...');
    try {
        const response = await fetch(PICKDAWGZ_API_URL);
        const data = await response.json();

        if (!data.html) {
            console.error('No HTML data found in response');
            return;
        }

        const $ = cheerio.load(data.html);
        const games: any[] = [];

        // Based on inspected HTML, games are in rows with specific classes
        // The structure shows games are often double-row or structured within a tbody
        $('tr').each((_, element) => {
            const row = $(element);

            // Look for team names in spans or strong tags
            const teamNames = row.find('.team-name strong.ms-none, .team-name').map((_, el) => $(el).text().trim()).get();
            // Sometimes they are in different rows, but the API response seems to have 
            // a specific structure where we can identify matchups.

            // Attempt 1: Pairwise rows (Away then Home)
            // PickDawgz often groups them. Let's look for the .up-ml-cell or similar to find game rows.
        });

        // REFINED SCRAPING LOGIC based on debug_scraper.html
        // We look for segments that contain two teams.
        const allTeams = $('.team-name strong.ms-none').map((_, el) => $(el).text().trim()).get();
        const allML = $('.up-ml-cell .up-odds-point').map((_, el) => $(el).text().trim()).get();
        const allSpread = $('.up-spread-cell .up-odds-c').map((_, el) => $(el).text().trim()).get();
        const allTotal = $('.up-total-cell .up-odds-c').map((_, el) => $(el).text().trim()).get();

        console.log(`Found ${allTeams.length} potential team entries.`);

        for (let i = 0; i < allTeams.length; i += 2) {
            if (i + 1 >= allTeams.length) break;

            const awayTeamRaw = allTeams[i];
            const homeTeamRaw = allTeams[i + 1];

            const awayTeam = normalizeTeamName(awayTeamRaw);
            const homeTeam = normalizeTeamName(homeTeamRaw);
            const matchup = `${awayTeam} @ ${homeTeam}`;

            const extractNumeric = (text: string) => {
                if (!text) return null;
                // Handle "o221.5" or "u221.5"
                const cleaned = text.replace(/[^\d.-]/g, '');
                const num = parseFloat(cleaned);
                return isNaN(num) ? null : num;
            };

            const gameData = {
                matchup,
                moneyline_away: extractNumeric(allML[i]),
                moneyline_home: extractNumeric(allML[i + 1]),
                spread: extractNumeric(allSpread[i]) || extractNumeric(allSpread[i + 1]), // Usually same value
                total: extractNumeric(allTotal[i]) || extractNumeric(allTotal[i + 1]), // Usually same value
            };

            games.push(gameData);
        }

        console.log(`Extracted ${games.length} games.`);

        for (const game of games) {
            console.log(`Upserting: ${game.matchup} (Spread: ${game.spread}, Total: ${game.total})`);
            const { error } = await supabase
                .from('nba_odds_matrix')
                .upsert(game, { onConflict: 'matchup' });

            if (error) {
                console.error(`Error upserting ${game.matchup}:`, error.message);
            }
        }

        console.log('Scraping completed successfully.');
    } catch (error) {
        console.error('Scraping failed:', error);
    }
}

scrapeOdds();
