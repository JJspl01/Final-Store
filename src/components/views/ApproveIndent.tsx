
import { type ColumnDef, type Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useEffect, useState } from 'react';
import { useSheets } from '@/context/SheetsContext';
import { DownloadOutlined } from "@ant-design/icons";

import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { postToSheet } from '@/lib/fetchers';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { Tabs, TabsContent } from '../ui/tabs';
import { ClipboardCheck, PenSquare } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { Input } from '../ui/input';

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
    const { indentSheet, indentLoading, updateIndentSheet } = useSheets();
    const { user } = useAuth();

    const [tableData, setTableData] = useState<ApproveTableData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<HistoryData>>({});
    const [loading, setLoading] = useState(false);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [bulkUpdates, setBulkUpdates] = useState<Map<string, { vendorType?: string; quantity?: number }>>(new Map());
    const [submitting, setSubmitting] = useState(false);

    // Fetching table data
    useEffect(() => {
        setTableData(
            indentSheet
                .filter(
                    (sheet) =>
                        sheet.planned1 !== '' &&
                        sheet.actual1 === '' &&
                        sheet.indentType === 'Purchase'
                )
                .map((sheet) => ({
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    quantity: sheet.quantity,
                    uom: sheet.uom,
                    attachment: sheet.attachment,
                    specifications: sheet.specifications || '',
                    vendorType: statuses.includes(sheet.vendorType)
                        ? (sheet.vendorType as ApproveTableData['vendorType'])
                        : 'Pending',
                    date: formatDate(new Date(sheet.timestamp)),
                }))
                .reverse()
        );
        setHistoryData(
            indentSheet
                .filter(
                    (sheet) =>
                        sheet.planned1 !== '' &&
                        sheet.actual1 !== '' &&
                        sheet.indentType === 'Purchase'
                )
                .map((sheet) => ({
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    approvedQuantity: sheet.approvedQuantity || sheet.quantity,
                    vendorType: sheet.vendorType as HistoryData['vendorType'],
                    uom: sheet.uom,
                    specifications: sheet.specifications || '',
                    date: formatDate(new Date(sheet.timestamp)),
                    approvedDate: formatDate(new Date(sheet.actual1)),
                }))
                .sort((a, b) => {
                    return b.indentNo.localeCompare(a.indentNo);
                })
        );
    }, [indentSheet]);

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
                            quantity: currentRow.quantity
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
                    quantity: row.quantity
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
        field: 'vendorType' | 'quantity',
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
            const updatesToProcess = Array.from(selectedRows)
                .map(indentNo => {
                    const update = bulkUpdates.get(indentNo);
                    const originalSheet = indentSheet.find(s => s.indentNumber === indentNo);

                    if (!originalSheet || !update) return null;

                    // Current date in DD/MM/YYYY HH:mm:ss format
                    const now = new Date();
                    const day = String(now.getDate()).padStart(2, '0');
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const year = now.getFullYear();
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    const seconds = String(now.getSeconds()).padStart(2, '0');
                    const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

                    // Create dataToSend without timestamp
                    const { timestamp, ...sheetWithoutTimestamp } = originalSheet;

                    const dataToSend = {
                        ...sheetWithoutTimestamp, // Spread without timestamp
                        vendorType: update.vendorType || originalSheet.vendorType,
                        approvedQuantity: update.quantity !== undefined ? update.quantity : originalSheet.quantity,
                        // H column (quantity) bhi approved ke equal
                        quantity: update.quantity !== undefined ? update.quantity : originalSheet.quantity,
                        actual1: formattedDate,
                    };

                    console.log('🔍 After creating object:', dataToSend);
                    console.log('dataToSend.actual1:', dataToSend.actual1);
                    console.log('typeof dataToSend.actual1:', typeof dataToSend.actual1);
                    console.log('Full object:', JSON.stringify(dataToSend, null, 2));

                    return dataToSend;
                })
                .filter((item): item is NonNullable<typeof item> => item !== null);

            console.log('🚀 Final data before postToSheet:', JSON.stringify(updatesToProcess, null, 2));

            if (updatesToProcess.length > 0) {
                await postToSheet(updatesToProcess, 'update');
                toast.success(`Updated ${updatesToProcess.length} indents successfully`);

                setSelectedRows(new Set());
                setBulkUpdates(new Map());

                setTimeout(() => updateIndentSheet(), 1000);
            }
        } catch (error) {
            console.error('❌ Error:', error);
            toast.error('Failed to update indents');
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

            // Current date in DD/MM/YYYY HH:mm:ss format
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

            // If product name changed, update all rows with the same old product name
            if (oldProductName && newProductName && oldProductName !== newProductName) {
                const rowsToUpdate = indentSheet.filter(s => s.productName === oldProductName);

                await postToSheet(
                    rowsToUpdate.map((prev) => ({
                        ...prev,
                        productName: newProductName,
                        timestamp: prev.timestamp, // Keep original
                    })),
                    'update'
                );
                toast.success(`Updated product name from "${oldProductName}" to "${newProductName}" for ${rowsToUpdate.length} records`);
            } else {
                // Update only the current row for other fields
                await postToSheet(
                    indentSheet
                        .filter((s) => s.indentNumber === indentNo)
                        .map((prev) => ({
                            ...prev,
                            approvedQuantity: editValues.approvedQuantity,
                            uom: editValues.uom,
                            vendorType: editValues.vendorType,
                            productName: editValues.product,
                            timestamp: prev.timestamp, // Keep original
                        })),
                    'update'
                );
                toast.success(`Updated indent ${indentNo}`);
            }

            updateIndentSheet();
            setEditingRow(null);
            setEditValues({});
        } catch {
            toast.error('Failed to update indent');
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
                            // ✅ Prevent selecting "Pending" (just ignore)
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
            cell: ({ getValue }) => (
                <div className="max-w-[120px] sm:max-w-[150px] break-words whitespace-normal text-xs sm:text-sm">
                    {getValue() as string}
                </div>
            ),
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
                        await postToSheet(
                            indentSheet
                                .filter((s) => s.indentNumber === indentNo)
                                .map((prev) => ({
                                    ...prev,
                                    specifications: value,
                                })),
                            'update'
                        );
                        toast.success(`Updated specifications for ${indentNo}`);
                        updateIndentSheet();
                    } catch {
                        toast.error('Failed to update specifications');
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
                return isEditing ? (
                    <Input
                        value={editValues.product ?? row.original.product}
                        onChange={(e) => handleInputChange('product', e.target.value)}
                        className="max-w-[120px] sm:max-w-[150px] text-xs sm:text-sm"
                    />
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
            cell: ({ getValue }) => (
                <div className="max-w-[120px] sm:max-w-[150px] break-words whitespace-normal text-xs sm:text-sm">
                    {getValue() as string}
                </div>
            ),
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
                            <SelectItem value="Regular Vendor">Regular</SelectItem>
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
            <Tabs defaultValue="" className="w-full">
                <Heading
                    heading="Approve Indent"
                    subtext="Update Indent status to Approve or Reject them"
                    tabs
                >
                    <ClipboardCheck size={50} className="text-primary" />
                </Heading>
                <TabsContent value="" className="w-full">
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
                                searchFields={['product', 'department', 'indenter', 'vendorType']}
                                dataLoading={indentLoading}
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
                            searchFields={['product', 'department', 'indenter', 'vendorType']}
                            dataLoading={indentLoading}
                        />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};
