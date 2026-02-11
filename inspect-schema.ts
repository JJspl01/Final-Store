import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables are not set. Please set SUPABASE_URL and SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Inspect the schema of the indent table
 */
async function inspectSchema() {
  try {
    // First, get a sample record to see the structure
    const { data: sampleData, error: sampleError } = await supabase
      .from('indent')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('Error getting sample data:', sampleError);
      return;
    }

    if (sampleData && sampleData.length > 0) {
      console.log('Current indent table sample record structure:');
      console.log(JSON.stringify(sampleData[0], null, 2));
    } else {
      console.log('No records found in indent table');
    }

    // Try to get the table structure using a raw SQL query
    // This requires RLS to be disabled for the information_schema or proper permissions
    try {
      const { data: schemaData, error: schemaError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', 'indent')
        .eq('table_schema', 'public');

      if (schemaError) {
        console.log('Could not query information_schema directly (likely due to RLS). Column names from sample record:');
        if (sampleData && sampleData[0]) {
          console.log(Object.keys(sampleData[0]));
        }
      } else {
        console.log('Indent table schema from information_schema:');
        console.table(schemaData);
      }
    } catch (schemaErr) {
      console.log('Could not query information_schema (likely due to RLS). Column names from sample record:');
      if (sampleData && sampleData[0]) {
        console.log('Available columns:', Object.keys(sampleData[0]));
      }
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Run the inspection
inspectSchema().catch(console.error);