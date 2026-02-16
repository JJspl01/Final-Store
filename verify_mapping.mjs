import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkMapping() {
    const { data, error } = await supabase.from('master').select('department, create_group_head, group_head, item_name');
    if (error) return console.error(error);

    const categories = Array.from(
        new Set([
            ...data.map(d => d.create_group_head?.trim()),
            ...data.map(d => d.group_head?.trim())
        ])
    ).filter(Boolean);

    const groupHeadItems = {};

    categories.forEach(categoryName => {
        const matchedItems = data
            .filter(row => {
                const head = row.group_head?.toLowerCase().trim();
                const selection = categoryName.toLowerCase().trim();
                return head === selection;
            })
            .map(row => row.item_name)
            .filter(Boolean);

        groupHeadItems[categoryName] = Array.from(new Set(matchedItems));
    });

    console.log('Mapping for "Tapper Washer":', groupHeadItems['Tapper Washer']);
    console.log('All categories with items (sample):', Object.keys(groupHeadItems).filter(k => groupHeadItems[k].length > 0).slice(0, 10));

    // Check specifically for "Tapper Washer" rows in raw data
    const rawTapper = data.filter(d =>
        (d.group_head && d.group_head.toLowerCase().trim() === 'tapper washer') ||
        (d.create_group_head && d.create_group_head.toLowerCase().trim() === 'tapper washer')
    );
    console.log('Raw data related to Tapper Washer:');
    console.table(rawTapper);
}
checkMapping();
