import Heading from '../element/Heading';

import { useEffect, useState } from 'react';
import { useSheets } from '@/context/SheetsContext';
import type { ColumnDef } from '@tanstack/react-table';
import { Pill } from '../ui/pill';
import { Store } from 'lucide-react';
import DataTable from '../element/DataTable';

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
    const { inventorySheet, inventoryLoading } = useSheets();

    const [tableData, setTableData] = useState<InventoryTable[]>([]);

    useEffect(() => {
        setTableData(
            inventorySheet.map((i) => ({
                totalPrice: i.totalPrice,
                approvedIndents: i.approved,
                uom: i.uom,
                rate: i.individualRate,
                current: i.current,
                status: i.colorCode,
                indented: i.indented,
                opening: i.opening,
                itemName: i.itemName,
                groupHead: i.groupHead,
                purchaseQuantity: i.purchaseQuantity,
                approved: i.approved,
                outQuantity: i.outQuantity,
            }))
        );
    }, [inventorySheet]);
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
                dataLoading={inventoryLoading}
                searchFields={['itemName', 'groupHead', 'uom', 'status']}
                className="h-[80dvh]"
            />
        </div>
    );
};
