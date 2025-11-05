import { Package2 } from 'lucide-react';
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
}

export default () => {
    const { poMasterLoading, poMasterSheet, indentSheet, receivedSheet } = useSheets();

    const [historyData, setHistoryData] = useState<HistoryData[]>([]);

    // Fetching table data
    useEffect(() => {
        setHistoryData(
            poMasterSheet.map((sheet) => ({
                approvedBy: sheet.approvedBy,
                poCopy: sheet.pdf,
                poNumber: sheet.poNumber,
                preparedBy: sheet.preparedBy,
                totalAmount: sheet.totalPoAmount,
                vendorName: sheet.partyName,
                status: indentSheet.map((s) => s.poNumber).includes(sheet.poNumber)
                    ? receivedSheet.map((r) => r.poNumber).includes(sheet.poNumber)
                        ? 'Recieved'
                        : 'Not Recieved'
                    : 'Revised',
            }))
        );
    }, [indentSheet]);

    // Creating table columns
    const historyColumns: ColumnDef<HistoryData>[] = [
        { accessorKey: 'poNumber', header: 'PO Number' },
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
        { accessorKey: 'status', header: 'Status',
            cell: ({ row }) => {
                const variant = row.original.status === "Not Recieved" ? "secondary" : row.original.status === "Recieved" ? "primary" : "default"
                return <Pill variant={variant}>{row.original.status}</Pill>
            }
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
                searchFields={['product', 'poNumber']}
                dataLoading={poMasterLoading}
                className='h-[80dvh]'
            />
        </div>
    );
};
