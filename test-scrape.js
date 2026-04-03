import * as cheerio from 'cheerio';
const PICKDAWGZ_API_URL = 'https://stats.pickdawgz.com/get-upcoming-games-data?sport=basketball&league=nba&page=upcoming-games&location=&widget_view=false';
const resp = await fetch(PICKDAWGZ_API_URL);
const data = await resp.json();
const $ = cheerio.load(data.html);
const allTeams = $('.team-name strong.ms-none').map((_, el) => $(el).text().trim()).get();
console.log(allTeams);
