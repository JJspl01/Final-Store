
import { type ColumnDef, type Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useEffect, useState } from 'react';
import { DownloadOutlined } from "@ant-design/icons";
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { fetchIndentMasterData, fetchFromSupabasePaginated } from '@/lib/fetchers';
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

    const [tableData, setTableData] = useState<ApproveTableData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<HistoryData>>({});
    const [loading, setLoading] = useState(false);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [bulkUpdates, setBulkUpdates] = useState<Map<string, { vendorType?: string; quantity?: number; product?: string }>>(new Map());
    const [searchTermProduct, setSearchTermProduct] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [master, setMaster] = useState<any>(null);

    // Fetching table data
    useEffect(() => {
        const fetchData = async () => {
            setDataLoading(true);
            try {
                // Fetch ALL data using pagination
                const allData = await fetchFromSupabasePaginated('indent', '*', { column: 'created_at', options: { ascending: false } });

                if (allData) {
                    // Filter pending indents (planned_1 not null and actual_1 null)
                    const pendingData = allData.filter(record =>
                        record.planned_1 != null &&
                        record.actual_1 == null &&
                        record.indent_type === 'Purchase'
                    );

                    const pendingTableData = pendingData.map((record: any) => ({
                        indentNo: record.indent_number || '',
                        indenter: record.indenter_name || '',
                        department: record.department || '',
                        product: record.product_name || '',
                        quantity: record.quantity || 0,
                        uom: record.uom || '',
                        attachment: record.attachment || '',
                        specifications: record.specifications || '',
                        vendorType: (statuses.includes(record.vendor_type)
                            ? record.vendor_type
                            : '') as "Reject" | "Three Party" | "Regular",
                        date: formatDate(new Date(record.created_at)),
                    }));
                    setTableData(pendingTableData);

                    // Filter history data (planned_1 not null and actual_1 not null)
                    const historyDataResult = allData.filter(record =>
                        record.planned_1 != null &&
                        record.actual_1 != null &&
                        record.indent_type === 'Purchase'
                    );

                    const historyTableData = historyDataResult.map((record: any) => ({
                        indentNo: record.indent_number || '',
                        indenter: record.indenter_name || '',
                        department: record.department || '',
                        product: record.product_name || '',
                        approvedQuantity: record.approved_quantity || record.quantity || 0,
                        vendorType: record.vendor_type as HistoryData['vendorType'],
                        uom: record.uom || '',
                        specifications: record.specifications || '',
                        date: formatDate(new Date(record.created_at)),
                        approvedDate: formatDate(new Date(record.actual_1)),
                    })).sort((a, b) => {
                        return b.indentNo.localeCompare(a.indentNo);
                    });
                    setHistoryData(historyTableData);
                }
            } catch (error: any) {
                console.error('Error fetching data from Supabase:', error);
                toast.error('Failed to fetch data: ' + error.message);
            } finally {
                setDataLoading(false);
            }
        };

        fetchData();
        fetchIndentMasterData().then(setMaster);
    }, []);

    const getCurrentFormattedDate = () => {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    const handleRowSelect = (indentNo: string, checked: boolean) => {
        setSelectedRows(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(indentNo);
                // Initialize with default values when selected
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
                // Remove from bulk updates when unchecked
                setBulkUpdates(prevUpdates => {
                    const newUpdates = new Map(prevUpdates);
                    newUpdates.delete(indentNo);
                    return newUpdates;
                });
            }
            return newSet;
        });
    };

    // Add this function to handle select all
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedRows(new Set(tableData.map(row => row.indentNo)));
            // Initialize bulk updates for all rows
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
    };

    const handleBulkUpdate = (
        indentNo: string,
        field: 'vendorType' | 'quantity' | 'product',
        value: string | number
    ) => {
        setBulkUpdates((prevUpdates) => {
            const newUpdates = new Map(prevUpdates);

            if (field === 'vendorType') {
                // value is string here
                const vendorValue = value as string;
                selectedRows.forEach((selectedIndentNo) => {
                    const currentUpdate = newUpdates.get(selectedIndentNo) || {};
                    newUpdates.set(selectedIndentNo, {
                        ...currentUpdate,
                        vendorType: vendorValue,
                    });
                });
            } else {
                // value is number here
                const qtyValue = value as number;
                const currentUpdate = newUpdates.get(indentNo) || {};
                newUpdates.set(indentNo, {
                    ...currentUpdate,
                    quantity: qtyValue,
                });
            }

            return newUpdates;
        });
    };


    const handleSubmitBulkUpdates = async () => {
        if (selectedRows.size === 0) {
            toast.error('Please select at least one row to update');
            return;
        }

        setSubmitting(true);
        try {
            // Format date as YYYY-MM-DD HH:MM:SS for PostgreSQL compatibility
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

            const updatesToProcess = Array.from(selectedRows).map(indentNo => {
                const update = bulkUpdates.get(indentNo);
                const originalRecord = tableData.find(s => s.indentNo === indentNo);

                if (!originalRecord || !update) return null;

                // Prepare update object with only changed fields
                const updatePayload: any = {
                    vendor_type: update.vendorType || originalRecord.vendorType,
                    approved_quantity: update.quantity !== undefined ? update.quantity : originalRecord.quantity,
                    // H column (quantity) bhi approved ke equal
                    quantity: update.quantity !== undefined ? update.quantity : originalRecord.quantity,
                    product_name: update.product || originalRecord.product,
                    actual_1: formattedDate,
                };

                return {
                    indentNo: originalRecord.indentNo,
                    updatePayload
                };
            }).filter((item): item is NonNullable<typeof item> => item !== null);

            // Process each update individually
            for (const updateItem of updatesToProcess) {
                const { error } = await supabase
                    .from('indent')
                    .update(updateItem.updatePayload)
                    .eq('indent_number', updateItem.indentNo);

                if (error) {
                    throw error;
                }
            }

            toast.success(`Updated ${updatesToProcess.length} indents successfully`);
            updateIndentSheet(); // Update context to sync sidebar counts

            // Refresh the data after updates with pagination
            const pendingData = await fetchFromSupabasePaginated(
                'indent',
                '*',
                { column: 'created_at', options: { ascending: false } },
                (q) => q.not('planned_1', 'is', null).is('actual_1', null).eq('indent_type', 'Purchase')
            );

            if (pendingData) {
                const pendingTableData = pendingData.map((record: any) => ({
                    indentNo: record.indent_number || '',
                    indenter: record.indenter_name || '',
                    department: record.department || '',
                    product: record.product_name || '',
                    quantity: record.quantity || 0,
                    uom: record.uom || '',
                    attachment: record.attachment || '',
                    specifications: record.specifications || '',
                    vendorType: (statuses.includes(record.vendor_type)
                        ? record.vendor_type as ApproveTableData['vendorType']
                        : '') as "Reject" | "Three Party" | "Regular",
                    date: formatDate(new Date(record.created_at)),
                }));
                setTableData(pendingTableData);
            }

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
        setLoading(true);
        try {
            await handleDownload(tableData);
        } finally {
            setLoading(false);
        }
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

            // Check if product name changed
            if (oldProductName && newProductName && oldProductName !== newProductName) {
                // Update all rows with the same old product name
                const { error: updateError } = await supabase
                    .from('indent')
                    .update({ product_name: newProductName })
                    .eq('product_name', oldProductName);

                if (updateError) throw updateError;

                toast.success(`Updated product name from "${oldProductName}" to "${newProductName}"`);
            } else {
                // Update only the current row for other fields
                const updatePayload: any = {};

                if (editValues.approvedQuantity !== undefined) {
                    updatePayload.approved_quantity = editValues.approvedQuantity;
                }
                if (editValues.uom) {
                    updatePayload.uom = editValues.uom;
                }
                if (editValues.vendorType) {
                    updatePayload.vendor_type = editValues.vendorType;
                }
                if (editValues.product) {
                    updatePayload.product_name = editValues.product;
                }
                if (editValues.specifications !== undefined) {
                    updatePayload.specifications = editValues.specifications;
                }

                const { error } = await supabase
                    .from('indent')
                    .update(updatePayload)
                    .eq('indent_number', indentNo);

                if (error) throw error;

                toast.success(`Updated indent ${indentNo}`);
            }

            // Refresh the data after updates
            const { data: historyDataResult, error: historyError } = await supabase
                .from('indent')
                .select('*')
                .not('planned_1', 'is', null)
                .not('actual_1', 'is', null)
                .eq('indent_type', 'Purchase')
                .order('created_at', { ascending: false });

            if (historyError) throw historyError;

            if (historyDataResult) {
                const historyTableData = historyDataResult.map((record: any) => ({
                    indentNo: record.indent_number || '',
                    indenter: record.indenter_name || '',
                    department: record.department || '',
                    product: record.product_name || '',
                    approvedQuantity: record.approved_quantity || record.quantity || 0,
                    vendorType: record.vendor_type as HistoryData['vendorType'],
                    uom: record.uom || '',
                    specifications: record.specifications || '',
                    date: formatDate(new Date(record.created_at)),
                    approvedDate: formatDate(new Date(record.actual_1)),
                })).sort((a, b) => {
                    return b.indentNo.localeCompare(a.indentNo);
                });
                setHistoryData(historyTableData);
            }

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

    // Creating table columns with mobile responsiveness
    const columns: ColumnDef<ApproveTableData>[] = [
        {
            id: 'select',
            header: ({ table }) => (
                <div className="flex justify-center">
                    <input
                        type="checkbox"
                        checked={table.getIsAllPageRowsSelected()}
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
                        const currentValue =
                            bulkUpdates.get(indent.indentNo)?.vendorType || indent.vendorType;

                        const handleChange = (value: string) => {
                            // ✅ Prevent selecting "" (just ignore)
                            if (value === '') {
                                toast.warning('You cannot select Pending as a Vendor Type');
                                return;
                            }
                            handleBulkUpdate(indent.indentNo, 'vendorType', value);
                        };

                        return (
                            <Select
                                value={currentValue === '' ? '' : currentValue}
                                onValueChange={handleChange}
                                disabled={!isSelected}
                            >
                                <SelectTrigger
                                    className={`w-full min-w-[120px] max-w-[150px] text-xs ${!isSelected ? 'opacity-50' : ''
                                        }`}
                                >
                                    <SelectValue placeholder="Select Vendor Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {/* Removed Pending option */}
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
                <div className="font-medium text-xs sm:text-sm">
                    {getValue() as string}
                </div>
            ),
            size: 100,
        },
        {
            accessorKey: 'indenter',
            header: 'Indenter',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm truncate max-w-[100px]">
                    {getValue() as string}
                </div>
            ),
            size: 120,
        },
        {
            accessorKey: 'department',
            header: 'Department',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm truncate max-w-[100px]">
                    {getValue() as string}
                </div>
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
                    <Select
                        value={currentValue}
                        onValueChange={(value) => handleBulkUpdate(indent.indentNo, 'product', value)}
                        disabled={!isSelected}
                    >
                        <SelectTrigger className={`w-[150px] sm:w-[200px] text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}>
                            <SelectValue placeholder="Product" />
                        </SelectTrigger>
                        <SelectContent className="w-[300px] sm:w-[500px]">
                            <div className="sticky top-0 z-10 bg-popover p-2 border-b">
                                <div className="flex items-center bg-muted rounded-md px-3 py-1">
                                    <Search className="h-4 w-4 shrink-0 opacity-50" />
                                    <input
                                        placeholder="Search product..."
                                        value={searchTermProduct}
                                        onChange={(e) => setSearchTermProduct(e.target.value)}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground ml-2"
                                    />
                                </div>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto p-1">
                                {Object.values(master?.groupHeadItems || {})
                                    .flat()
                                    .filter((p: any) => p.toLowerCase().includes(searchTermProduct.toLowerCase()))
                                    .map((p: any, i: number) => (
                                        <SelectItem key={i} value={p} className="cursor-pointer">
                                            {p}
                                        </SelectItem>
                                    ))}
                            </div>
                        </SelectContent>
                    </Select>
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

                // Local state for input value
                const [localValue, setLocalValue] = useState(String(currentValue));

                // Update local value when currentValue changes
                useEffect(() => {
                    setLocalValue(String(currentValue));
                }, [currentValue]);

                return (
                    <Input
                        type="number"
                        value={localValue}
                        onChange={(e) => {
                            setLocalValue(e.target.value); // Only update local state
                        }}
                        onBlur={(e) => {
                            // Update bulk updates only on blur
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
                <div className="text-xs sm:text-sm">
                    {getValue() as string}
                </div>
            ),
            size: 60,
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ row, getValue }) => {
                const [value, setValue] = useState(getValue() as string);
                const indentNo = row.original.indentNo;

                const handleBlur = async () => {
                    try {
                        const { error } = await supabase
                            .from('indent')
                            .update({ specifications: value })
                            .eq('indent_number', indentNo);

                        if (error) throw error;

                        toast.success(`Updated specifications for ${indentNo}`);

                        // Update local state
                        setTableData(prev => prev.map(item =>
                            item.indentNo === indentNo
                                ? { ...item, specifications: value }
                                : item
                        ));
                    } catch (error: any) {
                        console.error('Error updating specifications:', error);
                        toast.error('Failed to update specifications: ' + error.message);
                    }
                };

                return (
                    <div className="max-w-[120px] sm:max-w-[150px]">
                        <Input
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
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
                    <a
                        href={attachment}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm underline"
                    >
                        View
                    </a>
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
                <div className="text-xs sm:text-sm whitespace-nowrap">
                    {getValue() as string}
                </div>
            ),
            size: 100,
        },
    ];

    // History columns with mobile responsiveness
    const historyColumns: ColumnDef<HistoryData>[] = [
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
            cell: ({ getValue }) => (
                <div className="font-medium text-xs sm:text-sm">
                    {getValue() as string}
                </div>
            ),
            size: 100,
        },
        {
            accessorKey: 'indenter',
            header: 'Indenter',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm truncate max-w-[100px]">
                    {getValue() as string}
                </div>
            ),
            size: 120,
        },
        {
            accessorKey: 'department',
            header: 'Department',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm truncate max-w-[100px]">
                    {getValue() as string}
                </div>
            ),
            size: 120,
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                const currentValue = editValues.product ?? row.original.product;

                return isEditing ? (
                    <Select
                        value={currentValue}
                        onValueChange={(value) => handleInputChange('product', value)}
                    >
                        <SelectTrigger className="w-[150px] sm:w-[200px] text-xs sm:text-sm">
                            <SelectValue placeholder="Product" />
                        </SelectTrigger>
                        <SelectContent className="w-[300px] sm:w-[500px]">
                            <div className="sticky top-0 z-10 bg-popover p-2 border-b">
                                <div className="flex items-center bg-muted rounded-md px-3 py-1">
                                    <Search className="h-4 w-4 shrink-0 opacity-50" />
                                    <input
                                        placeholder="Search product..."
                                        value={searchTermProduct}
                                        onChange={(e) => setSearchTermProduct(e.target.value)}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground ml-2"
                                    />
                                </div>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto p-1">
                                {Object.values(master?.groupHeadItems || {})
                                    .flat()
                                    .filter((p: any) => p.toLowerCase().includes(searchTermProduct.toLowerCase()))
                                    .map((p: any, i: number) => (
                                        <SelectItem key={i} value={p} className="cursor-pointer">
                                            {p}
                                        </SelectItem>
                                    ))}
                            </div>
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="flex items-center gap-1 sm:gap-2 max-w-[120px] sm:max-w-[150px] break-words whitespace-normal">
                        <span className="text-xs sm:text-sm">{row.original.product}</span>
                        {user.indentApprovalAction && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 sm:h-8 sm:w-8"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-2 w-2 sm:h-3 sm:w-3" />
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
                    <Input
                        type="number"
                        value={editValues.approvedQuantity ?? row.original.approvedQuantity}
                        onChange={(e) => handleInputChange('approvedQuantity', Number(e.target.value))}
                        className="w-16 sm:w-20 text-xs sm:text-sm"
                    />
                ) : (
                    <div className="flex items-center gap-1 sm:gap-2">
                        <span className="text-xs sm:text-sm">{row.original.approvedQuantity}</span>
                        {user.indentApprovalAction && editingRow !== row.original.indentNo && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 sm:h-8 sm:w-8"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-2 w-2 sm:h-3 sm:w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
            size: 100,
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Input
                        value={editValues.uom ?? row.original.uom}
                        onChange={(e) => handleInputChange('uom', e.target.value)}
                        className="w-16 sm:w-20 text-xs sm:text-sm"
                    />
                ) : (
                    <div className="flex items-center gap-1 sm:gap-2">
                        <span className="text-xs sm:text-sm">{row.original.uom}</span>
                        {user.indentApprovalAction && editingRow !== row.original.indentNo && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 sm:h-8 sm:w-8"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-2 w-2 sm:h-3 sm:w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
            size: 80,
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Input
                        value={editValues.specifications ?? row.original.specifications}
                        onChange={(e) => handleInputChange('specifications', e.target.value)}
                        className="max-w-[120px] sm:max-w-[150px] text-xs sm:text-sm"
                    />
                ) : (
                    <div className="flex items-center gap-1 sm:gap-2 max-w-[120px] sm:max-w-[150px] break-words whitespace-normal">
                        <span className="text-xs sm:text-sm">{row.original.specifications}</span>
                        {user.indentApprovalAction && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 sm:h-8 sm:w-8"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-2 w-2 sm:h-3 sm:w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
            size: 150,
        },
        {
            accessorKey: 'vendorType',
            header: 'Vendor Type',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Select
                        value={editValues.vendorType ?? row.original.vendorType}
                        onValueChange={(value) => handleInputChange('vendorType', value)}
                    >
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
                    <div className="flex items-center gap-1 sm:gap-2">
                        <Pill
                            variant={
                                row.original.vendorType === 'Reject'
                                    ? 'reject'
                                    : row.original.vendorType === 'Regular'
                                        ? 'primary'
                                        : 'secondary'
                            }
                        >
                            <span className="text-xs sm:text-sm">{row.original.vendorType}</span>
                        </Pill>
                        {user.indentApprovalAction && editingRow !== row.original.indentNo && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 sm:h-8 sm:w-8"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-2 w-2 sm:h-3 sm:w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
            size: 150,
        },
        {
            accessorKey: 'date',
            header: 'Request Date',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm whitespace-nowrap">
                    {getValue() as string}
                </div>
            ),
            size: 100,
        },
        {
            accessorKey: 'approvedDate',
            header: 'Approval Date',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm whitespace-nowrap">
                    {getValue() as string}
                </div>
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
                                <Button
                                    size="sm"
                                    onClick={() => handleSaveEdit(row.original.indentNo)}
                                    className="text-xs sm:text-sm px-2 py-1"
                                >
                                    Save
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                    className="text-xs sm:text-sm px-2 py-1"
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : null;
                    },
                    size: 120,
                },
            ]
            : []),
    ];

    return (
        <div className="w-full overflow-hidden">
            <Tabs defaultValue="pending" className="w-full">
                <Heading
                    heading="Approve Indent"
                    subtext="Update Indent status to Approve or Reject them"
                    tabs
                >
                    <ClipboardCheck size={50} className="text-primary" />
                </Heading>
                <TabsContent value="pending" className="w-full">
                    <div className="space-y-4">
                        {selectedRows.size > 0 && (
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 sm:p-4 bg-blue-50 rounded-lg gap-2 sm:gap-0">
                                <span className="text-sm font-medium">
                                    {selectedRows.size} row(s) selected for update
                                </span>
                                <Button
                                    onClick={handleSubmitBulkUpdates}
                                    disabled={submitting}
                                    className="flex items-center gap-2 w-full sm:w-auto"
                                >
                                    {submitting && (
                                        <Loader
                                            size={16}
                                            color="white"
                                            aria-label="Loading Spinner"
                                        />
                                    )}
                                    Submit Updates
                                </Button>
                            </div>
                        )}

                        <div className="w-full overflow-x-auto">
                            <DataTable
                                data={tableData}
                                columns={columns}
                                searchFields={['indentNo', 'product', 'department', 'indenter', 'vendorType', 'date', 'specifications', 'quantity', 'uom']}
                                dataLoading={dataLoading}
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
                                        <span className="hidden sm:inline">{loading ? "Downloading..." : "Download"}</span>
                                        <span className="sm:hidden">{loading ? "..." : "CSV"}</span>
                                    </Button>
                                }
                            />
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="history" className="w-full">
                    <div className="w-full overflow-x-auto">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['indentNo', 'product', 'department', 'indenter', 'vendorType', 'date', 'approvedDate', 'specifications', 'approvedQuantity', 'uom']}
                            dataLoading={dataLoading}
                        />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};
