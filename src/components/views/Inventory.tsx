import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Pill } from '../ui/pill';
import { Store } from 'lucide-react';
import DataTable from '../element/DataTable';
import Heading from '../element/Heading';

import { fetchFromSupabaseWithCount } from '@/lib/fetchers';
import { supabase } from '@/lib/supabaseClient';

interface InventoryTable {
    itemName: string;
    groupHead: string;
    uom: string;
    status: string;
    opening: number;
    rate: number;
    indented: number;
    approved: number;
    purchaseQuantity: number;
    outQuantity: number;
    current: number;
    totalPrice: number;
}

export default () => {
    const [tableData, setTableData] = useState<InventoryTable[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize] = useState(20);
    const [totalCount, setTotalCount] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const fetchInventory = async (isInitial = false) => {
        setLoading(true);
        try {
            const currentPage = isInitial ? 0 : pageIndex;
            const from = currentPage * pageSize;
            const to = (currentPage + 1) * pageSize - 1;

            const { data, count } = await fetchFromSupabaseWithCount(
                'inventory_view', // Using the view for consolidated stats
                '*',
                { from, to },
                { column: 'item_name', options: { ascending: true } }
            );

            if (data) {
                const mappedData = (data as any[]).map((i) => ({
                    totalPrice: i.totalPrice || 0,
                    approvedIndents: i.approved || 0,
                    uom: i.uom || '',
                    rate: i.individualRate || 0,
                    current: i.current || 0,
                    status: i.colorCode || '',
                    indented: i.indented || 0,
                    opening: i.opening || 0,
                    itemName: i.item_name || '',
                    groupHead: i.group_head || '',
                    purchaseQuantity: i.purchase_quantity || 0,
                    approved: i.approved || 0,
                    outQuantity: i.out_quantity || 0,
                }));

                if (isInitial) {
                    setTableData(mappedData);
                    setPageIndex(1);
                } else {
                    setTableData(prev => [...prev, ...mappedData]);
                    setPageIndex(prev => prev + 1);
                }

                const total = count || 0;
                setTotalCount(total);
                setHasMore(tableData.length + mappedData.length < total);
            }
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInventory(true);
    }, []);
    const columns: ColumnDef<InventoryTable>[] = [
        {
            accessorKey: 'itemName',
            header: 'Item',
            cell: ({ row }) => {
                return (
                    <div className="text-wrap max-w-40 text-center">{row.original.itemName}</div>
                );
            },
        },
        { accessorKey: 'groupHead', header: 'Group Head' },
        { accessorKey: 'uom', header: 'UOM' },
        {
            accessorKey: 'rate',
            header: 'Rate',
            cell: ({ row }) => {
                return <>&#8377;{row.original.rate}</>;
            },
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const code = row.original.status.toLowerCase();
                if (row.original.current === 0) {
                    return <Pill variant="reject">Out of Stock</Pill>;
                }
                if (code === 'red') {
                    return <Pill variant="pending">Low Stock</Pill>;
                }
                if (code === 'purple') {
                    return <Pill variant="primary">Excess</Pill>;
                }
                return <Pill variant="secondary">In Stock</Pill>;
            },
        },
        { accessorKey: 'indented', header: 'Indented' },
        { accessorKey: 'approved', header: 'Approved' },
        { accessorKey: 'purchaseQuantity', header: 'Purchased' },
        { accessorKey: 'outQuantity', header: 'Issued' },
        { accessorKey: 'current', header: 'Quantity' },
        {
            accessorKey: 'totalPrice',
            header: 'Total Price',

            cell: ({ row }) => {
                return <>&#8377;{row.original.totalPrice}</>;
            },
        },
    ];

    return (
        <div>
            <Heading heading="Inventory" subtext="View inveontory">
                <Store size={50} className="text-primary" />
            </Heading>

            <DataTable
                data={tableData}
                columns={columns}
                searchFields={['itemName', 'groupHead']}
                dataLoading={loading}
                infiniteScroll={true}
                onLoadMore={() => fetchInventory(false)}
                hasMore={hasMore}
            />
        </div>
    );
};
