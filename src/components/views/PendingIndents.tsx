import { ListTodo } from 'lucide-react';
import Heading from '../element/Heading';
import { useSheets } from '@/context/SheetsContext';
import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDate } from '@/lib/utils';
import DataTable from '../element/DataTable';

interface PendingIndentsData {
    date: string;
    indentNo: string;
    product: string;
    quantity: number;
    rate: number;
    uom: string;
    vendorName: string;
    paymentTerm: string;
    specifications: string;
}

export default () => {
    const { indentSheet, indentLoading } = useSheets();

    const [tableData, setTableData] = useState<PendingIndentsData[]>([]);

    // Fetching table data
    useEffect(() => {
        setTableData(
            indentSheet
                .filter((sheet) => sheet.planned4 !== '' && sheet.actual4 === '')
                .map((sheet) => ({
                    date: formatDate(new Date(sheet.timestamp)),
                    indentNo: sheet.indentNumber,
                    product: sheet.productName,
                    quantity: sheet.approvedQuantity,
                    rate: sheet.approvedRate,
                    uom: sheet.uom,
                    vendorName: sheet.approvedVendorName,
                    paymentTerm: sheet.approvedPaymentTerm,
                    specifications: sheet.specifications || '',
                }))
                // Sort by indentNo in descending order
                .sort((a, b) => b.indentNo.localeCompare(a.indentNo))
        );
    }, [indentSheet]);

    // Creating table columns with compact Product column
    const columns: ColumnDef<PendingIndentsData>[] = [
        {
            accessorKey: 'date',
            header: 'Date',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'indentNo',
            header: 'Indent Number',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[120px] break-words whitespace-normal px-1 text-sm">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'quantity',
            header: 'Quantity',
            cell: ({ getValue }) => <div className="px-2">{getValue() as number}</div>
        },
        {
            accessorKey: 'rate',
            header: 'Rate',
            cell: ({ row }) => (
                <div className="px-2">
                    &#8377;{row.original.rate}
                </div>
            ),
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'vendorName',
            header: 'Vendor Name',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'paymentTerm',
            header: 'Payment Term',
            cell: ({ getValue }) => <div className="px-2">{getValue() as string}</div>
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal px-2 text-sm">
                    {getValue() as string}
                </div>
            ),
        },
    ];

    return (
        <div>
            <Heading heading="Pending POs" subtext="View pending purchase orders">
                <ListTodo size={50} className="text-primary" />
            </Heading>
            <DataTable
                data={tableData}
                columns={columns}
                searchFields={['product', 'vendorName', 'paymentTerm', 'specifications']}
                dataLoading={indentLoading}
                className="h-[80dvh]"
            />
        </div>
    );
};