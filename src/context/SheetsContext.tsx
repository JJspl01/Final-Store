import { fetchSheet, fetchVendors, getCache, setCache } from '@/lib/fetchers';
import { supabase } from '@/lib/supabaseClient';
import type { IndentSheet, InventorySheet, MasterSheet, PoMasterSheet, ReceivedSheet } from '@/types';
import { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SheetsState {
    updateReceivedSheet: () => void;
    updatePoMasterSheet: () => void;
    updateIndentSheet: () => void;
    updateAll: () => void;

    indentSheet: IndentSheet[];
    poMasterSheet: PoMasterSheet[];
    receivedSheet: ReceivedSheet[];
    inventorySheet: InventorySheet[];
    masterSheet: MasterSheet | undefined;
    vendorsData: any[];
    supplierList: string[];
    poNumberList: string[];

    indentLoading: boolean;
    poMasterLoading: boolean;
    receivedLoading: boolean;
    inventoryLoading: boolean;
    vendorsLoading: boolean;
    allLoading: boolean;
}

const SheetsContext = createContext<SheetsState | null>(null);

export const SheetsProvider = ({ children }: { children: React.ReactNode }) => {
    const [indentSheet, setIndentSheet] = useState<IndentSheet[]>([]);
    const [receivedSheet, setReceivedSheet] = useState<ReceivedSheet[]>([]);
    const [poMasterSheet, setPoMasterSheet] = useState<PoMasterSheet[]>([]);
    const [inventorySheet, setInventorySheet] = useState<InventorySheet[]>([]);
    const [masterSheet, setMasterSheet] = useState<MasterSheet>();
    const [vendorsData, setVendorsData] = useState<any[]>([]);
    const [supplierList, setSupplierList] = useState<string[]>([]);
    const [poNumberList, setPoNumberList] = useState<string[]>([]);

    const [indentLoading, setIndentLoading] = useState(true);
    const [poMasterLoading, setPoMasterLoading] = useState(true);
    const [receivedLoading, setReceivedLoading] = useState(true);
    const [inventoryLoading, setInventoryLoading] = useState(true);
    const [vendorsLoading, setVendorsLoading] = useState(true);
    const [allLoading, setAllLoading] = useState(true);

    async function updateIndentSheet() {
        setIndentLoading(true);
        const res = await fetchSheet('INDENT');
        const data = res as IndentSheet[];
        setIndentSheet(data);
        setCache('global_indent', data, 30);
        setIndentLoading(false);
        return data;
    }

    async function updateReceivedSheet() {
        setReceivedLoading(true);
        const res = await fetchSheet('RECEIVED');
        const data = res as ReceivedSheet[];
        setReceivedSheet(data);
        setCache('global_received', data, 30);
        setReceivedLoading(false);
        return data;
    }

    async function updatePoMasterSheet() {
        setPoMasterLoading(true);
        const res = await fetchSheet('PO MASTER');
        const data = res as PoMasterSheet[];
        setPoMasterSheet(data);
        setCache('global_po_master', data, 30);
        setPoMasterLoading(false);
        return data;
    }

    async function updateInventorySheet() {
        setInventoryLoading(true);
        const res = await fetchSheet('INVENTORY');
        const data = res as InventorySheet[];
        setInventorySheet(data);
        setCache('global_inventory', data, 30);
        setInventoryLoading(false);
        return data;
    }

    async function updateMasterSheet() {
        const res = await fetchSheet('MASTER');
        const data = res as MasterSheet;
        setMasterSheet(data);
        setCache('global_master', data, 60);
        return data;
    }

    async function updateVendorsData() {
        setVendorsLoading(true);
        const vendorsRaw = await fetchVendors();
        const vendorsMapped = vendorsRaw.map(v => ({
            vendor_name: v.vendorName,
            vendor_address: v.address,
            vendor_gstin: v.gstin,
            vendor_email: v.email
        }));
        setVendorsData(vendorsMapped);
        setCache('global_vendors', vendorsMapped, 60);
        setVendorsLoading(false);
        return vendorsMapped;
    }

    async function updateSupplierList() {
        // Fetch only unique suppliers for speed
        const { data } = await supabase
            .from('indent')
            .select('approved_vendor_name')
            .not('planned_4', 'is', null)
            .is('actual_4', null)
            .not('approved_vendor_name', 'is', null)
            .not('approved_vendor_name', 'eq', '');

        if (data) {
            const unique = Array.from(new Set(data.map(d => d.approved_vendor_name)));
            setSupplierList(unique as string[]);
            setCache('global_supplier_list', unique, 60);
            return unique;
        }
        return [];
    }

    async function updatePoNumberList() {
        const { data } = await supabase
            .from('po_master')
            .select('po_number');

        if (data) {
            const unique = Array.from(new Set(data.map(d => d.po_number).filter(Boolean)));
            setPoNumberList(unique as string[]);
            setCache('global_po_number_list', unique, 60);
            return unique;
        }
        return [];
    }

    async function updateAll() {
        setAllLoading(true);
        try {
            await Promise.all([
                updateMasterSheet(),
                updateReceivedSheet(),
                updateIndentSheet(),
                updatePoMasterSheet(),
                updateInventorySheet(),
                updateVendorsData(),
                updateSupplierList(),
                updatePoNumberList()
            ]);
        } catch (error) {
            console.error('Error updating all sheets:', error);
            toast.error('Something went wrong while fetching data');
        } finally {
            setAllLoading(false);
        }
    }

    useEffect(() => {
        // Load from cache for instant app-wide responsiveness
        const cachedMaster = getCache('global_master');
        const cachedIndent = getCache('global_indent');
        const cachedPoMaster = getCache('global_po_master');
        const cachedReceived = getCache('global_received');
        const cachedInventory = getCache('global_inventory');
        const cachedVendors = getCache('global_vendors');
        const cachedSuppliers = getCache('global_supplier_list');
        const cachedPoNumbers = getCache('global_po_number_list');

        if (cachedMaster) setMasterSheet(cachedMaster);
        if (cachedIndent) {
            setIndentSheet(cachedIndent);
            setIndentLoading(false);
        }
        if (cachedPoMaster) {
            setPoMasterSheet(cachedPoMaster);
            setPoMasterLoading(false);
        }
        if (cachedReceived) {
            setReceivedSheet(cachedReceived);
            setReceivedLoading(false);
        }
        if (cachedInventory) {
            setInventorySheet(cachedInventory);
            setInventoryLoading(false);
        }
        if (cachedVendors) {
            setVendorsData(cachedVendors);
            setVendorsLoading(false);
        }
        if (cachedSuppliers) setSupplierList(cachedSuppliers);
        if (cachedPoNumbers) setPoNumberList(cachedPoNumbers);

        try {
            updateAll();
        } catch (e) {
            toast.error('Something went wrong while fetching data');
        }
    }, []);

    return (
        <SheetsContext.Provider
            value={{
                updateIndentSheet,
                updatePoMasterSheet,
                updateReceivedSheet,
                updateAll,
                indentSheet,
                poMasterSheet,
                inventorySheet,
                receivedSheet,
                vendorsData,
                supplierList,
                poNumberList,
                indentLoading,
                masterSheet,
                poMasterLoading,
                receivedLoading,
                inventoryLoading,
                vendorsLoading,
                allLoading,
            }}
        >
            {children}
        </SheetsContext.Provider>
    );
};

export const useSheets = () => useContext(SheetsContext)!;
