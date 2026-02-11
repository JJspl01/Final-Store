import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client using environment variables from the browser
// For Node.js execution, we'll need to access them differently
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables are not set. Please set SUPABASE_URL and SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Fetch data from Google Sheets via the Apps Script endpoint
 */
async function fetchGoogleSheetsData(sheetName: string) {
  // Using the same URL as in the frontend
  const googleAppsScriptUrl = process.env.VITE_APP_SCRIPT_URL || process.env.APP_SCRIPT_URL;
  
  if (!googleAppsScriptUrl) {
    throw new Error('APP_SCRIPT_URL environment variable is not set');
  }

  const url = `${googleAppsScriptUrl}?sheetName=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch data from Google Sheets for ${sheetName}: ${response.statusText}`);
  }

  const raw = await response.json();
  if (!raw.success) {
    throw new Error(`Failed to parse data from Google Sheets for ${sheetName}: ${raw.message || 'Unknown error'}`);
  }

  return raw.rows || [];
}

/**
 * Test connection to Supabase and Google Sheets
 */
async function testConnection() {
  console.log('Testing connections...');
  
  // Test Supabase connection by fetching a count from a known table
  try {
    const { count, error } = await supabase
      .from('indent')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Supabase connection error:', error);
    } else {
      console.log(`Connected to Supabase. Current indent table has ${count} records.`);
    }
  } catch (error) {
    console.error('Error testing Supabase connection:', error);
  }
  
  // Test Google Sheets connection by fetching a small sample
  try {
    const sampleData = await fetchGoogleSheetsData('INDENT');
    console.log(`Connected to Google Sheets. Sample has ${sampleData.length} records.`);
    if (sampleData.length > 0) {
      console.log('Sample record:', JSON.stringify(sampleData[0], null, 2));
    }
  } catch (error) {
    console.error('Error testing Google Sheets connection:', error);
  }
}

/**
 * Test migration with a small subset of data
 */
async function testMigration() {
  console.log('\nStarting test migration with limited data...');
  
  try {
    // Fetch a small sample of indent data (first 5 records)
    const indentData = await fetchGoogleSheetsData('INDENT');
    const testData = indentData.slice(0, 5); // Take only first 5 records for testing
    
    console.log(`Testing migration with ${testData.length} indent records...`);
    
    // Insert test data into Supabase
    for (const record of testData) {
      // Clean up the record to match Supabase schema expectations
      const cleanedRecord = {
        ...record,
        quantity: record.quantity ? Number(record.quantity) : null,
        approvedQuantity: record.approvedQuantity ? Number(record.approvedQuantity) : null,
        rate1: record.rate1 ? Number(record.rate1) : null,
        rate2: record.rate2 ? Number(record.rate2) : null,
        rate3: record.rate3 ? Number(record.rate3) : null,
        approvedRate: record.approvedRate ? Number(record.approvedRate) : null,
        issuedQuantity: record.issuedQuantity ? Number(record.issuedQuantity) : null,
        billAmount: record.billAmount ? Number(record.billAmount) : null,
        discountAmount: record.discountAmount ? Number(record.discountAmount) : null,
        advanceAmountIfAny: record.advanceAmountIfAny ? Number(record.advanceAmountIfAny) : null,
        transportingAmount: record.transportingAmount ? Number(record.transportingAmount) : null,
        rate: record.rate ? Number(record.rate) : null,
      };

      const { error } = await supabase
        .from('indent')
        .upsert(cleanedRecord, { onConflict: 'indentNumber' }); // Assuming indentNumber is unique

      if (error) {
        console.error('Error inserting test indent record:', error);
        console.error('Record:', cleanedRecord);
      } else {
        console.log(`Successfully inserted test record with indent number: ${cleanedRecord.indentNumber}`);
      }
    }

    console.log(`Test migration completed with ${testData.length} records`);
  } catch (error) {
    console.error('Error in test migration:', error);
  }
}

/**
 * Main test function
 */
async function runTest() {
  console.log('Running connection and migration tests...\n');
  
  await testConnection();
  await testMigration();
  
  console.log('\nTest completed!');
}

// Run the test if this file is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  runTest().catch(console.error);
}

export { testConnection, testMigration, runTest };