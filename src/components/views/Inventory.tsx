import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Pill } from '../ui/pill';
import { Plus, Store, Loader2 } from 'lucide-react';
import DataTable from '../element/DataTable';
import Heading from '../element/Heading';
import { useInfiniteSupabaseQuery } from '@/hooks/useInfiniteSupabaseQuery';
import { Button } from '../ui/button';
import { useSheets } from '@/context/SheetsContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

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
    closingStockDb: number;
    inventoryOpening: number;
}

export default () => {
    const { indentSheet, receivedSheet, masterSheet, updateAll } = useSheets();
    const queryClient = useQueryClient();
    const [groupHeadFilter, setGroupHeadFilter] = useState<string>('All');
    const [productFilter, setProductFilter] = useState<string>('All');
    
    // New state for editing opening stock
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [openingStockUpdates, setOpeningStockUpdates] = useState<Map<string, number>>(new Map());
    const [submitting, setSubmitting] = useState(false);
    
    // Data Query
    const {
        data: inventoryDataRaw,
        fetchNextPage,
        hasNextPage,
        isLoading: dataLoading,
        isFetchingNextPage,
    } = useInfiniteSupabaseQuery(['inventory', groupHeadFilter, productFilter], {
        tableName: 'indent',
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
    console.log(inventoryDataRaw,"inventory row data ");

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
                    opening: i.opening_stock ?? i.opening ?? 0,
                    indented: i.indented || 0,
                    approved: i.approved || 0,
                    purchaseQuantity: i.purchase_quantity || 0,
                    outQuantity: i.out_quantity || 0,
                    current: i.current || 0,
                    totalPrice: i.totalPrice || 0,
                    closingStockDb: i.closing_stock ?? 0,
                    inventoryOpening: i.opening || 0,
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
                 
                 let indentedAmt = Number(indent.quantity || 0);
                 let approvedAmt = 0;
                 let outAmt = 0;

                 // Separate Store Out and Purchase logic
                 if (indent.indentType === 'Store Out') {
                       // Store out indents count toward 'Total Issued' if approved
                       if (indent.actual6 || indent.issueStatus === 'Done' || indent.issueStatus === 'Approved') {
                           outAmt = Number(indent.issuedQuantity || indent.quantity || 0);
                       }
                 } else {
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
                      
                      // Synchronize Labels with Indent table columns as requested
                      existing.groupHead = indent.groupHead || existing.groupHead;
                      if (!existing.uom) existing.uom = indent.uom || '';
                      
                      // Check for opening/closing stock in this indent row
                      if (indent.openingStock !== undefined && indent.openingStock !== 0) {
                          existing.opening = indent.openingStock;
                      }
                      if (indent.closingStock !== undefined && indent.closingStock !== 0) {
                          existing.closingStockDb = indent.closingStock;
                      }
                 } else {
                      // Add new product locally before it becomes officially purchased into inventory
                      unifiedMap.set(indent.productName, {
                            itemName: indent.productName,
                            groupHead: indent.groupHead || '',
                            uom: indent.uom || '',
                            rate: newRate !== null ? newRate : 0,
                            opening: indent.openingStock || 0,
                            indented: indentedAmt,
                            approved: approvedAmt,
                            purchaseQuantity: 0,
                            outQuantity: outAmt,
                            current: 0,
                            totalPrice: 0,
                            closingStockDb: indent.closingStock || 0,
                            inventoryOpening: 0,
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
        // Using original inventoryOpening as requested to prevent fluctuation
        unifiedMap.forEach(item => {
             item.current = item.inventoryOpening + item.purchaseQuantity - item.outQuantity;
             // Calculate accurate total price dynamically using new rate
             item.totalPrice = Number((item.current * item.rate).toFixed(2));
        });

        return Array.from(unifiedMap.values());
    }, [inventoryDataRaw, indentSheet, receivedSheet, groupHeadFilter, productFilter]);

    const groupHeadOptions = useMemo(() => {
        const heads = new Set(indentSheet.map(item => item.groupHead).filter(Boolean));
        return Array.from(heads).sort();
    }, [indentSheet]);

    const productOptions = useMemo(() => {
        const items = new Set(indentSheet.map(item => item.productName).filter(Boolean));
        return Array.from(items).sort();
    }, [indentSheet]);

    const handleRowSelect = (itemName: string, checked: boolean, currentVal: number) => {
        setSelectedRows(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(itemName);
                // Initialize update map with current value when selected
                setOpeningStockUpdates(prevUpdates => {
                    const newMap = new Map(prevUpdates);
                    if (!newMap.has(itemName)) {
                        newMap.set(itemName, currentVal);
                    }
                    return newMap;
                });
            } else {
                newSet.delete(itemName);
            }
            return newSet;
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const newSet = new Set(tableData.map(row => row.itemName));
            setSelectedRows(newSet);
            setOpeningStockUpdates(prev => {
                const newMap = new Map(prev);
                tableData.forEach(row => {
                    if (!newMap.has(row.itemName)) {
                        newMap.set(row.itemName, row.opening);
                    }
                });
                return newMap;
            });
        } else {
            setSelectedRows(new Set());
        }
    };

    const handleOpeningStockChange = (itemName: string, val: number) => {
        setOpeningStockUpdates(prev => {
            const newMap = new Map(prev);
            newMap.set(itemName, val);
            return newMap;
        });
    };

    const handleSubmitOpeningStock = async () => {
        if (selectedRows.size === 0) return;
        setSubmitting(true);
        try {
            // Collect all updates for selected rows
            const updates = Array.from(selectedRows).map(itemName => ({
                itemName,
                opening: openingStockUpdates.get(itemName)
            })).filter(u => u.opening !== undefined);

            // Update each item in the indent table
            for (const update of updates) {
                // Calculate the closing stock exactly like the UI preview
                const row = tableData.find(r => r.itemName === update.itemName);
                const closingStock = update.opening + (row?.purchaseQuantity || 0) - (row?.outQuantity || 0);

                const { error } = await supabase
                    .from('indent')
                    .update({ 
                        opening_stock: update.opening,
                        closing_stock: closingStock
                    })
                    .eq('product_name', update.itemName);
                
                if (error) throw error;
            }

            toast.success('Opening stock updated successfully');
            setSelectedRows(new Set());
            setOpeningStockUpdates(new Map());
            
            // Refresh data via TanStack Query and Sheets Context
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            if (updateAll) updateAll();
            
        } catch (error: any) {
            console.error('Error updating opening stock:', error);
            toast.error('Failed to update opening stock: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const columns: ColumnDef<InventoryTable>[] = [
        {
            id: 'select',
            header: () => (
                <div className="flex justify-center">
                    <input
                        type="checkbox"
                        checked={selectedRows.size === tableData.length && tableData.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                </div>
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <input
                        type="checkbox"
                        checked={selectedRows.has(row.original.itemName)}
                        onChange={(e) => handleRowSelect(row.original.itemName, e.target.checked, row.original.opening)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                </div>
            ),
            size: 50,
        },
        {
            accessorKey: 'itemName',
            header: 'Product Name',
            cell: ({ row }) => {
                return (
                    <div className="text-wrap max-w-40 text-center font-medium">{row.original.itemName}</div>
                );
            },
        },
        {
            accessorKey: 'groupHead',
            header: 'Group Head',
            cell: ({ row }) => (
                <div className="font-medium text-muted-foreground">{row.original.groupHead}</div>
            ),
        },
        {
            accessorKey: 'rate',
            header: 'Rate',
            cell: ({ row }) => (
                <div className="text-center font-medium">₹{row.original.rate.toLocaleString()}</div>
            ),
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ row }) => (
                <div className="text-center font-medium uppercase text-muted-foreground">{row.original.uom}</div>
            ),
        },
        {
            accessorKey: 'opening',
            header: 'Opening Stock',
            cell: ({ row }) => {
                const isSelected = selectedRows.has(row.original.itemName);
                const val = openingStockUpdates.get(row.original.itemName) ?? row.original.opening;
                if (isSelected) {
                    return (
                        <input
                            type="number"
                            value={val}
                            onChange={(e) => handleOpeningStockChange(row.original.itemName, Number(e.target.value))}
                            className="w-20 px-2 py-1 border rounded text-center focus:ring-1 focus:ring-primary outline-none"
                        />
                    );
                }
                return <div className="text-center font-medium">{row.original.opening}</div>;
            }
        },
        {
            id: 'closingStock',
            header: 'Closing Stock',
            cell: ({ row }) => {
                const isSelected = selectedRows.has(row.original.itemName);
                if (isSelected) {
                    const opening = openingStockUpdates.get(row.original.itemName) ?? row.original.opening;
                    const closing = opening + row.original.purchaseQuantity - row.original.outQuantity;
                    return <div className="text-center font-semibold text-primary">{closing} (Preview)</div>;
                }
                const val = row.original.closingStockDb;
                return <div className="text-center font-semibold text-primary">{val !== 0 ? val : ''}</div>;
            }
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
        <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
            <div className="shrink-0">
                <Heading heading="Inventory" subtext="View inventory">
                    <Store size={50} className="text-primary" />
                </Heading>
            </div>

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
                        
                        {selectedRows.size > 0 && (
                            <Button 
                                onClick={handleSubmitOpeningStock}
                                disabled={submitting}
                                className="h-9 bg-primary hover:bg-primary/90 text-white shadow-lg transition-all flex items-center gap-2"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                                Update Opening Stock ({selectedRows.size})
                            </Button>
                        )}
                    </div>
                }
             />
        </div>
    );
};
