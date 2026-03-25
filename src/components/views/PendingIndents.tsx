import { ListTodo } from 'lucide-react';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDate } from '@/lib/utils';
import DataTable from '../element/DataTable';
import { supabase } from '@/lib/supabaseClient';

import { fetchFromSupabaseWithCount } from '@/lib/fetchers';

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
    const [tableData, setTableData] = useState<PendingIndentsData[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Fetching table data
    const fetchData = async (isInitial = false) => {
        setDataLoading(true);
        try {
            const currentPage = isInitial ? 0 : pageIndex;
            const from = currentPage * pageSize;
            const to = from + pageSize - 1;

            const { data, count } = await fetchFromSupabaseWithCount(
                'indent',
                '*',
                { from, to },
                { column: 'created_at', options: { ascending: false } },
                (q) => q.not('planned_4', 'is', null).is('actual_4', null)
            );

            if (data) {
                const pendingBatch = data.map((record: any) => ({
                    date: formatDate(new Date(record.created_at)),
                    indentNo: record.indent_number || '',
                    product: record.product_name || '',
                    quantity: record.approved_quantity || 0,
                    rate: record.approved_rate || 0,
                    uom: record.uom || '',
                    vendorName: record.approved_vendor_name || '',
                    paymentTerm: record.approved_payment_term || '',
                    specifications: record.specifications || '',
                }));

                if (isInitial) {
                    setTableData(pendingBatch);
                    setPageIndex(1);
                } else {
                    setTableData(prev => [...prev, ...pendingBatch]);
                    setPageIndex(prev => prev + 1);
                }

                const total = count || 0;
                setTotalCount(total);
                setHasMore((isInitial ? pendingBatch.length : tableData.length + pendingBatch.length) < total);
            }
        } catch (error: any) {
            console.error('Error fetching data from Supabase:', error);
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        // Reset state for a new initial fetch
        setTableData([]);
        setPageIndex(0);
        setHasMore(true);
        fetchData(true);
    }, []); // Empty dependency array to run only on mount for initial load

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
                searchFields={['indentNo', 'date', 'product', 'vendorName', 'paymentTerm', 'specifications']}
                dataLoading={dataLoading}
                className="h-[80dvh]"
                infiniteScroll={true}
                onLoadMore={() => fetchData(false)}
                hasMore={hasMore}
            />
        </div>
    );
};