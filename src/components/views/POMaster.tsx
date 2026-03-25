import { ListTodo } from 'lucide-react';
import Heading from '../element/Heading';

import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import DataTable from '../element/DataTable';
import { fetchFromSupabasePaginated, fetchFromSupabaseWithCount } from '@/lib/fetchers';

interface PendingIndentsData {
    timestamp: string;
    partyName: string;
    poNumber: string;
    quotationNumber: string;
    quotationDate: string;
    enquiryNumber: string;
    enquiryDate: string;
    internalCode: string;
    product: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    gstPercent: number;
    discountPercent: number;
    amount: number;
    totalPoAmount: number;
    preparedBy: string;
    approvedBy: string;
    pdf: string;
}

// Helper function to parse GST percentage value
const parseGSTPercent = (value: any): number => {
    if (value === null || value === undefined || value === '') {
        return 0;
    }

    // Convert to string first
    const stringValue = String(value).trim();

    // If it's already a percentage string (like "18%"), remove % and convert
    if (stringValue.includes('%')) {
        const numericPart = stringValue.replace('%', '').trim();
        const parsed = parseFloat(numericPart);
        return isNaN(parsed) ? 0 : parsed;
    }

    // If it's a decimal (like 0.18 for 18%), convert to percentage
    const numericValue = parseFloat(stringValue);
    if (isNaN(numericValue)) {
        return 0;
    }

    // If the value is between 0 and 1, it's likely a decimal representation
    // Convert it to percentage (0.18 -> 18)
    if (numericValue > 0 && numericValue < 1) {
        return numericValue * 100;
    }

    // Otherwise, assume it's already in percentage format
    return numericValue;
};

export default () => {

    const [loading, setLoading] = useState(true);
    const [tableData, setTableData] = useState<PendingIndentsData[]>([]);

    // Pagination state
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const fetchPOMaster = async (isInitial = false) => {
        try {
            setLoading(true);

            const currentPage = isInitial ? 0 : pageIndex;
            const from = currentPage * pageSize;
            const to = (currentPage + 1) * pageSize - 1;

            const { data, count } = await fetchFromSupabaseWithCount(
                'po_master',
                '*',
                { from, to },
                { column: 'timestamp', options: { ascending: false } }
            );

            if (data) {
                const mappedBatch = (data as any[]).map((sheet) => {
                    let gstValue = sheet.gst_percent || 0;
                    return {
                        timestamp: sheet.timestamp ? formatDate(new Date(sheet.timestamp)) : '',
                        partyName: sheet.party_name || '',
                        poNumber: sheet.po_number || '',
                        quotationNumber: sheet.quotation_number || '',
                        quotationDate: sheet.quotation_date ? formatDate(new Date(sheet.quotation_date)) : '',
                        enquiryNumber: sheet.enquiry_number || '',
                        enquiryDate: sheet.enquiry_date ? formatDate(new Date(sheet.enquiry_date)) : '',
                        internalCode: sheet.internal_code || '',
                        product: sheet.product || '',
                        description: sheet.description || '',
                        quantity: Number(sheet.quantity) || 0,
                        unit: sheet.unit || '',
                        rate: Number(sheet.rate) || 0,
                        gstPercent: parseGSTPercent(gstValue),
                        discountPercent: Number(sheet.discount_percent) || 0,
                        amount: Number(sheet.amount) || 0,
                        totalPoAmount: Number(sheet.total_po_amount) || 0,
                        preparedBy: sheet.prepared_by || '',
                        approvedBy: sheet.approved_by || '',
                        pdf: sheet.pdf_link || sheet.pdf_url || '',
                    };
                });

                if (isInitial) {
                    setTableData(mappedBatch);
                    setPageIndex(1);
                } else {
                    setTableData(prev => [...prev, ...mappedBatch]);
                    setPageIndex(prev => prev + 1);
                }

                const total = count || 0;
                setTotalCount(total);
                setHasMore((isInitial ? mappedBatch.length : tableData.length + mappedBatch.length) < total);
            }
        } catch (error) {
            console.error('Error fetching PO master:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPOMaster(true);
    }, []);

    // Creating table columns based on PO MASTER sheet structure (Columns A-T)
    const columns: ColumnDef<PendingIndentsData>[] = [
        { accessorKey: 'timestamp', header: 'Timestamp' },
        { accessorKey: 'partyName', header: 'Party Name' },
        { accessorKey: 'poNumber', header: 'PO Number' },
        { accessorKey: 'quotationNumber', header: 'Quotation Number' },
        { accessorKey: 'quotationDate', header: 'Quotation Date' },
        { accessorKey: 'enquiryNumber', header: 'Enquiry Number' },
        { accessorKey: 'enquiryDate', header: 'Enquiry Date' },
        { accessorKey: 'internalCode', header: 'Internal Code' },
        { accessorKey: 'product', header: 'Product' },
        { accessorKey: 'description', header: 'Description' },
        { accessorKey: 'quantity', header: 'Quantity' },
        { accessorKey: 'unit', header: 'Unit' },
        {
            accessorKey: 'rate',
            header: 'Rate',
            cell: ({ row }) => {
                return <>&#8377;{row.original.rate.toLocaleString()}</>;
            },
        },
        {
            accessorKey: 'gstPercent',
            header: 'GST %',
            cell: ({ row }) => {
                return <>{row.original.gstPercent}%</>;
            },
        },
        {
            accessorKey: 'discountPercent',
            header: 'Discount %',
            cell: ({ row }) => {
                return <>{row.original.discountPercent}%</>;
            },
        },
        {
            accessorKey: 'amount',
            header: 'Amount',
            cell: ({ row }) => {
                return <>&#8377;{row.original.amount.toLocaleString()}</>;
            },
        },
        {
            accessorKey: 'totalPoAmount',
            header: 'Total PO Amount',
            cell: ({ row }) => {
                return <>&#8377;{row.original.totalPoAmount.toLocaleString()}</>;
            },
        },
        { accessorKey: 'preparedBy', header: 'Prepared By' },
        { accessorKey: 'approvedBy', header: 'Approved By' },
        {
            accessorKey: 'pdf',
            header: 'PDF',
            cell: ({ row }) => {
                return row.original.pdf ? (
                    <a
                        href={row.original.pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                    >
                        View PDF
                    </a>
                ) : (
                    <span className="text-gray-400">No PDF</span>
                );
            },
        },
    ];

    return (
        <div>
            <Heading heading="Pending POs" subtext="View pending purchase orders from PO Master">
                <ListTodo size={50} className="text-primary" />
            </Heading>
            <DataTable
                data={tableData}
                columns={columns}
                searchFields={[
                    'partyName',
                    'poNumber',
                    'product',
                    'description',
                    'quotationNumber',
                    'enquiryNumber',
                    'preparedBy',
                    'approvedBy'
                ]}
                dataLoading={loading}
                infiniteScroll={true}
                onLoadMore={() => fetchPOMaster(false)}
                hasMore={hasMore}
                className="h-[80dvh]"
            />
        </div>
    );
};