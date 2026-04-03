import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data, error } = await s.from('game_predictions').select('*').order('date', { ascending: false }).limit(10);
console.log(JSON.stringify(data, null, 2));
console.log(error);
