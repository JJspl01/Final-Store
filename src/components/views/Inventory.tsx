import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Pill } from '../ui/pill';
import { Plus, Store } from 'lucide-react';
import DataTable from '../element/DataTable';
import Heading from '../element/Heading';
import { useInfiniteSupabaseQuery } from '@/hooks/useInfiniteSupabaseQuery';
import { Button } from '../ui/button';
import { useSheets } from '@/context/SheetsContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface InventoryTable {
    itemName: string;
    groupHead: string;
    uom: string;
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
    const { indentSheet, receivedSheet, masterSheet } = useSheets();
    const [groupHeadFilter, setGroupHeadFilter] = useState<string>('All');
    const [productFilter, setProductFilter] = useState<string>('All');
    
    // Data Query
    const {
        data: inventoryDataRaw,
        fetchNextPage,
        hasNextPage,
        isLoading: dataLoading,
        isFetchingNextPage,
    } = useInfiniteSupabaseQuery(['inventory', groupHeadFilter, productFilter], {
        tableName: 'inventory_view',
        queryBuilder: (q) => {
            let query = q.order('item_name', { ascending: true });
            if (groupHeadFilter !== 'All') {
                query = query.eq('group_head', groupHeadFilter);
            }
            if (productFilter !== 'All') {
                query = query.eq('item_name', productFilter);
            }
            return query;
        },
        pageSize: 20,
    });

    const tableData = useMemo(() => {
        const unifiedMap = new Map<string, InventoryTable>();

        // 1. Process existing inventory data
        if (inventoryDataRaw) {
            inventoryDataRaw.pages.flatMap(page => page.data).forEach((i: any) => {
                if (!i.item_name) return;
                
                unifiedMap.set(i.item_name, {
                    itemName: i.item_name,
                    groupHead: i.group_head || '',
                    uom: i.uom || '',
                    rate: i.individualRate || 0,
                    opening: i.opening || 0,
                    indented: i.indented || 0,
                    approved: i.approved || 0,
                    purchaseQuantity: i.purchase_quantity || 0,
                    outQuantity: i.out_quantity || 0,
                    current: i.current || 0,
                    totalPrice: i.totalPrice || 0,
                });
            });
        }

        // 2. Pre-calculate total indented quantity per product and include new products from indents
        // Reset indented, approved, purchaseQuantity, and outQuantity to recalculate from global sheets
        unifiedMap.forEach(item => { 
             item.indented = 0;
             item.approved = 0;
             item.purchaseQuantity = 0;
             item.outQuantity = 0;
        });

        const indentProductMap: Record<string, string> = {};
        const rateUpdated = new Set<string>();

        if (indentSheet) {
            indentSheet.forEach(indent => {
                 if (!indent.productName) return;

                 // Apply filters to indent processing
                 if (groupHeadFilter !== 'All' && indent.groupHead !== groupHeadFilter) return;
                 if (productFilter !== 'All' && indent.productName !== productFilter) return;

                 if (indent.indentNumber) {
                      indentProductMap[indent.indentNumber] = indent.productName;
                 }
                 
                 let indentedAmt = 0;
                 let approvedAmt = 0;
                 let outAmt = 0;

                 // Separate Store Out and Purchase logic
                 if (indent.indentType === 'Store Out') {
                       // Store out indents count toward 'Total Issued' if approved
                       if (indent.actual6 || indent.issueStatus === 'Done' || indent.issueStatus === 'Approved') {
                           outAmt = Number(indent.issuedQuantity || indent.quantity || 0);
                       }
                 } else {
                       indentedAmt = Number(indent.quantity || 0);
                       const isApproved = indent.vendorType === 'Regular' || indent.vendorType === 'Three Party';
                       approvedAmt = isApproved ? Number(indent.approvedQuantity || indent.quantity || 0) : 0;
                 }
                 
                 let newRate: number | null = null;
                 if (indent.approvedRate && !rateUpdated.has(indent.productName)) {
                     newRate = Number(indent.approvedRate);
                     rateUpdated.add(indent.productName);
                 }
                 
                 if (unifiedMap.has(indent.productName)) {
                      const existing = unifiedMap.get(indent.productName)!;
                      existing.indented += indentedAmt;
                      existing.approved += approvedAmt;
                      existing.outQuantity += outAmt;
                      
                      if (newRate !== null) {
                          existing.rate = newRate;
                      }
                      
                      // Use groupHead and uom from indent if missing in inventory
                      if (!existing.groupHead) existing.groupHead = indent.groupHead || '';
                      if (!existing.uom) existing.uom = indent.uom || '';
                 } else {
                      // Add new product locally before it becomes officially purchased into inventory
                      unifiedMap.set(indent.productName, {
                            itemName: indent.productName,
                            groupHead: indent.groupHead || '',
                            uom: indent.uom || '',
                            rate: newRate !== null ? newRate : 0,
                            opening: 0,
                            indented: indentedAmt,
                            approved: approvedAmt,
                            purchaseQuantity: 0,
                            outQuantity: outAmt,
                            current: 0,
                            totalPrice: 0,
                      });
                 }
            });
        }

        if (receivedSheet) {
             receivedSheet.forEach(received => {
                  if (received.indentNumber && received.receivedQuantity) {
                       const productName = indentProductMap[received.indentNumber];
                       if (productName && unifiedMap.has(productName)) {
                            const existing = unifiedMap.get(productName)!;
                            existing.purchaseQuantity += Number(received.receivedQuantity);
                       }
                  }
             });
        }

        // Ensure Total Stock correctly reflects dynamically synced Purchased and Issued quantities
        unifiedMap.forEach(item => {
             item.current = item.opening + item.purchaseQuantity - item.outQuantity;
             // Calculate accurate total price dynamically using new rate
             item.totalPrice = Number((item.current * item.rate).toFixed(2));
        });

        return Array.from(unifiedMap.values());
    }, [inventoryDataRaw, indentSheet, receivedSheet, groupHeadFilter, productFilter]);

    const groupHeadOptions = useMemo(() => {
        if (!masterSheet?.groupHeads) return [];
        return Object.keys(masterSheet.groupHeads).sort();
    }, [masterSheet]);

    const productOptions = useMemo(() => {
        if (!masterSheet?.groupHeads) return [];
        if (groupHeadFilter !== 'All') {
            return (masterSheet.groupHeads[groupHeadFilter] || []).sort();
        }
        return Array.from(new Set(Object.values(masterSheet.groupHeads).flat() as string[])).sort();
    }, [masterSheet, groupHeadFilter]);
    const columns: ColumnDef<InventoryTable>[] = [
        {
            accessorKey: 'itemName',
            header: 'Product Name',
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
        { accessorKey: 'indented', header: 'Total Indented' },
        { accessorKey: 'approved', header: 'Total Approved' },
        { accessorKey: 'purchaseQuantity', header: 'Total Purchased' },
        { accessorKey: 'outQuantity', header: 'Total Issued' },
        { accessorKey: 'current', header: 'Total Stock' },
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
            <Heading heading="Inventory" subtext="View inventory">
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
                extraActions={
                    <div className="flex gap-4 items-center">
                        <div className="flex flex-col gap-1">
                            <Select value={groupHeadFilter} onValueChange={(v) => {
                                setGroupHeadFilter(v);
                                setProductFilter('All');
                            }}>
                                <SelectTrigger className="w-[220px] h-9 bg-white shadow-sm border-primary/20 hover:border-primary/40 transition-colors">
                                    <SelectValue placeholder="All Group Heads" />
                                </SelectTrigger>
                                <SelectContent className="w-[280px] max-h-[220px] overflow-y-auto shadow-xl border-primary/10">
                                    <SelectItem value="All" className="font-medium text-primary">All Group Heads</SelectItem>
                                    <div className="h-px bg-primary/5 my-1" />
                                    {groupHeadOptions.map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <Select value={productFilter} onValueChange={setProductFilter}>
                                <SelectTrigger className="w-[250px] h-9 bg-white shadow-sm border-primary/20 hover:border-primary/40 transition-colors">
                                    <SelectValue placeholder="All Products" />
                                </SelectTrigger>
                                <SelectContent className="w-[300px] max-h-[220px] overflow-y-auto shadow-xl border-primary/10">
                                    <SelectItem value="All" className="font-medium text-primary">All Products</SelectItem>
                                    <div className="h-px bg-primary/5 my-1" />
                                    {productOptions.map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {(groupHeadFilter !== 'All' || productFilter !== 'All') && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                    setGroupHeadFilter('All');
                                    setProductFilter('All');
                                }}
                                className="h-9 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all font-medium"
                            >
                                Reset Filters
                            </Button>
                        )}
                    </div>
                }
            />
        </div>
    );
};
