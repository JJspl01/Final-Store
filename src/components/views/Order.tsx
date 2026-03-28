import React from 'react';
import { Package2, Trash2 } from 'lucide-react';
import Heading from '../element/Heading';
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useInfiniteSupabaseQuery } from '@/hooks/useInfiniteSupabaseQuery';
import DataTable from '../element/DataTable';
import { formatDate } from '@/lib/utils';
import { useSheets } from '@/context/SheetsContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

export default () => {
    // Use context only for status calculation (indent vs received)
    const { indentSheet, receivedSheet } = useSheets();
    const queryClient = useQueryClient();

    // Data Query
    const {
        data: orderHistoryDataRaw,
        fetchNextPage,
        hasNextPage,
        isLoading: historyLoading,
        isFetchingNextPage,
    } = useInfiniteSupabaseQuery(['orderHistory'], {
        tableName: 'po_master',
        queryBuilder: (q) => q.order('timestamp', { ascending: false }),
        pageSize: 10,
    });

    const historyData = useMemo(() => {
        if (!orderHistoryDataRaw) return [];
        
        const allRecords = orderHistoryDataRaw.pages.flatMap(page => page.data)
            .filter((sheet: any) => sheet.po_number || sheet.party_name);
            
        // Make PO Numbers unique by keeping only the most recent entry for each PO
        const uniqueMap = new Map<string, any>();
        allRecords.forEach((sheet: any) => {
             const poNumberKey = sheet.po_number?.trim();
             // Use PO number if it exists, otherwise fallback to ID so we don't drop missing ones completely
             const key = poNumberKey || sheet.id.toString();
             
             if (!uniqueMap.has(key)) {
                 uniqueMap.set(key, sheet);
             }
        });
        
        return Array.from(uniqueMap.values()).map((sheet: any) => ({
                approvedBy: sheet.approved_by || '',
                poCopy: sheet.pdf_url || sheet.pdf_link || '',
                poNumber: sheet.po_number || '',
                preparedBy: sheet.prepared_by || '',
                totalAmount: Number(sheet.total_po_amount) || 0,
                vendorName: sheet.party_name || '',
                indentNumber: sheet.internal_code || '',
                id: sheet.id || 0,
                status: (indentSheet.map((s) => s.poNumber).includes(sheet.po_number || '')
                    ? receivedSheet.map((r) => r.poNumber).includes(sheet.po_number || '')
                        ? 'Recieved'
                        : 'Not Recieved'
                    : 'Revised') as 'Revised' | 'Not Recieved' | 'Recieved',
            }));
    }, [orderHistoryDataRaw, indentSheet, receivedSheet]);




    // Delete handler function using Supabase
    const handleDelete = async (indentNumber: string, id: number) => {
        if (!id) {
            alert('Row ID not found');
            return;
        }

        const confirmDelete = window.confirm(
            `Are you sure you want to delete the row with Indent Number: ${indentNumber}?`
        );

        if (!confirmDelete) return;

        try {
            console.log('Deleting row with ID:', id);

            const { error } = await supabase
                .from('po_master')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Delete error:', error);
                toast.error('Failed to delete row: ' + error.message);
                return;
            }

            toast.success('Row deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['orderHistory'] });
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Error deleting row: ' + (error as any).message);
        }
    };

    const historyColumns: ColumnDef<any>[] = [
        { accessorKey: 'poNumber', header: 'PO Number' },
        {
            accessorKey: 'vendorName',
            header: 'Vendor Name',
            cell: ({ row }) => <div className="text-wrap max-w-40">{row.original.vendorName}</div>
        },
        { accessorKey: 'indentNumber', header: 'Indent Number' },
        { accessorKey: 'totalAmount', header: 'Total Amount', cell: ({ row }) => <>&#8377;{row.original.totalAmount.toLocaleString()}</> },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status;
                let color = 'text-gray-500';
                if (status === 'Recieved') color = 'text-green-500 font-bold';
                if (status === 'Not Recieved') color = 'text-red-500 font-medium';
                if (status === 'Revised') color = 'text-orange-500 italic';
                return <span className={color}>{status}</span>;
            }
        },
        {
            accessorKey: 'poCopy',
            header: 'PO Copy',
            cell: ({ row }) => row.original.poCopy ? (
                <a href={row.original.poCopy} target="_blank" rel="noreferrer" className="text-primary hover:underline">View</a>
            ) : '-'
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => {
                return (
                    <button
                        onClick={() => handleDelete(row.original.indentNumber, row.original.id)}
                        className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                        title="Delete row"
                    >
                        <Trash2 size={18} />
                    </button>
                );
            },
        },
    ];


    return (
        <div className="w-full">
            <div className="sticky top-0 z-20 bg-background -mx-5 -mt-5 p-5 pb-2 shadow-sm">
                <Heading heading="PO History" subtext="View purchase orders">
                    <Package2 size={50} className="text-primary" />
                </Heading>
            </div>

            <div className="space-y-4 p-5 pt-2 h-[calc(100vh-140px)] flex flex-col">
                <div className="w-full flex-1 overflow-hidden min-h-0">
                    <DataTable
                        data={historyData}
                        columns={historyColumns}
                        searchFields={['poNumber', 'vendorName', 'indentNumber']}
                        dataLoading={historyLoading}
                        isFetchingNextPage={isFetchingNextPage}
                        infiniteScroll={true}
                        onLoadMore={fetchNextPage}
                        hasMore={hasNextPage}
                    />
                </div>
            </div>
        </div>
    );
};
