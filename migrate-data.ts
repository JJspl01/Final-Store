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
 * Validate if a date string is in a proper format for Supabase
 */
function isValidDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;

  // Check if it's already in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(dateStr)) {
    // Check if the year is reasonable (between 1900 and 2030)
    const year = parseInt(dateStr.substring(0, 4));
    return year >= 1970 && year <= 2030;
  }

  // Check if it's in date-only format (YYYY-MM-DD)
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    // Check if the year is reasonable (between 1900 and 2030)
    const year = parseInt(dateStr.substring(0, 4));
    return year >= 1970 && year <= 2030;
  }

  // Check if it's in datetime format without milliseconds (YYYY-MM-DDTHH:mm:ss)
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateStr)) {
    // Check if the year is reasonable (between 1900 and 2030)
    const year = parseInt(dateStr.substring(0, 4));
    return year >= 1970 && year <= 2030;
  }

  // Try to parse it as a date
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return false;
    }
    // Check if the year is reasonable (between 1970 and 2030)
    const year = date.getFullYear();
    return year >= 1970 && year <= 2030;
  } catch (e) {
    return false;
  }
}

/**
 * Convert camelCase Google Sheets field names to snake_case for Supabase
 */
function convertToSnakeCase(record: any): any {
  const converted: any = {};

  // Define mapping from camelCase to snake_case
  const fieldMapping: Record<string, string> = {
    timestamp: 'timestamp',
    indentNumber: 'indent_number',
    indenterName: 'indenter_name',
    department: 'department',
    areaOfUse: 'area_of_use',
    groupHead: 'group_head',
    productName: 'product_name',
    quantity: 'quantity',
    uom: 'uom',
    specifications: 'specifications',
    indentApprovedBy: 'indent_approved_by',
    indentType: 'indent_type',
    attachment: 'attachment',
    planned1: 'planned_1',
    actual1: 'actual_1',
    timeDelay1: 'time_delay_1',
    vendorType: 'vendor_type',
    approvedQuantity: 'approved_quantity',
    planned2: 'planned_2',
    actual2: 'actual_2',
    timeDelay2: 'time_delay_2',
    vendorName1: 'vendor_name_1',
    rate1: 'rate_1',
    paymentTerm1: 'payment_term_1',
    vendorName2: 'vendor_name_2',
    rate2: 'rate_2',
    paymentTerm2: 'payment_term_2',
    vendorName3: 'vendor_name_3',
    rate3: 'rate_3',
    paymentTerm3: 'payment_term_3',
    comparisonSheet: 'comparison_sheet',
    planned3: 'planned_3',
    actual3: 'actual_3',
    timeDelay3: 'time_delay_3',
    approvedVendorName: 'approved_vendor_name',
    approvedRate: 'approved_rate',
    approvedPaymentTerm: 'approved_payment_term',
    approvedDate: 'approved_date',
    planned4: 'planned_4',
    actual4: 'actual_4',
    timeDelay4: 'time_delay_4',
    poNumber: 'po_number',
    poCopy: 'po_copy',
    planned5: 'planned_5',
    actual5: 'actual_5',
    timeDelay5: 'time_delay_5',
    receiveStatus: 'receive_status',
    planned6: 'planned_6',
    actual6: 'actual_6',
    timeDelay6: 'time_delay_6',
    issueApprovedBy: 'issue_approved_by',
    issueStatus: 'issue_status',
    issuedQuantity: 'issued_quantity',
    planned7: 'planned_7',
    actual7: 'actual_7',
    timeDelay7: 'time_delay_7',
    billStatus: 'bill_status',
    billNumber: 'bill_number',
    qty: 'qty',
    leadTimeToLiftMaterial: 'lead_time_to_lift_material',
    typeOfBill: 'type_of_bill',
    billAmount: 'bill_amount',
    discountAmount: 'discount_amount',
    paymentType: 'payment_type',
    advanceAmountIfAny: 'advance_amount_if_any',
    photoOfBill: 'photo_of_bill',
    rate: 'rate',
    rowIndex: 'row_index',
    sheetName: 'sheet_name',
    ref: 'ref',
    transportingAmount: 'transporting_amount',
    // Add more mappings as needed
  };

  for (const [key, value] of Object.entries(record)) {
    const snakeCaseKey = fieldMapping[key] || key; // Use mapping or keep original if not found
    converted[snakeCaseKey] = value;
  }

  return converted;
}

/**
 * Migrate indent data from Google Sheets to Supabase
 */
async function migrateIndentData() {
  console.log('Starting indent data migration...');

  try {
    const indentData = await fetchGoogleSheetsData('INDENT');

    // Insert data into Supabase
    for (const record of indentData) {
      // Convert field names from camelCase to snake_case
      let convertedRecord = convertToSnakeCase(record);

      // Only include fields that exist in the Supabase table based on the schema we saw
      // Also validate date fields to prevent insertion errors
      const filteredRecord = {
        timestamp: isValidDate(convertedRecord.timestamp) ? convertedRecord.timestamp : null,
        indent_number: convertedRecord.indent_number || null,
        indenter_name: convertedRecord.indenter_name || null,
        department: convertedRecord.department || null,
        area_of_use: convertedRecord.area_of_use || null,
        group_head: convertedRecord.group_head || null,
        product_name: convertedRecord.product_name || null,
        quantity: convertedRecord.quantity ? Number(convertedRecord.quantity) : null,
        uom: convertedRecord.uom || null,
        specifications: convertedRecord.specifications || null,
        indent_approved_by: convertedRecord.indent_approved_by || null,
        indent_type: convertedRecord.indent_type || null,
        attachment: convertedRecord.attachment || null,
        planned_1: isValidDate(convertedRecord.planned_1) ? convertedRecord.planned_1 : null,
        actual_1: isValidDate(convertedRecord.actual_1) ? convertedRecord.actual_1 : null,
        time_delay_1: isValidDate(convertedRecord.time_delay_1) ? convertedRecord.time_delay_1 : null,
        vendor_type: convertedRecord.vendor_type || null,
        approved_quantity: convertedRecord.approved_quantity ? Number(convertedRecord.approved_quantity) : null,
        planned_2: isValidDate(convertedRecord.planned_2) ? convertedRecord.planned_2 : null,
        actual_2: isValidDate(convertedRecord.actual_2) ? convertedRecord.actual_2 : null,
        time_delay_2: isValidDate(convertedRecord.time_delay_2) ? convertedRecord.time_delay_2 : null,
        vendor_name_1: convertedRecord.vendor_name_1 || null,
        rate_1: convertedRecord.rate_1 ? Number(convertedRecord.rate_1) : null,
        payment_term_1: convertedRecord.payment_term_1 || null,
        vendor_name_2: convertedRecord.vendor_name_2 || null,
        rate_2: convertedRecord.rate_2 ? Number(convertedRecord.rate_2) : null,
        payment_term_2: convertedRecord.payment_term_2 || null,
        vendor_name_3: convertedRecord.vendor_name_3 || null,
        rate_3: convertedRecord.rate_3 ? Number(convertedRecord.rate_3) : null,
        payment_term_3: convertedRecord.payment_term_3 || null,
        comparison_sheet: convertedRecord.comparison_sheet || null,
        planned_3: isValidDate(convertedRecord.planned_3) ? convertedRecord.planned_3 : null,
        actual_3: isValidDate(convertedRecord.actual_3) ? convertedRecord.actual_3 : null,
        time_delay_3: isValidDate(convertedRecord.time_delay_3) ? convertedRecord.time_delay_3 : null,
        approved_vendor_name: convertedRecord.approved_vendor_name || null,
        approved_rate: convertedRecord.approved_rate ? Number(convertedRecord.approved_rate) : null,
        approved_payment_term: convertedRecord.approved_payment_term || null,
        approved_date: isValidDate(convertedRecord.approved_date) ? convertedRecord.approved_date : null,
        planned_4: isValidDate(convertedRecord.planned_4) ? convertedRecord.planned_4 : null,
        actual_4: isValidDate(convertedRecord.actual_4) ? convertedRecord.actual_4 : null,
        time_delay_4: isValidDate(convertedRecord.time_delay_4) ? convertedRecord.time_delay_4 : null,
        po_number: convertedRecord.po_number || null,
        po_copy: convertedRecord.po_copy || null,
        planned_5: isValidDate(convertedRecord.planned_5) ? convertedRecord.planned_5 : null,
        actual_5: isValidDate(convertedRecord.actual_5) ? convertedRecord.actual_5 : null,
        time_delay_5: isValidDate(convertedRecord.time_delay_5) ? convertedRecord.time_delay_5 : null,
        receive_status: convertedRecord.receive_status || null,
        planned_6: isValidDate(convertedRecord.planned_6) ? convertedRecord.planned_6 : null,
        actual_6: isValidDate(convertedRecord.actual_6) ? convertedRecord.actual_6 : null,
        time_delay_6: isValidDate(convertedRecord.time_delay_6) ? convertedRecord.time_delay_6 : null,
        issue_approved_by: convertedRecord.issue_approved_by || null,
        issue_status: convertedRecord.issue_status || null,
        issued_quantity: convertedRecord.issued_quantity ? Number(convertedRecord.issued_quantity) : null,
        planned_7: isValidDate(convertedRecord.planned_7) ? convertedRecord.planned_7 : null,
        actual_7: isValidDate(convertedRecord.actual_7) ? convertedRecord.actual_7 : null,
        time_delay_7: isValidDate(convertedRecord.time_delay_7) ? convertedRecord.time_delay_7 : null,
        bill_status: convertedRecord.bill_status || null,
        bill_number: convertedRecord.bill_number || null,
        qty: convertedRecord.qty ? Number(convertedRecord.qty) : null,
        lead_time_to_lift_material: convertedRecord.lead_time_to_lift_material ? Number(convertedRecord.lead_time_to_lift_material) : null,
        type_of_bill: convertedRecord.type_of_bill || null,
        bill_amount: convertedRecord.bill_amount ? Number(convertedRecord.bill_amount) : null,
        discount_amount: convertedRecord.discount_amount ? Number(convertedRecord.discount_amount) : null,
        payment_type: convertedRecord.payment_type || null,
        advance_amount_if_any: convertedRecord.advance_amount_if_any ? Number(convertedRecord.advance_amount_if_any) : null,
        photo_of_bill: convertedRecord.photo_of_bill || null,
        rate: convertedRecord.rate ? Number(convertedRecord.rate) : null,
      };

      const { error } = await supabase
        .from('indent')
        .upsert(filteredRecord, { onConflict: 'indent_number' }); // Using snake_case field name

      if (error) {
        console.error('Error inserting indent record:', error);
        console.error('Record:', filteredRecord);
      }
    }

    console.log(`Migrated ${indentData.length} indent records to Supabase`);
  } catch (error) {
    console.error('Error migrating indent data:', error);
  }
}

/**
 * Migrate master sheet data (vendors, departments, items, company info) to Supabase
 */
async function migrateMasterData() {
  console.log('Starting master data migration...');

  try {
    const masterData = await fetchGoogleSheetsData('MASTER');

    // Process vendors
    const vendorsMap: Record<string, any> = {};
    const departmentsSet = new Set<string>();
    const itemsMap: Record<string, any> = {};

    // Assuming masterData contains structured data similar to what's processed in fetchers.ts
    // We need to reconstruct the data from raw rows
    for (const row of masterData) {
      // Extract vendor information
      if (row.vendorName) {
        // Convert to snake_case for Supabase
        vendorsMap[row.vendorName] = {
          name: row.vendorName || row.name,
          gstin: row.vendorGstin || row.gstin || '',
          address: row.vendorAddress || row.address || '',
          email: row.vendorEmail || row.email || ''
        };
      }

      // Extract department information
      if (row.department) {
        departmentsSet.add(row.department);
      }

      // Extract item/group head information
      if (row.groupHead && row.itemName) {
        itemsMap[`${row.groupHead}-${row.itemName}`] = {
          product_name: row.itemName,
          group_head: row.groupHead
        };
      }
    }

    // Insert vendors into Supabase
    const vendors = Object.values(vendorsMap);
    if (vendors.length > 0) {
      for (const vendor of vendors) {
        const { error } = await supabase
          .from('vendors')
          .upsert(vendor, { onConflict: 'name' });

        if (error) {
          console.error('Error inserting vendor:', error);
          console.error('Vendor:', vendor);
        }
      }
      console.log(`Migrated ${vendors.length} vendors to Supabase`);
    }

    // Insert departments into Supabase
    const departments = Array.from(departmentsSet).map(name => ({ name }));
    if (departments.length > 0) {
      for (const dept of departments) {
        const { error } = await supabase
          .from('departments')
          .upsert(dept, { onConflict: 'name' });

        if (error) {
          console.error('Error inserting department:', error);
          console.error('Department:', dept);
        }
      }
      console.log(`Migrated ${departments.length} departments to Supabase`);
    }

    // Insert items into Supabase
    const items = Object.values(itemsMap);
    if (items.length > 0) {
      for (const item of items) {
        const { error } = await supabase
          .from('items')
          .upsert(item, { onConflict: 'product_name' });

        if (error) {
          console.error('Error inserting item:', error);
          console.error('Item:', item);
        }
      }
      console.log(`Migrated ${items.length} items to Supabase`);
    }

    // Handle company info separately if present in the data
    // This would typically be a single record
    const companyInfo = {
      company_name: masterData[0]?.companyName || masterData[0]?.company_name || '',
      company_address: masterData[0]?.companyAddress || masterData[0]?.company_address || '',
      company_gstin: masterData[0]?.companyGstin || masterData[0]?.company_gstin || '',
      company_phone: masterData[0]?.companyPhone || masterData[0]?.company_phone || '',
      company_pan: masterData[0]?.companyPan || masterData[0]?.company_pan || '',
      billing_address: masterData[0]?.billingAddress || masterData[0]?.billing_address || '',
      destination_address: masterData[0]?.destinationAddress || masterData[0]?.destination_address || ''
    };

    if (companyInfo.company_name) {
      const { error } = await supabase
        .from('company_info')
        .upsert(companyInfo, { onConflict: 'company_name' });

      if (error) {
        console.error('Error inserting company info:', error);
        console.error('Company Info:', companyInfo);
      } else {
        console.log('Migrated company info to Supabase');
      }
    }

  } catch (error) {
    console.error('Error migrating master data:', error);
  }
}

/**
 * Migrate other sheet data (received, PO master, inventory, etc.)
 */
async function migrateOtherData() {
  console.log('Starting other data migrations...');

  // Migrate RECEIVED data
  try {
    const receivedData = await fetchGoogleSheetsData('RECEIVED');

    for (const record of receivedData) {
      // Convert field names to snake_case
      const convertedRecord = convertToSnakeCase(record);

      // Clean up numeric values and validate dates
      const cleanedRecord = {
        timestamp: isValidDate(convertedRecord.timestamp) ? convertedRecord.timestamp : null,
        indent_number: convertedRecord.indent_number || null,
        po_date: isValidDate(convertedRecord.po_date) ? convertedRecord.po_date : null,
        po_number: convertedRecord.po_number || null,
        vendor: convertedRecord.vendor || null,
        received_status: convertedRecord.received_status || null,
        received_quantity: convertedRecord.received_quantity ? Number(convertedRecord.received_quantity) : null,
        uom: convertedRecord.uom || null,
        photo_of_product: convertedRecord.photo_of_product || null,
        warranty_status: convertedRecord.warranty_status || null,
        end_date: isValidDate(convertedRecord.end_date) ? convertedRecord.end_date : null,
        bill_status: convertedRecord.bill_status || null,
        bill_number: convertedRecord.bill_number || null,
        bill_amount: convertedRecord.bill_amount ? Number(convertedRecord.bill_amount) : null,
        photo_of_bill: convertedRecord.photo_of_bill || null,
        any_transportations: convertedRecord.any_transportations || null,
        transporter_name: convertedRecord.transporter_name || null,
        transporting_amount: convertedRecord.transporting_amount ? Number(convertedRecord.transporting_amount) : null,
      };

      const { error } = await supabase
        .from('received')
        .upsert(cleanedRecord, { onConflict: 'po_number' }); // Using snake_case field name

      if (error) {
        console.error('Error inserting received record:', error);
        console.error('Record:', cleanedRecord);
      }
    }

    console.log(`Migrated ${receivedData.length} received records to Supabase`);
  } catch (error) {
    console.error('Error migrating received data:', error);
  }

  // Migrate PO MASTER data
  try {
    const poMasterData = await fetchGoogleSheetsData('PO MASTER');

    for (const record of poMasterData) {
      // Convert field names to snake_case
      const convertedRecord = convertToSnakeCase(record);

      // Clean up numeric values and validate dates
      const cleanedRecord = {
        timestamp: isValidDate(convertedRecord.timestamp) ? convertedRecord.timestamp : null,
        discount_percent: convertedRecord.discount_percent ? Number(convertedRecord.discount_percent) : null,
        gst_percent: convertedRecord.gst_percent ? Number(convertedRecord.gst_percent) : null,
        party_name: convertedRecord.party_name || null,
        po_number: convertedRecord.po_number || null,
        internal_code: convertedRecord.internal_code || null,
        product: convertedRecord.product || null,
        description: convertedRecord.description || null,
        quantity: convertedRecord.quantity ? Number(convertedRecord.quantity) : null,
        unit: convertedRecord.unit || null,
        rate: convertedRecord.rate ? Number(convertedRecord.rate) : null,
        gst: convertedRecord.gst ? Number(convertedRecord.gst) : null,
        discount: convertedRecord.discount ? Number(convertedRecord.discount) : null,
        amount: convertedRecord.amount ? Number(convertedRecord.amount) : null,
        total_po_amount: convertedRecord.total_po_amount ? Number(convertedRecord.total_po_amount) : null,
        prepared_by: convertedRecord.prepared_by || null,
        approved_by: convertedRecord.approved_by || null,
        pdf: convertedRecord.pdf || null,
        quotation_number: convertedRecord.quotation_number || null,
        quotation_date: isValidDate(convertedRecord.quotation_date) ? convertedRecord.quotation_date : null,
        enquiry_number: convertedRecord.enquiry_number || null,
        enquiry_date: isValidDate(convertedRecord.enquiry_date) ? convertedRecord.enquiry_date : null,
        term1: convertedRecord.term1 || null,
        term2: convertedRecord.term2 || null,
        term3: convertedRecord.term3 || null,
        term4: convertedRecord.term4 || null,
        term5: convertedRecord.term5 || null,
        term6: convertedRecord.term6 || null,
        term7: convertedRecord.term7 || null,
        term8: convertedRecord.term8 || null,
        term9: convertedRecord.term9 || null,
        term10: convertedRecord.term10 || null,
      };

      const { error } = await supabase
        .from('po_master')
        .upsert(cleanedRecord, { onConflict: 'po_number' }); // Using snake_case field name

      if (error) {
        console.error('Error inserting PO master record:', error);
        console.error('Record:', cleanedRecord);
      }
    }

    console.log(`Migrated ${poMasterData.length} PO master records to Supabase`);
  } catch (error) {
    console.error('Error migrating PO master data:', error);
  }

  // Migrate INVENTORY data
  try {
    const inventoryData = await fetchGoogleSheetsData('INVENTORY');

    // Define mapping for inventory fields
    const inventoryFieldMapping: Record<string, string> = {
      groupHead: 'group_head',
      itemName: 'item_name',
      uom: 'uom',
      maxLevel: 'max_level',
      opening: 'opening',
      individualRate: 'individual_rate',
      indented: 'indented',
      approved: 'approved',
      purchaseQuantity: 'purchase_quantity',
      outQuantity: 'out_quantity',
      current: 'current',
      totalPrice: 'total_price',
      colorCode: 'color_code'
    };

    for (const record of inventoryData) {
      // Convert field names to snake_case for inventory
      const convertedRecord = convertToSnakeCase(record);

      // Clean up numeric values and validate dates
      const cleanedRecord = {
        group_head: convertedRecord.group_head || null,
        item_name: convertedRecord.item_name || null,  // Changed from product_name to item_name based on schema
        uom: convertedRecord.uom || null,
        max_level: convertedRecord.max_level ? Number(convertedRecord.max_level) : null,
        opening: convertedRecord.opening ? Number(convertedRecord.opening) : null,
        individual_rate: convertedRecord.individual_rate ? Number(convertedRecord.individual_rate) : null,
        indented: convertedRecord.indented ? Number(convertedRecord.indented) : null,
        approved: convertedRecord.approved ? Number(convertedRecord.approved) : null,
        purchase_quantity: convertedRecord.purchase_quantity ? Number(convertedRecord.purchase_quantity) : null,
        out_quantity: convertedRecord.out_quantity ? Number(convertedRecord.out_quantity) : null,
        current: convertedRecord.current ? Number(convertedRecord.current) : null,
        total_price: convertedRecord.total_price ? Number(convertedRecord.total_price) : null,
        color_code: convertedRecord.color_code || null,
        timestamp: isValidDate(convertedRecord.timestamp) ? convertedRecord.timestamp : null,
      };

      const { error } = await supabase
        .from('inventory')
        .upsert(cleanedRecord, { onConflict: ['group_head', 'item_name'] }); // Using snake_case field names

      if (error) {
        console.error('Error inserting inventory record:', error);
        console.error('Record:', cleanedRecord);
      }
    }

    console.log(`Migrated ${inventoryData.length} inventory records to Supabase`);
  } catch (error) {
    console.error('Error migrating inventory data:', error);
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('Starting data migration from Google Sheets to Supabase...');

  await migrateIndentData();
  await migrateMasterData();
  await migrateOtherData();

  console.log('Data migration completed!');
}

// Run the migration if this file is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  runMigration().catch(console.error);
}

export { migrateIndentData, migrateMasterData, migrateOtherData, runMigration };