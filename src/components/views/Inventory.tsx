import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Pill } from '../ui/pill';
import { Store } from 'lucide-react';
import DataTable from '../element/DataTable';
import Heading from '../element/Heading';
import { useInfiniteSupabaseQuery } from '@/hooks/useInfiniteSupabaseQuery';

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
    // Data Query
    const {
        data: inventoryDataRaw,
        fetchNextPage,
        hasNextPage,
        isLoading: dataLoading,
        isFetchingNextPage,
    } = useInfiniteSupabaseQuery(['inventory'], {
        tableName: 'inventory_view',
        queryBuilder: (q) => q.order('item_name', { ascending: true }),
        pageSize: 20,
    });

    const tableData = useMemo(() => {
        if (!inventoryDataRaw) return [];
        return inventoryDataRaw.pages.flatMap(page => page.data).map((i: any) => ({
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
    }, [inventoryDataRaw]);
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
                dataLoading={dataLoading}
                isFetchingNextPage={isFetchingNextPage}
                infiniteScroll={true}
                onLoadMore={fetchNextPage}
                hasMore={hasNextPage}
            />
        </div>
    );
};
