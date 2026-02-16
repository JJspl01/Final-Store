import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function searchTapperWasher() {
    console.log('Searching for "Tapper Washer" in master table...');

    const { data, error } = await supabase
        .from('master')
        .select('id, item_name, create_group_head, group_head')
        .or('create_group_head.ilike.%Tapper Washer%,group_head.ilike.%Tapper Washer%');

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No results found for "Tapper Washer".');
    } else {
        console.log('Results found:');
        console.table(data);

        // Check exact matches
        const exactMatches = data.filter(row =>
            row.create_group_head?.trim() === 'Tapper Washer' &&
            row.group_head?.trim() === 'Tapper Washer'
        );

        console.log('\nExact matches (create_group_head === "Tapper Washer" AND group_head === "Tapper Washer"):');
        if (exactMatches.length > 0) {
            console.table(exactMatches);
        } else {
            console.log('No exact matches found where both columns are "Tapper Washer".');
        }
    }
}

searchTapperWasher();
