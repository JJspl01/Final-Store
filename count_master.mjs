import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function countMaster() {
    const { count, error } = await supabase.from('master').select('*', { count: 'exact', head: true });
    if (error) return console.error(error);
    console.log('Total rows in master table:', count);
}
countMaster();
