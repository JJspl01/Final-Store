import type { IndentSheet, MasterSheet, ReceivedSheet, Sheet } from '@/types';
import type { InventorySheet, PoMasterSheet, QuotationHistorySheet, UserPermissions, Vendor } from '@/types/sheets';

export async function uploadFile(file: File, folderId: string, uploadType: 'upload' | 'email' = 'upload', email?: string): Promise<string> {
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

export async function fetchSheet(
    sheetName: Sheet
): Promise<MasterSheet | IndentSheet[] | ReceivedSheet[] | UserPermissions[] | PoMasterSheet[] | InventorySheet[]> {
    const url = `${import.meta.env.VITE_APP_SCRIPT_URL}?sheetName=${encodeURIComponent(sheetName)}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error('Failed to fetch data');
    const raw = await response.json();
    if (!raw.success) throw new Error('Something went wrong when parsing data');

    if (sheetName === 'MASTER') {
        const data = raw.options;

        // @ts-expect-error Assuming data is structured correctly
        const length = Math.max(...Object.values(data).map((arr) => arr.length));

        const vendors: Vendor[] = [];
        const groupHeads: Record<string, Set<string>> = {};
        const departments = new Set<string>();
        const paymentTerms = new Set<string>();
        const defaultTerms = new Set<string>();

        for (let i = 0; i < length; i++) {
            const vendorName = data.vendorName?.[i];
            const gstin = data.vendorGstin?.[i];
            const address = data.vendorAddress?.[i];
            const email = data.vendorEmail?.[i];
            if (vendorName && gstin && address) {
                vendors.push({ vendorName, gstin, address, email });
            }

            if (data.department?.[i]) departments.add(data.department[i]);
            if (data.paymentTerm?.[i]) paymentTerms.add(data.paymentTerm[i]);
            if (data.defaultTerms?.[i]) defaultTerms.add(data.defaultTerms[i])

            const group = data.groupHead?.[i];
            const item = data.itemName?.[i];
            if (group && item) {
                if (!groupHeads[group]) groupHeads[group] = new Set();
                groupHeads[group].add(item);
            }
        }

        return {
            vendors,
            departments: [...departments],
            paymentTerms: [...paymentTerms],
            groupHeads: Object.fromEntries(Object.entries(groupHeads).map(([k, v]) => [k, [...v]])),
            companyPan: data.companyPan,
            companyName: data.companyName,
            companyAddress: data.companyAddress,
            companyPhone: data.companyPhone,
            companyGstin: data.companyGstin,
            billingAddress: data.billingAddress,
            destinationAddress: data.destinationAddress,
            defaultTerms: [...defaultTerms]
        };
    }
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
    const response = await fetch(
      `${import.meta.env.VITE_APP_SCRIPT_URL}?sheetName=MASTER&fetchType=vendors`
    );
    const data = await response.json();
    return data.vendors || [];
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
