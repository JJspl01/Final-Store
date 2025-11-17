

import { Package2, Trash2 } from 'lucide-react';
import Heading from '../element/Heading';
import { useSheets } from '@/context/SheetsContext';
import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDate } from '@/lib/utils';
import DataTable from '../element/DataTable';
import { Pill } from '../ui/pill';


interface HistoryData {
    poNumber: string;
    poCopy: string;
    vendorName: string;
    preparedBy: string;
    approvedBy: string;
    totalAmount: number;
    status: 'Revised' | 'Not Recieved' | 'Recieved';
    indentNumber: string;
    rowIndex: number;
}


export default () => {
    const { poMasterLoading, poMasterSheet, indentSheet, receivedSheet } = useSheets();


    const [historyData, setHistoryData] = useState<HistoryData[]>([]);


 // Fetching table data
useEffect(() => {
    setHistoryData(
        poMasterSheet
            .map((sheet, index) => ({
                approvedBy: sheet.approvedBy,
                poCopy: sheet.pdf,
                poNumber: sheet.poNumber,
                preparedBy: sheet.preparedBy,
                totalAmount: sheet.totalPoAmount,
                vendorName: sheet.partyName,
                indentNumber: sheet.internalCode || '',
                rowIndex: (sheet as any).rowIndex || index + 2, // Fallback to index + 2 (accounting for header row)
                status: (indentSheet.map((s) => s.poNumber).includes(sheet.poNumber)
                    ? receivedSheet.map((r) => r.poNumber).includes(sheet.poNumber)
                        ? 'Recieved'
                        : 'Not Recieved'
                    : 'Revised') as 'Revised' | 'Not Recieved' | 'Recieved',
            }))
            .reverse()
    );
}, [poMasterSheet, indentSheet, receivedSheet]);


    // Delete handler function using Apps Script
    const handleDelete = async (indentNumber: string, rowIndex: number) => {
        if (!indentNumber) {
            alert('Indent Number not found');
            return;
        }

        if (!rowIndex) {
            alert('Row index not found');
            return;
        }

        const confirmDelete = window.confirm(
            `Are you sure you want to delete the row with Indent Number: ${indentNumber}?`
        );

        if (!confirmDelete) return;

        try {
            // FIXED: Use environment variable or fallback to sessionStorage
            const scriptUrl = import.meta.env.VITE_APP_SCRIPT_URL || sessionStorage.getItem('googleScriptUrl');
            
            if (!scriptUrl) {
                alert('Google Script URL not found');
                console.error('VITE_APP_SCRIPT_URL not set in .env file');
                return;
            }

            console.log('Deleting row:', { indentNumber, rowIndex });
            
            // Prepare the delete request
            const params = new URLSearchParams();
            params.append('action', 'delete');
            params.append('sheetName', 'PO MASTER'); // Make sure this matches your actual sheet name
            params.append('rows', JSON.stringify([{ rowIndex: rowIndex }]));

            console.log('Request URL:', scriptUrl);
            console.log('Request params:', params.toString());

            const response = await fetch(scriptUrl, {
                method: 'POST',
                body: params,
                redirect: 'follow',
            });

            console.log('Response status:', response.status);
            
            const result = await response.json();
            console.log('Response result:', result);

            if (result.success) {
                alert('Row deleted successfully');
                // Update local state to remove the deleted row
                setHistoryData((prev) =>
                    prev.filter((item) => item.indentNumber !== indentNumber)
                );
            } else {
                console.error('Delete error:', result.error);
                alert('Failed to delete row: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Error deleting row: ' + error.message);
        }
    };


    // Creating table columns
    const historyColumns: ColumnDef<HistoryData>[] = [
        { accessorKey: 'poNumber', header: 'PO Number' },
        { accessorKey: 'indentNumber', header: 'Indent Number' },
        {
            accessorKey: 'poCopy',
            header: 'PO Copy',
            cell: ({ row }) => {
                const attachment = row.original.poCopy;
                return attachment ? (
                    <a href={attachment} target="_blank">
                        PDF
                    </a>
                ) : (
                    <></>
                );
            },
        },
        { accessorKey: 'vendorName', header: 'Vendor Name' },
        { accessorKey: 'preparedBy', header: 'Prepared By' },
        { accessorKey: 'approvedBy', header: 'Approved By' },
        {
            accessorKey: 'totalAmount',
            header: 'Amount',
            cell: ({ row }) => {
                return <>&#8377;{row.original.totalAmount}</>;
            },
        },
        { 
            accessorKey: 'status', 
            header: 'Status',
            cell: ({ row }) => {
                const variant = row.original.status === "Not Recieved" ? "secondary" : row.original.status === "Recieved" ? "primary" : "default"
                return <Pill variant={variant}>{row.original.status}</Pill>
            }
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => {
                return (
                    <button 
                        onClick={() => handleDelete(row.original.indentNumber, row.original.rowIndex)}
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
        <div>
            <Heading heading="PO History" subtext="View purchase orders">
                <Package2 size={50} className="text-primary" />
            </Heading>


            <DataTable
                data={historyData}
                columns={historyColumns}
                searchFields={['vendorName', 'poNumber', 'indentNumber']}
                dataLoading={poMasterLoading}
                className='h-[80dvh]'
            />
        </div>
    );
};
