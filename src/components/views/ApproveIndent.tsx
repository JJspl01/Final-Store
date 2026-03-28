
import { type ColumnDef, type Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { DownloadOutlined } from "@ant-design/icons";
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { fetchIndentMasterData } from '@/lib/fetchers';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { Tabs, TabsContent } from '../ui/tabs';
import { ClipboardCheck, PenSquare, Search } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useSheets } from '@/context/SheetsContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { Input } from '../ui/input';
import { supabase } from '@/lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { useInfiniteSupabaseQuery } from '@/hooks/useInfiniteSupabaseQuery';

const statuses = ['Reject', 'Three Party', 'Regular'];

interface ApproveTableData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    vendorType: 'Reject' | 'Three Party' | 'Regular';
    date: string;
    attachment: string;
    specifications: string;
}

interface HistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    groupHead: string;
    uom: string;
    approvedQuantity: number;
    vendorType: 'Reject' | 'Three Party' | 'Regular';
    date: string;
    approvedDate: string;
    specifications: string;
    lastUpdated?: string;
}

export default () => {
    const { user } = useAuth();
    const { updateIndentSheet } = useSheets();
    const queryClient = useQueryClient();

    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<HistoryData>>({});
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [bulkUpdates, setBulkUpdates] = useState<Map<string, { vendorType?: string; quantity?: number; product?: string }>>(new Map());
    const [submitting, setSubmitting] = useState(false);
    const [master, setMaster] = useState<any>(null);
    const [searchTermProductHistory, setSearchTermProductHistory] = useState('');

    const PENDING_COLUMNS = "indent_number, indenter_name, department, product_name, quantity, uom, attachment, specifications, vendor_type, created_at";
    const HISTORY_COLUMNS = "indent_number, indenter_name, department, product_name, group_head, approved_quantity, quantity, vendor_type, uom, specifications, created_at, actual_1";

    // ─── Queries ───

    const {
        data: pendingDataRaw,
        fetchNextPage: fetchNextPagePending,
        hasNextPage: hasNextPagePending,
        isLoading: pendingLoading,
        isFetchingNextPage: isFetchingNextPendingPage,
    } = useInfiniteSupabaseQuery(['approvePending'], {
        tableName: 'indent',
        queryBuilder: (q) => q.select(PENDING_COLUMNS).not('planned_1', 'is', null).is('actual_1', null).eq('indent_type', 'Purchase').order('created_at', { ascending: false }),
        pageSize: 10,
    });

    const {
        data: historyDataRaw,
        fetchNextPage: fetchNextPageHistory,
        hasNextPage: hasNextPageHistory,
        isLoading: historyLoading,
        isFetchingNextPage: isFetchingNextHistoryPage,
    } = useInfiniteSupabaseQuery(['approveHistory'], {
        tableName: 'indent',
        queryBuilder: (q) => q.select(HISTORY_COLUMNS).not('planned_1', 'is', null).not('actual_1', 'is', null).eq('indent_type', 'Purchase').order('created_at', { ascending: false }),
        pageSize: 10,
    });

    // ─── Effects ───

    useEffect(() => {
        fetchIndentMasterData().then(setMaster);
    }, []);

    // ─── Mappings ───

    const tableData = useMemo(() => {
        if (!pendingDataRaw) return [];
        return pendingDataRaw.pages.flatMap(p => p.data).map((record: any) => ({
            indentNo: record.indent_number || '',
            indenter: record.indenter_name || '',
            department: record.department || '',
            product: record.product_name || '',
            quantity: record.quantity || 0,
            uom: record.uom || '',
            attachment: record.attachment || '',
            specifications: record.specifications || '',
            vendorType: (statuses.includes(record.vendor_type) ? record.vendor_type : '') as "Reject" | "Three Party" | "Regular",
            date: formatDate(new Date(record.created_at)),
        }));
    }, [pendingDataRaw]);

    const historyData = useMemo(() => {
        if (!historyDataRaw) return [];
        return historyDataRaw.pages.flatMap(p => p.data).map((record: any) => ({
            indentNo: record.indent_number || '',
            indenter: record.indenter_name || '',
            department: record.department || '',
            product: record.product_name || '',
            groupHead: record.group_head || '',
            approvedQuantity: record.approved_quantity || record.quantity || 0,
            vendorType: record.vendor_type as HistoryData['vendorType'],
            uom: record.uom || '',
            specifications: record.specifications || '',
            date: formatDate(new Date(record.created_at)),
            approvedDate: formatDate(new Date(record.actual_1)),
        }));
    }, [historyDataRaw]);

    // ─── Handlers ───

    const handleRowSelect = useCallback((indentNo: string, checked: boolean) => {
        setSelectedRows(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(indentNo);
                const currentRow = tableData.find(row => row.indentNo === indentNo);
                if (currentRow) {
                    setBulkUpdates(prevUpdates => {
                        const newUpdates = new Map(prevUpdates);
                        newUpdates.set(indentNo, {
                            vendorType: currentRow.vendorType,
                            quantity: currentRow.quantity,
                            product: currentRow.product
                        });
                        return newUpdates;
                    });
                }
            } else {
                newSet.delete(indentNo);
                setBulkUpdates(prevUpdates => {
                    const newUpdates = new Map(prevUpdates);
                    newUpdates.delete(indentNo);
                    return newUpdates;
                });
            }
            return newSet;
        });
    }, [tableData]);

    const handleSelectAll = useCallback((checked: boolean) => {
        if (checked) {
            setSelectedRows(new Set(tableData.map(row => row.indentNo)));
            const newUpdates = new Map();
            tableData.forEach(row => {
                newUpdates.set(row.indentNo, {
                    vendorType: row.vendorType,
                    quantity: row.quantity,
                    product: row.product
                });
            });
            setBulkUpdates(newUpdates);
        } else {
            setSelectedRows(new Set());
            setBulkUpdates(new Map());
        }
    }, [tableData]);

    const handleBulkUpdate = useCallback((
        indentNo: string,
        field: 'vendorType' | 'quantity' | 'product',
        value: string | number
    ) => {
        setBulkUpdates((prevUpdates) => {
            const newUpdates = new Map(prevUpdates);

            const updateVal = value;
            const currentUpdate = newUpdates.get(indentNo) || {};
            newUpdates.set(indentNo, {
                ...currentUpdate,
                [field]: updateVal,
            });

            return newUpdates;
        });
    }, []);

    const handleSubmitBulkUpdates = async () => {
        if (selectedRows.size === 0) {
            toast.error('Please select at least one row to update');
            return;
        }

        setSubmitting(true);
        try {
            const formattedDate = new Date().toISOString().replace('T', ' ').split('.')[0];

            const updatesToProcess = Array.from(selectedRows).map(indentNo => {
                const update = bulkUpdates.get(indentNo);
                const originalRecord = tableData.find(s => s.indentNo === indentNo);

                if (!originalRecord || !update) return null;

                const updatePayload: any = {
                    vendor_type: update.vendorType || originalRecord.vendorType,
                    approved_quantity: update.quantity !== undefined ? update.quantity : originalRecord.quantity,
                    quantity: update.quantity !== undefined ? update.quantity : originalRecord.quantity,
                    product_name: update.product || originalRecord.product,
                    actual_1: formattedDate,
                };

                return {
                    indentNo: originalRecord.indentNo,
                    updatePayload
                };
            }).filter((item): item is NonNullable<typeof item> => item !== null);

            await Promise.all(updatesToProcess.map(async (updateItem) => {
                const { error } = await supabase
                    .from('indent')
                    .update(updateItem.updatePayload)
                    .eq('indent_number', updateItem.indentNo);

                if (error) throw error;
            }));

            toast.success(`Updated ${updatesToProcess.length} indents successfully`);
            updateIndentSheet();

            queryClient.invalidateQueries({ queryKey: ['approvePending'] });
            queryClient.invalidateQueries({ queryKey: ['approveHistory'] });

            setSelectedRows(new Set());
            setBulkUpdates(new Map());
        } catch (error: any) {
            console.error('❌ Error:', error);
            toast.error('Failed to update indents: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDownload = (data: any[]) => {
        if (!data || data.length === 0) {
            toast.error("No data to download");
            return;
        }

        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(","),
            ...data.map(row =>
                headers.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
            )
        ];

        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `pending-indents-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const onDownloadClick = async () => {
        handleDownload(tableData);
    };

    const handleEditClick = (row: HistoryData) => {
        setEditingRow(row.indentNo);
        setEditValues({
            approvedQuantity: row.approvedQuantity,
            uom: row.uom,
            vendorType: row.vendorType,
            product: row.product,
            specifications: row.specifications,
        });
    };

    const handleCancelEdit = () => {
        setEditingRow(null);
        setEditValues({});
    };

    const handleSaveEdit = async (indentNo: string) => {
        try {
            const currentRow = historyData.find(row => row.indentNo === indentNo);
            const oldProductName = currentRow?.product;
            const newProductName = editValues.product;

            if (oldProductName && newProductName && oldProductName !== newProductName) {
                const { error: updateError } = await supabase
                    .from('indent')
                    .update({ product_name: newProductName })
                    .eq('product_name', oldProductName);

                if (updateError) throw updateError;
                toast.success(`Updated product name from "${oldProductName}" to "${newProductName}"`);
            } else {
                const updatePayload: any = {};
                if (editValues.approvedQuantity !== undefined) updatePayload.approved_quantity = editValues.approvedQuantity;
                if (editValues.uom) updatePayload.uom = editValues.uom;
                if (editValues.vendorType) updatePayload.vendor_type = editValues.vendorType;
                if (editValues.product) updatePayload.product_name = editValues.product;
                if (editValues.specifications !== undefined) updatePayload.specifications = editValues.specifications;

                const { error } = await supabase
                    .from('indent')
                    .update(updatePayload)
                    .eq('indent_number', indentNo);

                if (error) throw error;
                toast.success(`Updated indent ${indentNo}`);
            }

            queryClient.invalidateQueries({ queryKey: ['approveHistory'] });
            setEditingRow(null);
            setEditValues({});
        } catch (error: any) {
            console.error('Error updating indent:', error);
            toast.error('Failed to update indent: ' + error.message);
        }
    };

    const handleInputChange = (field: keyof HistoryData, value: any) => {
        setEditValues(prev => ({ ...prev, [field]: value }));
    };

    // ─── Columns ───

    const columns = useMemo<ColumnDef<ApproveTableData>[]>(() => [
        {
            id: 'select',
            header: () => (
                <div className="flex justify-center">
                    <input
                        type="checkbox"
                        checked={selectedRows.size === tableData.length && tableData.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4"
                    />
                </div>
            ),
            cell: ({ row }: { row: Row<ApproveTableData> }) => {
                const indent = row.original;
                return (
                    <div className="flex justify-center">
                        <input
                            type="checkbox"
                            checked={selectedRows.has(indent.indentNo)}
                            onChange={(e) => handleRowSelect(indent.indentNo, e.target.checked)}
                            className="w-4 h-4"
                        />
                    </div>
                );
            },
            size: 50,
        },
        ...(user.indentApprovalAction
            ? [
                {
                    header: 'Vendor Type',
                    id: 'vendorTypeAction',
                    cell: ({ row }: { row: Row<ApproveTableData> }) => {
                        const indent = row.original;
                        const isSelected = selectedRows.has(indent.indentNo);
                        const currentValue = bulkUpdates.get(indent.indentNo)?.vendorType || indent.vendorType;

                        const handleChange = (value: string) => {
                            if (value === '') {
                                toast.warning('You cannot select Pending as a Vendor Type');
                                return;
                            }
                            handleBulkUpdate(indent.indentNo, 'vendorType', value as any);
                        };

                        return (
                            <Select
                                value={currentValue === '' ? '' : currentValue}
                                onValueChange={handleChange}
                                disabled={!isSelected}
                            >
                                <SelectTrigger
                                    className={`w-full min-w-[120px] max-w-[150px] text-xs ${!isSelected ? 'opacity-50' : ''}`}
                                >
                                    <SelectValue placeholder="Select Vendor Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Regular">Regular</SelectItem>
                                    <SelectItem value="Three Party">Three Party</SelectItem>
                                    <SelectItem value="Reject">Reject</SelectItem>
                                </SelectContent>
                            </Select>
                        );
                    },
                    size: 150,
                },
            ]
            : []),
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
            cell: ({ getValue }) => (
                <div className="font-medium text-xs sm:text-sm">{getValue() as string}</div>
            ),
            size: 100,
        },
        {
            accessorKey: 'indenter',
            header: 'Indenter',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm truncate max-w-[100px]">{getValue() as string}</div>
            ),
            size: 120,
        },
        {
            accessorKey: 'department',
            header: 'Department',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm truncate max-w-[100px]">{getValue() as string}</div>
            ),
            size: 120,
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ row }) => {
                const indent = row.original;
                const isSelected = selectedRows.has(indent.indentNo);
                const currentValue = bulkUpdates.get(indent.indentNo)?.product || indent.product;

                return (
                    <Input
                        defaultValue={currentValue}
                        onBlur={(e) => handleBulkUpdate(indent.indentNo, 'product', e.target.value)}
                        disabled={!isSelected}
                        className={`w-[150px] sm:w-[200px] text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}
                    />
                );
            },
            size: 150,
        },
        {
            accessorKey: 'quantity',
            header: 'Quantity',
            cell: ({ row }: { row: Row<ApproveTableData> }) => {
                const indent = row.original;
                const isSelected = selectedRows.has(indent.indentNo);
                const currentValue = bulkUpdates.get(indent.indentNo)?.quantity || indent.quantity;

                return (
                    <Input
                        type="number"
                        defaultValue={currentValue}
                        onBlur={(e) => {
                            const value = e.target.value;
                            if (value === '' || !isNaN(Number(value))) {
                                handleBulkUpdate(indent.indentNo, 'quantity', Number(value) || 0);
                            }
                        }}
                        disabled={!isSelected}
                        className={`w-16 sm:w-20 text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}
                        min="0"
                        step="1"
                    />
                );
            },
            size: 80,
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm">{getValue() as string}</div>
            ),
            size: 60,
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ row, getValue }) => {
                const initialValue = getValue() as string;
                const indentNo = row.original.indentNo;

                const handleBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
                    const value = e.target.value;
                    if (value === initialValue) return;
                    try {
                        const { error } = await supabase
                            .from('indent')
                            .update({ specifications: value })
                            .eq('indent_number', indentNo);
                        if (error) throw error;
                        toast.success(`Updated specifications for ${indentNo}`);
                    } catch (error: any) {
                        console.error('Error updating specifications:', error);
                        toast.error('Failed to update specifications');
                    }
                };

                return (
                    <div className="max-w-[120px] sm:max-w-[150px]">
                        <Input
                            defaultValue={initialValue}
                            onBlur={handleBlur}
                            className="border-none focus:border-1 text-xs sm:text-sm"
                            placeholder="Add specs..."
                        />
                    </div>
                );
            },
            size: 150,
        },
        {
            accessorKey: 'attachment',
            header: 'Attachment',
            cell: ({ row }: { row: Row<ApproveTableData> }) => {
                const attachment = row.original.attachment;
                return attachment ? (
                    <a href={attachment} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm underline">View</a>
                ) : (
                    <span className="text-gray-400 text-xs sm:text-sm">-</span>
                );
            },
            size: 80,
        },
        {
            accessorKey: 'date',
            header: 'Date',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm whitespace-nowrap">{getValue() as string}</div>
            ),
            size: 100,
        },
    ], [selectedRows, bulkUpdates, handleRowSelect, handleSelectAll, handleBulkUpdate, user.indentApprovalAction, tableData]);

    const historyColumns = useMemo<ColumnDef<HistoryData>[]>(() => [
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
            cell: ({ getValue }) => (
                <div className="font-medium text-xs sm:text-sm">{getValue() as string}</div>
            ),
            size: 100,
        },
        {
            accessorKey: 'indenter',
            header: 'Indenter',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm truncate max-w-[100px]">{getValue() as string}</div>
            ),
            size: 120,
        },
        {
            accessorKey: 'department',
            header: 'Department',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm truncate max-w-[100px]">{getValue() as string}</div>
            ),
            size: 120,
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                const currentValue = editValues.product ?? row.original.product;
                const groupHead = row.original.groupHead;
                const productOptions = (master?.groupHeadItems?.[groupHead] || []) as string[];

                return isEditing ? (
                    <Select value={currentValue} onValueChange={(value) => handleInputChange('product', value)}>
                        <SelectTrigger className="w-[150px] sm:w-[200px] text-xs sm:text-sm">
                            <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                            <div className="flex items-center border-b px-3 pb-3">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <input
                                    placeholder="Search products..."
                                    value={searchTermProductHistory}
                                    onChange={(e) => setSearchTermProductHistory(e.target.value)}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                />
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                                {productOptions?.filter((p) => p.toLowerCase().includes(searchTermProductHistory.toLowerCase())).map((p, i) => (
                                    <SelectItem key={i} value={p}>{p}</SelectItem>
                                ))}
                                {productOptions.length === 0 && (
                                    <div className="p-2 text-xs text-muted-foreground text-center">No products found</div>
                                )}
                            </div>
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="flex items-center gap-1 sm:gap-2 max-w-[120px] sm:max-w-[150px] break-words whitespace-normal">
                        <span className="text-xs sm:text-sm">{row.original.product}</span>
                        {user.indentApprovalAction && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8" onClick={() => { handleEditClick(row.original); setSearchTermProductHistory(''); }}>
                                <PenSquare className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
            size: 150,
        },
        {
            accessorKey: 'approvedQuantity',
            header: 'Quantity',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Input type="number" defaultValue={editValues.approvedQuantity ?? row.original.approvedQuantity} onBlur={(e) => handleInputChange('approvedQuantity', Number(e.target.value))} className="w-16 sm:w-20 text-xs sm:text-sm" />
                ) : (row.original.approvedQuantity);
            },
            size: 100,
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Input defaultValue={editValues.uom ?? row.original.uom} onBlur={(e) => handleInputChange('uom', e.target.value)} className="w-16 sm:w-20 text-xs sm:text-sm" />
                ) : (row.original.uom);
            },
            size: 80,
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Input defaultValue={editValues.specifications ?? row.original.specifications} onBlur={(e) => handleInputChange('specifications', e.target.value)} className="max-w-[120px] sm:max-w-[150px] text-xs sm:text-sm" />
                ) : (row.original.specifications);
            },
            size: 150,
        },
        {
            accessorKey: 'vendorType',
            header: 'Vendor Type',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Select value={editValues.vendorType ?? row.original.vendorType} onValueChange={(value) => handleInputChange('vendorType', value)}>
                        <SelectTrigger className="w-[120px] sm:w-[150px] text-xs sm:text-sm">
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Regular">Regular</SelectItem>
                            <SelectItem value="Three Party">Three Party</SelectItem>
                            <SelectItem value="Reject">Reject</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <Pill variant={row.original.vendorType === 'Reject' ? 'reject' : row.original.vendorType === 'Regular' ? 'primary' : 'secondary'}>
                        {row.original.vendorType}
                    </Pill>
                );
            },
            size: 150,
        },
        {
            accessorKey: 'date',
            header: 'Request Date',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm whitespace-nowrap">{getValue() as string}</div>
            ),
            size: 100,
        },
        {
            accessorKey: 'approvedDate',
            header: 'Approval Date',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm whitespace-nowrap">{getValue() as string}</div>
            ),
            size: 100,
        },
        ...(user.indentApprovalAction
            ? [
                {
                    id: 'editActions',
                    header: 'Actions',
                    cell: ({ row }: { row: Row<HistoryData> }) => {
                        const isEditing = editingRow === row.original.indentNo;
                        return isEditing ? (
                            <div className="flex gap-1 sm:gap-2">
                                <Button size="sm" onClick={() => handleSaveEdit(row.original.indentNo)} className="text-xs sm:text-sm px-2 py-1">Save</Button>
                                <Button size="sm" variant="outline" onClick={handleCancelEdit} className="text-xs sm:text-sm px-2 py-1">Cancel</Button>
                            </div>
                        ) : null;
                    },
                    size: 120,
                },
            ]
            : []),
    ], [editingRow, editValues, master, user.indentApprovalAction, handleSaveEdit, handleCancelEdit, searchTermProductHistory]);

    return (
        <div className="w-full">
            <Tabs defaultValue="pending" className="w-full">
                <div className="sticky top-0 z-20 bg-background -mx-5 -mt-5 p-5 pb-2 shadow-sm">
                    <Heading heading="Approve Indent" subtext="Update Indent status to Approve or Reject them" tabs>
                        <ClipboardCheck size={50} className="text-primary" />
                    </Heading>

                    {selectedRows.size > 0 && (
                        <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 sm:p-4 bg-blue-50 rounded-lg gap-2 sm:gap-0 border border-blue-100">
                            <span className="text-sm font-medium">{selectedRows.size} row(s) selected for update</span>
                            <Button onClick={handleSubmitBulkUpdates} disabled={submitting} className="flex items-center gap-2 w-full sm:w-auto">
                                {submitting && <Loader size={16} color="white" />}
                                Submit Updates
                            </Button>
                        </div>
                    )}
                </div>

                <div className="p-5 pt-2">
                    <TabsContent value="pending" className="w-full mt-0">
                        <div className="space-y-4 h-[calc(100vh-210px)] flex flex-col">
                            <div className="w-full flex-1 overflow-hidden min-h-0">
                                <DataTable
                                    data={tableData}
                                    columns={columns}
                                    searchFields={['indentNo', 'product', 'department', 'indenter']}
                                    dataLoading={pendingLoading}
                                    isFetchingNextPage={isFetchingNextPendingPage}
                                    infiniteScroll={true}
                                    onLoadMore={fetchNextPagePending}
                                    hasMore={hasNextPagePending}
                                    extraActions={
                                        <Button
                                            variant="default"
                                            onClick={onDownloadClick}
                                            className="flex items-center gap-2 text-xs sm:text-sm"
                                            style={{
                                                background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
                                                border: "none",
                                                borderRadius: "8px",
                                                padding: "8px 12px",
                                                fontWeight: "bold",
                                                boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                                            }}
                                        >
                                            <DownloadOutlined />
                                            <span className="hidden sm:inline">Download</span>
                                            <span className="sm:hidden">CSV</span>
                                        </Button>
                                    }
                                />
                            </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="history" className="w-full mt-0">
                        <div className="w-full h-[calc(100vh-210px)] overflow-hidden flex flex-col">
                            <DataTable
                                data={historyData}
                                columns={historyColumns}
                                searchFields={['indentNo', 'product', 'department', 'indenter']}
                                dataLoading={historyLoading}
                                isFetchingNextPage={isFetchingNextHistoryPage}
                                infiniteScroll={true}
                                onLoadMore={fetchNextPageHistory}
                                hasMore={hasNextPageHistory}
                            />
                        </div>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
};
