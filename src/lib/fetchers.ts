import type { IndentSheet, MasterSheet, ReceivedSheet, Sheet } from '@/types';
import type { InventorySheet, PoMasterSheet, QuotationHistorySheet, UserPermissions, Vendor } from '@/types/sheets';
import { supabase } from './supabaseClient';

// Cache helper using localStorage
export const getCache = (key: string) => {
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;
        const { value, expiry } = JSON.parse(item);
        if (new Date().getTime() > expiry) {
            localStorage.removeItem(key);
            return null;
        }
        return value;
    } catch (e) {
        return null;
    }
};

export const setCache = (key: string, value: any, ttlMinutes: number = 30) => {
    try {
        const item = {
            value,
            expiry: new Date().getTime() + ttlMinutes * 60000,
        };
        localStorage.setItem(key, JSON.stringify(item));
    } catch (e) {
        console.error('Error setting cache:', e);
    }
};

// Helper to convert snake_case keys to camelCase
export function toCamelCase(obj: any): any {
    // Safety guard for null/undefined
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(v => toCamelCase(v));
    } else if (typeof obj === 'object' && obj.constructor === Object) {
        return Object.keys(obj).reduce(
            (result, key) => {
                // actual_7 -> actual7, indent_number -> indentNumber
                const camelKey = key.replace(/([_][a-z0-9])/g, m => m[1].toUpperCase());
                return {
                    ...result,
                    [camelKey]: toCamelCase(obj[key]),
                };
            },
            {},
        );
    }
    return obj;
}

// Helper to convert camelCase keys to snake_case
function toSnakeCase(obj: any): any {
    // Safety guard for null/undefined
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(v => toSnakeCase(v));
    } else if (typeof obj === 'object' && obj.constructor === Object) {
        return Object.keys(obj).reduce(
            (result, key) => {
                // If the key is already snake_case, don't change it
                if (key.includes('_')) {
                    return { ...result, [key]: toSnakeCase(obj[key]) };
                }
                // camelCase -> snake_case (handles actual7 -> actual_7)
                const snakeKey = key
                    .replace(/([A-Z0-9])/g, "_$1")
                    .toLowerCase()
                    .replace(/^_/, ""); // Remove leading underscore if any
                return {
                    ...result,
                    [snakeKey]: toSnakeCase(obj[key]),
                };
            },
            {},
        );
    }
    return obj;
}


export async function uploadFile(file: File, folderId: string, uploadType: 'upload' | 'email' | 'supabase' = 'upload', email?: string): Promise<string> {
    // If uploadType is 'supabase', upload to Supabase storage
    if (uploadType === 'supabase') {
        // Use the folderId as the bucket name
        // Use the existing Supabase client instance to ensure proper authentication
        const { data, error } = await supabase.storage
            .from(folderId) // Use the dynamic bucket name passed as folderId
            .upload(`${Date.now()}_${file.name}`, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Supabase upload error:', error);
            throw new Error(`Failed to upload file to Supabase: ${error.message}`);
        }

        // Get the public URL for the uploaded file
        const { data: { publicUrl } } = supabase.storage
            .from(folderId)
            .getPublicUrl(data.path);

        return publicUrl;
    }

    // Otherwise, use the existing Google Apps Script upload
    const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = (reader.result as string)?.split(',')[1]; // Remove data:type;base64, prefix
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const form = new FormData();
    form.append('action', 'upload');
    form.append('fileName', file.name);
    form.append('mimeType', file.type);
    form.append('fileData', base64);
    form.append('folderId', folderId);
    form.append('uploadType', uploadType);
    if (uploadType === "email") {
        form.append('email', email!);
        form.append('emailSubject', "Purchase Order");
        form.append('emailBody', "Please find attached PO.");
    }

    const response = await fetch(import.meta.env.VITE_APP_SCRIPT_URL, {
        method: 'POST',
        body: form,
        redirect: 'follow',
    });

    console.log(response)
    if (!response.ok) throw new Error('Failed to upload file');
    const res = await response.json();
    console.log(res)
    if (!res.success) throw new Error('Failed to upload data');

    return res.fileUrl as string;
}

export async function fetchIndentMasterData() {
    // Fetch all records from 'master' table with pagination
    const allData = await fetchFromSupabasePaginated(
        'master',
        '*',
        { column: 'item_name', options: { ascending: true } }
    );

    const data = allData;

    // 🔹 STEP 1: Categories (Union of create_group_head and group_head to handle nulls)
    const categories = Array.from(
        new Set([
            ...data.map(d => d.create_group_head?.trim()),
            ...data.map(d => d.group_head?.trim())
        ])
    ).filter(Boolean) as string[];

    // 🔹 STEP 2: Mapping Categories → item_name
    // Logic: Match selected category against 'group_head' column
    const groupHeadItems: Record<string, string[]> = {};

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

    return {
        departments: Array.from(
            new Set(data.map(d => d.department).filter(Boolean))
        ),
        createGroupHeads: categories,
        groupHeadItems
    };
}

// Helper to fetch all records from a Supabase table with pagination
export async function fetchFromSupabasePaginated(
    tableName: string,
    select: string = '*',
    orderBy: { column: string; options?: { ascending?: boolean } } = { column: 'created_at', options: { ascending: false } },
    queryBuilder?: (query: any) => any,
    pagination?: { from: number; to: number }
) {
    // If pagination is provided, fetch just that range
    if (pagination) {
        let query = supabase
            .from(tableName)
            .select(select)
            .range(pagination.from, pagination.to);

        if (queryBuilder) {
            query = queryBuilder(query);
        }

        if (orderBy.column) {
            query = query.order(orderBy.column, orderBy.options || { ascending: false });
        }

        const { data, error } = await query;

        if (error) {
            console.error(`Error fetching from ${tableName}:`, error);
            throw error;
        }

        return data || [];
    }

    let allData: any[] = [];
    let from = 0;
    let hasMore = true;
    const limit = 1000;

    while (hasMore) {
        let query = supabase
            .from(tableName)
            .select(select)
            .range(from, from + limit - 1);

        if (queryBuilder) {
            query = queryBuilder(query);
        }

        if (orderBy.column) {
            query = query.order(orderBy.column, orderBy.options || { ascending: false });
        }

        const { data, error } = await query;

        if (error) {
            console.error(`Error fetching from ${tableName}:`, error);
            throw error;
        }

        if (data && data.length > 0) {
            allData = [...allData, ...data];
            from += limit;
            if (data.length < limit) hasMore = false;
        } else {
            hasMore = false;
        }
    }
    return allData;
}

// Helper to fetch records from a Supabase table with count (one page at a time)
export async function fetchFromSupabaseWithCount(
    tableName: string,
    select: string = '*',
    pagination: { from: number; to: number },
    orderBy: { column: string; options?: { ascending?: boolean } } = { column: 'created_at', options: { ascending: false } },
    queryBuilder?: (query: any) => any
) {
    let query = supabase
        .from(tableName)
        .select(select, { count: 'exact' })
        .range(pagination.from, pagination.to);

    if (queryBuilder) {
        query = queryBuilder(query);
    }

    if (orderBy.column) {
        query = query.order(orderBy.column, orderBy.options || { ascending: false });
    }

    const { data, error, count } = await query;

    if (error) {
        console.error(`Error fetching from ${tableName}:`, error);
        throw error;
    }

    return {
        data: data || [],
        count: count || 0
    };
}

export async function fetchSheet(
    sheetName: Sheet
): Promise<MasterSheet | IndentSheet[] | ReceivedSheet[] | UserPermissions[] | PoMasterSheet[] | InventorySheet[]> {
    if (sheetName === 'INDENT') {
        console.log("Fetching all indents from Supabase for notifications and views");
        const allData = await fetchFromSupabasePaginated('indent', '*', { column: 'created_at', options: { ascending: false } });
        return toCamelCase(allData) as IndentSheet[];
    }

    if (sheetName === 'PO MASTER') {
        console.log("Fetching PO Master from Supabase");
        const allData = await fetchFromSupabasePaginated('po_master', '*', { column: 'timestamp', options: { ascending: false } });
        return toCamelCase(allData) as PoMasterSheet[];
    }

    if (sheetName === 'RECEIVED') {
        console.log("Fetching Received items from Supabase");
        const allData = await fetchFromSupabasePaginated('received', '*', { column: 'timestamp', options: { ascending: false } });
        return toCamelCase(allData) as ReceivedSheet[];
    }

    if (sheetName === 'USER') {
        console.log("Fetching users from Supabase");
        const allData = await fetchFromSupabasePaginated('user_access_master', '*', { column: 'id', options: { ascending: true } });
        // Map database 'id' to 'rowIndex' so the frontend logic doesn't break
        const mappedData = (allData || []).map((u: any) => ({ ...u, row_index: u.id }));
        return toCamelCase(mappedData) as UserPermissions[];
    }

    if (sheetName === 'MASTER') {
        // Fetch company data from master_data table
        let masterData: any = null;
        let companyInfo: any = {};

        try {
            // Fetch all records from master_data table to get complete header information
            const companyRes = await fetchFromSupabasePaginated('master_data', '*', { column: 'id', options: { ascending: true } });

            if (companyRes && companyRes.length > 0) {
                // Use the first record as the primary source of company information
                masterData = companyRes[0];

                // Collect all unique values for arrays from all records
                const allCompanyNames = [...new Set(companyRes.map(r => r.company_name).filter(Boolean))];
                const allCompanyAddresses = [...new Set(companyRes.map(r => r.company_address).filter(Boolean))];
                const allCompanyPhones = [...new Set(companyRes.map(r => r.company_phone).filter(Boolean))];
                const allCompanyGstins = [...new Set(companyRes.map(r => r.company_gstin).filter(Boolean))];
                const allCompanyPans = [...new Set(companyRes.map(r => r.company_pan).filter(Boolean))];
                const allBillingAddresses = [...new Set(companyRes.map(r => r.billing_address).filter(Boolean))];
                const allDestinationAddresses = [...new Set(companyRes.map(r => r.destination_address).filter(Boolean))];
                const allDefaultTerms = [...new Set(companyRes.map(r => r.default_terms).filter(Boolean))];

                // Collect all unique vendor names
                const allVendorNames = [...new Set(companyRes.map(r => r.vendor_name).filter(Boolean))];

                // Collect all unique payment terms
                const allPaymentTerms = [...new Set(companyRes.map(r => r.payment_term).filter(Boolean))];

                companyInfo = {
                    companyName: allCompanyNames[0] || 'JJSPL STORES', // Use first available
                    companyAddress: allCompanyAddresses[0] || 'Default Company Address',
                    companyPhone: allCompanyPhones[0] || 'Default Phone Number',
                    companyGstin: allCompanyGstins[0] || 'Default GSTIN',
                    companyPan: allCompanyPans[0] || 'Default PAN',
                    billingAddress: allBillingAddresses[0] || 'Default Billing Address',
                    destinationAddress: allDestinationAddresses[0] || 'Default Destination Address',
                    defaultTerms: allDefaultTerms,
                    vendors: allVendorNames.map(vendorName => ({ vendorName, gstin: '', address: '', email: '' })),
                    paymentTerms: allPaymentTerms
                };
            } else {
                console.warn('Master data table not found or empty');
                // Provide default company info if master_data table is not found
                companyInfo = {
                    companyName: 'JJSPL STORES',
                    companyAddress: 'Default Company Address',
                    companyPhone: 'Default Phone Number',
                    companyGstin: 'Default GSTIN',
                    companyPan: 'Default PAN',
                    billingAddress: 'Default Billing Address',
                    destinationAddress: 'Default Destination Address',
                    defaultTerms: [],
                    vendors: [],
                    paymentTerms: []
                };
            }
        } catch (error) {
            console.error('Master data table not found:', error);
            // Provide default company info if master_data table is not accessible
            companyInfo = {
                companyName: 'JJSPL STORES',
                companyAddress: 'Default Company Address',
                companyPhone: 'Default Phone Number',
                companyGstin: 'Default GSTIN',
                companyPan: 'Default PAN',
                billingAddress: 'Default Billing Address',
                destinationAddress: 'Default Destination Address',
                defaultTerms: [],
                vendors: [],
                paymentTerms: []
            };
        }

        // Fetch dropdown data from master table (for CreateIndent page)
        const masterTableData = await fetchFromSupabasePaginated('master', 'department, create_group_head, group_head, item_name', { column: 'id', options: { ascending: true } });

        if (!masterTableData) {
            console.error('Error fetching master table');
        }

        // Process dropdown data from master table with strict dependent flow
        let departments: string[] = [];
        let groupHeads: Record<string, string[]> = {}; // This maps create_group_head to item_names following the strict flow

        if (masterTableData && masterTableData.length > 0) {
            // Get unique departments
            const uniqueDepartments = Array.from(
                new Set(masterTableData.map(d => d.department).filter(Boolean))
            ) as string[];
            departments = uniqueDepartments;

            // Get unique create_group_head values (only non-null values)
            const createGroupHeads = Array.from(
                new Set(masterTableData.map(d => d.create_group_head).filter(value => value !== null && value !== undefined && value !== ''))
            ) as string[];

            // Create mapping of create_group_head -> item_name[] using the strict dependent flow
            // where group_head must equal create_group_head
            groupHeads = {};

            createGroupHeads.forEach(createGroupHead => {
                // Find all rows where group_head equals the selected create_group_head value
                const matchingRows = masterTableData.filter(row =>
                    row.group_head === createGroupHead && row.item_name
                );

                // Extract unique item_names for these matched rows
                const uniqueItems = Array.from(
                    new Set(matchingRows.map(row => row.item_name).filter(Boolean))
                ) as string[];

                groupHeads[createGroupHead as string] = uniqueItems;
            });
        }

        // Handle vendors from masterData if they exist
        let vendors: any[] = [];
        if (companyInfo.vendors && Array.isArray(companyInfo.vendors)) {
            // If vendors is already an array of objects
            if (companyInfo.vendors.length > 0 && typeof companyInfo.vendors[0] === 'object') {
                vendors = companyInfo.vendors.map(v => ({
                    vendorName: v.name || v.vendorName || v.vendor_name || '',
                    gstin: v.gstin ?? '',
                    address: v.address ?? '',
                    email: v.email ?? ''
                }));
            }
            // If vendors is an array of strings
            else if (companyInfo.vendors.length > 0 && typeof companyInfo.vendors[0] === 'string') {
                vendors = companyInfo.vendors.map(vendorName => ({
                    vendorName: vendorName || '',
                    gstin: '',
                    address: '',
                    email: ''
                }));
            }
        }

        return {
            vendors: vendors,
            departments: departments,
            paymentTerms: companyInfo.paymentTerms,
            groupHeads: groupHeads,

            companyName: companyInfo.companyName,
            companyAddress: companyInfo.companyAddress,
            companyPhone: companyInfo.companyPhone,
            companyGstin: companyInfo.companyGstin,
            companyPan: companyInfo.companyPan,
            billingAddress: companyInfo.billingAddress,
            destinationAddress: companyInfo.destinationAddress,
            defaultTerms: companyInfo.defaultTerms
        } as MasterSheet;
    }

    // For other sheet types, fetch from Google Apps Script
    const url = `${import.meta.env.VITE_APP_SCRIPT_URL}?sheetName=${encodeURIComponent(sheetName)}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error('Failed to fetch data');
    const raw = await response.json();
    if (!raw.success) throw new Error('Something went wrong when parsing data');

    return raw.rows.filter((r: IndentSheet) => r.timestamp !== '');
}


// lib/fetchers.ts में या जहां postToSheet function है

export async function postToQuotationHistory(rows: any[]) {
    try {
        const formData = new FormData();
        formData.append('action', 'insertQuotation');
        formData.append('rows', JSON.stringify(rows));

        const response = await fetch(import.meta.env.VITE_APPS_SCRIPT_URL, {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to submit quotation');
        }

        return result;
    } catch (error) {
        console.error('Error posting quotation:', error);
        throw error;
    }
}


export async function fetchVendors() {
    try {
        // Fetch vendors from master_data table with pagination
        const allData = await fetchFromSupabasePaginated(
            'master_data',
            'vendor_name, vendor_gstin, vendor_address, vendor_email',
            { column: 'id', options: { ascending: true } }
        );

        const uniqueVendors = new Map<string, {
            vendorName: string;
            gstin: string;
            address: string;
            email: string;
        }>();

        allData.forEach(row => {
            const vendorNames = row.vendor_name;
            const gstin = row.vendor_gstin || '';
            const address = row.vendor_address || '';
            const email = row.vendor_email || '';

            // Helper to add vendor if not already present or if present but has empty fields
            const addVendor = (name: string) => {
                if (!name || name.trim() === '') return;
                const trimmedName = name.trim();

                if (!uniqueVendors.has(trimmedName)) {
                    uniqueVendors.set(trimmedName, {
                        vendorName: trimmedName,
                        gstin: gstin,
                        address: address,
                        email: email
                    });
                } else {
                    // Optional: If already exists but current row has more info, update it
                    const existing = uniqueVendors.get(trimmedName)!;
                    if (!existing.gstin && gstin) existing.gstin = gstin;
                    if (!existing.address && address) existing.address = address;
                    if (!existing.email && email) existing.email = email;
                }
            };

            // If vendor_name is an array
            if (Array.isArray(vendorNames)) {
                vendorNames.forEach(name => addVendor(name));
            }
            // If vendor_name is a single string
            else if (typeof vendorNames === 'string') {
                addVendor(vendorNames);
            }
        });

        const sortedVendors = Array.from(uniqueVendors.values()).sort((a, b) =>
            a.vendorName.localeCompare(b.vendorName)
        );

        return sortedVendors;
    } catch (error) {
        console.error('Error fetching vendors:', error);
        return [];
    }
}


export async function postToSheet(
    data:
        | Partial<IndentSheet>[]
        | Partial<ReceivedSheet>[]
        | Partial<UserPermissions>[]
        | Partial<PoMasterSheet>[]
        | Partial<QuotationHistorySheet>[],
    action: 'insert' | 'update' | 'delete' | 'insertQuotation' = 'insert', // Add insertQuotation
    sheet: Sheet = 'INDENT'
) {
    if (sheet === 'INDENT') {
        if (action === 'insert') {
            // Use upsert instead of insert to handle potential duplicate keys
            // Strip Supabase internal fields that shouldn't be inserted
            const processedData = data.map(row => {
                const snakeRow = toSnakeCase(row);
                const { id, created_at, updated_at, ...insertData } = snakeRow;
                return insertData;
            });

            const { error } = await supabase.from('indent').upsert(processedData, {
                onConflict: 'indent_number',
                ignoreDuplicates: false // Update if exists
            });
            if (error) {
                console.error('Error upserting into Supabase:', error);
                throw error;
            }
            return { success: true };
        } else if (action === 'update') {
            // Bulk update in Supabase is tricky, usually done one by one if they don't have a common ID
            // or using upsert if we have a primary key.
            // Assuming indentNumber is the primary key.
            for (const row of data) {
                const snakeRow = toSnakeCase(row);
                // Strip Supabase internal fields that shouldn't be updated
                const { id, created_at, updated_at, ...updateData } = snakeRow;

                const { error } = await supabase
                    .from('indent')
                    .update(updateData)
                    .eq('indent_number', snakeRow.indent_number);
                if (error) {
                    console.error('Supabase update error:', error);
                    throw error;
                }
            }
            return { success: true };
        }
    }

    if (sheet === 'USER') {
        if (action === 'insert') {
            const processedData = data.map(row => {
                const snakeRow = toSnakeCase(row);
                // Strip fields that shouldn't be inserted
                const { id, row_index, created_at, ...insertData } = snakeRow;
                return insertData;
            });

            const { error } = await supabase.from('user_access_master').insert(processedData);
            if (error) {
                console.error('Error inserting into user_access_master:', error);
                throw error;
            }
            return { success: true };
        } else if (action === 'update') {
            for (const row of data) {
                const snakeRow = toSnakeCase(row);
                // Use row_index (which we mapped from id) as the primary key for updates
                const idToUpdate = snakeRow.row_index || snakeRow.id;
                const { id, row_index, created_at, ...updateData } = snakeRow;

                const { error } = await supabase
                    .from('user_access_master')
                    .update(updateData)
                    .eq('id', idToUpdate);
                if (error) {
                    console.error('Error updating user_access_master:', error);
                    throw error;
                }
            }
            return { success: true };
        } else if (action === 'delete') {
            for (const row of data) {
                const snakeRow = toSnakeCase(row);
                const idToDelete = snakeRow.row_index || snakeRow.id;

                const { error } = await supabase
                    .from('user_access_master')
                    .delete()
                    .eq('id', idToDelete);
                if (error) {
                    console.error('Error deleting from user_access_master:', error);
                    throw error;
                }
            }
            return { success: true };
        }
    }

    const form = new FormData();
    form.append('action', action);
    form.append('sheetName', sheet);
    form.append('rows', JSON.stringify(data));
    const response = await fetch(import.meta.env.VITE_APP_SCRIPT_URL, {
        method: 'POST',
        body: form,
    });
    if (!response.ok) {
        console.error(`Error in fetch: ${response.status} - ${response.statusText}`);
        throw new Error(`Failed to ${action} data`);
    }
    const res = await response.json();
    if (!res.success) {
        console.error(`Error in response: ${res.message}`);
        throw new Error('Something went wrong in the API');
    }
    return res;
}
// Add this new function in fetchers.ts
export async function postToMasterSheet(data: any[]) {
    try {
        const response = await fetch('/api/master-sheet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Failed to post to master sheet');
        }

        return await response.json();
    } catch (error) {
        console.error('Error posting to master sheet:', error);
        throw new Error('Something went wrong in the API');
    }
}
