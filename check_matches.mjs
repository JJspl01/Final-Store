import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('master').select('create_group_head, group_head, item_name');
    if (error) return console.error(error);

    const matches = data.filter(row =>
        row.create_group_head &&
        row.group_head &&
        row.create_group_head.trim() === row.group_head.trim()
    );

    console.log(`Found ${matches.length} rows where create_group_head === group_head`);
    if (matches.length > 0) {
        const categories = [...new Set(matches.map(m => m.create_group_head))];
        console.log('Categories with matching columns:', categories);
        console.table(matches.slice(0, 10));
    } else {
        console.log('No rows found where both columns match exactly.');
    }
}
check();
