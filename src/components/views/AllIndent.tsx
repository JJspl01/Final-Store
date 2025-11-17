import { type ColumnDef, type Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useEffect, useState } from 'react';
import { useSheets } from '@/context/SheetsContext';
import { DownloadOutlined } from "@ant-design/icons";
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { postToSheet } from '@/lib/fetchers';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { ClipboardList, PenSquare, Search } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import type { IndentSheet } from '@/types';

interface AllIndentTableData {
    id: string;
    timestamp: string;
    indentNumber: string;
    indenterName: string;
    indentApproveBy: string;
    indentType: 'Purchase' | 'Store Out';
    department: string;
    groupHead: string;
    productName: string;
    quantity: number;
    uom: string;
    areaOfUse: string;
    specifications: string;
    attachment: string;
    vendorType: string;
}

export default () => {
    const { indentSheet, indentLoading, updateIndentSheet, masterSheet: options } = useSheets();
    const { user } = useAuth();
    
    const [tableData, setTableData] = useState<AllIndentTableData[]>([]);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [bulkUpdates, setBulkUpdates] = useState<Map<string, Partial<AllIndentTableData>>>(new Map());
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchTermDepartment, setSearchTermDepartment] = useState('');
    const [searchTermGroupHead, setSearchTermGroupHead] = useState('');
    const [searchTermProduct, setSearchTermProduct] = useState('');

    // Fetch and process table data
    useEffect(() => {
        setTableData(
            indentSheet.map((sheet, index) => ({
                id: `${sheet.indentNumber}_${index}`, // Unique identifier
                timestamp: formatDate(new Date(sheet.timestamp)),
                indentNumber: sheet.indentNumber,
                indenterName: sheet.indenterName,
                indentApproveBy: sheet.indentApprovedBy || '',
                indentType: sheet.indentType as 'Purchase' | 'Store Out',
                department: sheet.department,
                groupHead: sheet.groupHead,
                productName: sheet.productName,
                quantity: sheet.quantity,
                uom: sheet.uom,
                areaOfUse: sheet.areaOfUse,
                specifications: sheet.specifications || '',
                attachment: sheet.attachment || '',
                vendorType: sheet.vendorType || 'Pending',
            }))
            .reverse()
        );
    }, [indentSheet]);

    const handleRowSelect = (id: string, checked: boolean) => {
        setSelectedRows(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(id);
                // Initialize with current values when selected
                const currentRow = tableData.find(row => row.id === id);
                if (currentRow) {
                    setBulkUpdates(prevUpdates => {
                        const newUpdates = new Map(prevUpdates);
                        newUpdates.set(id, { ...currentRow });
                        return newUpdates;
                    });
                }
            } else {
                newSet.delete(id);
                // Remove from bulk updates when unchecked
                setBulkUpdates(prevUpdates => {
                    const newUpdates = new Map(prevUpdates);
                    newUpdates.delete(id);
                    return newUpdates;
                });
            }
            return newSet;
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedRows(new Set(tableData.map(row => row.id)));
            // Initialize bulk updates for all rows
            const newUpdates = new Map();
            tableData.forEach(row => {
                newUpdates.set(row.id, { ...row });
            });
            setBulkUpdates(newUpdates);
        } else {
            setSelectedRows(new Set());
            setBulkUpdates(new Map());
        }
    };

    const handleBulkUpdate = (id: string, field: keyof AllIndentTableData, value: any) => {
        setBulkUpdates(prevUpdates => {
            const newUpdates = new Map(prevUpdates);
            const currentUpdate = newUpdates.get(id) || {};
            newUpdates.set(id, {
                ...currentUpdate,
                [field]: value
            });
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
            .map(id => {
                const update = bulkUpdates.get(id);
                const originalSheet = indentSheet.find(s => `${s.indentNumber}_${indentSheet.indexOf(s)}` === id);
                
                if (!originalSheet || !update) return null;

                // Current date in DD/MM/YYYY HH:mm:ss format
                const now = new Date();
                const day = String(now.getDate()).padStart(2, '0');
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const year = now.getFullYear();
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                const formattedTimestamp = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

                return {
                    ...originalSheet,
                    indenterName: update.indenterName || originalSheet.indenterName,
                    indentApprovedBy: update.indentApproveBy || originalSheet.indentApprovedBy,
                    indentType: update.indentType || originalSheet.indentType,
                    department: update.department || originalSheet.department,
                    groupHead: update.groupHead || originalSheet.groupHead,
                    productName: update.productName || originalSheet.productName,
                    quantity: update.quantity || originalSheet.quantity,
                    uom: update.uom || originalSheet.uom,
                    areaOfUse: update.areaOfUse || originalSheet.areaOfUse,
                    specifications: update.specifications || originalSheet.specifications,
                    timestamp: formattedTimestamp, // lastUpdated ke bajay timestamp use karo
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

        if (updatesToProcess.length > 0) {
            await postToSheet(updatesToProcess, 'update');
            toast.success(`Updated ${updatesToProcess.length} indents successfully`);
            
            setSelectedRows(new Set());
            setBulkUpdates(new Map());
            
            setTimeout(() => updateIndentSheet(), 1000);
        }
    } catch (error) {
        toast.error('Failed to update indents');
    } finally {
        setSubmitting(false);
    }
};

    const handleDownload = (data: AllIndentTableData[]) => {
        if (!data || data.length === 0) {
            toast.error("No data to download");
            return;
        }

        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(","),
            ...data.map(row =>
                headers.map(h => `"${String((row as any)[h] ?? "").replace(/"/g, '""')}"`).join(",")
            )
        ];

        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `all-indents-${Date.now()}.csv`);
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

    // Define table columns
    const columns: ColumnDef<AllIndentTableData>[] = [
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
            cell: ({ row }: { row: Row<AllIndentTableData> }) => {
                const indent = row.original;
                return (
                    <div className="flex justify-center">
                        <input
                            type="checkbox"
                            checked={selectedRows.has(indent.id)}
                            onChange={(e) => handleRowSelect(indent.id, e.target.checked)}
                            className="w-4 h-4"
                        />
                    </div>
                );
            },
            size: 50,
        },
        {
            accessorKey: 'timestamp',
            header: 'Date',
            cell: ({ getValue }) => (
                <div className="text-xs sm:text-sm whitespace-nowrap">
                    {getValue() as string}
                </div>
            ),
            size: 100,
        },
        {
            accessorKey: 'indentNumber',
            header: 'Indent No.',
            cell: ({ getValue }) => (
                <div className="font-medium text-xs sm:text-sm">
                    {getValue() as string}
                </div>
            ),
            size: 100,
        },
        {
            accessorKey: 'indenterName',
            header: 'Indenter Name',
            cell: ({ row }) => {
                const indent = row.original;
                const isSelected = selectedRows.has(indent.id);
                const currentValue = bulkUpdates.get(indent.id)?.indenterName || indent.indenterName;
                
                return (
                    <Input
                        value={currentValue}
                        onChange={(e) => handleBulkUpdate(indent.id, 'indenterName', e.target.value)}
                        disabled={!isSelected}
                        className={`w-32 text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}
                        placeholder="Indenter name"
                    />
                );
            },
            size: 140,
        },
        {
            accessorKey: 'indentApproveBy',
            header: 'Approved By',
            cell: ({ row }) => {
                const indent = row.original;
                const isSelected = selectedRows.has(indent.id);
                const currentValue = bulkUpdates.get(indent.id)?.indentApproveBy || indent.indentApproveBy;
                
                return (
                    <Input
                        value={currentValue}
                        onChange={(e) => handleBulkUpdate(indent.id, 'indentApproveBy', e.target.value)}
                        disabled={!isSelected}
                        className={`w-32 text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}
                        placeholder="Approved by"
                    />
                );
            },
            size: 140,
        },
        {
            accessorKey: 'indentType',
            header: 'Indent Type',
            cell: ({ row }) => {
                const indent = row.original;
                const isSelected = selectedRows.has(indent.id);
                const currentValue = bulkUpdates.get(indent.id)?.indentType || indent.indentType;
                
                return (
                    <Select
                        value={currentValue}
                        onValueChange={(value) => handleBulkUpdate(indent.id, 'indentType', value)}
                        disabled={!isSelected}
                    >
                        <SelectTrigger className={`w-32 text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}>
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Purchase">Purchase</SelectItem>
                            <SelectItem value="Store Out">Store Out</SelectItem>
                        </SelectContent>
                    </Select>
                );
            },
            size: 140,
        },
        {
            accessorKey: 'department',
            header: 'Department',
            cell: ({ row }) => {
                const indent = row.original;
                const isSelected = selectedRows.has(indent.id);
                const currentValue = bulkUpdates.get(indent.id)?.department || indent.department;
                
                return (
                    <Select
                        value={currentValue}
                        onValueChange={(value) => handleBulkUpdate(indent.id, 'department', value)}
                        disabled={!isSelected}
                    >
                        <SelectTrigger className={`w-36 text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}>
                            <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                            <div className="flex items-center border-b px-3 pb-3">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <input
                                    placeholder="Search departments..."
                                    value={searchTermDepartment}
                                    onChange={(e) => setSearchTermDepartment(e.target.value)}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                />
                            </div>
                            {options?.departments
                                ?.filter((dep) =>
                                    dep.toLowerCase().includes(searchTermDepartment.toLowerCase())
                                )
                                .map((dep, i) => (
                                    <SelectItem key={i} value={dep}>
                                        {dep}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                );
            },
            size: 160,
        },
        {
            accessorKey: 'groupHead',
            header: 'Group Head',
            cell: ({ row }) => {
                const indent = row.original;
                const isSelected = selectedRows.has(indent.id);
                const currentValue = bulkUpdates.get(indent.id)?.groupHead || indent.groupHead;
                
                return (
                    <Select
                        value={currentValue}
                        onValueChange={(value) => handleBulkUpdate(indent.id, 'groupHead', value)}
                        disabled={!isSelected}
                    >
                        <SelectTrigger className={`w-36 text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}>
                            <SelectValue placeholder="Select group head" />
                        </SelectTrigger>
                        <SelectContent>
                            <div className="flex items-center border-b px-3 pb-3">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <input
                                    placeholder="Search group heads..."
                                    value={searchTermGroupHead}
                                    onChange={(e) => setSearchTermGroupHead(e.target.value)}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                />
                            </div>
                            {Object.keys(options?.groupHeads || {})
                                .filter((dep) =>
                                    dep.toLowerCase().includes(searchTermGroupHead.toLowerCase())
                                )
                                .map((dep, i) => (
                                    <SelectItem key={i} value={dep}>
                                        {dep}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                );
            },
            size: 160,
        },
        {
            accessorKey: 'productName',
            header: 'Product Name',
            cell: ({ row }) => {
                const indent = row.original;
                const isSelected = selectedRows.has(indent.id);
                const currentValue = bulkUpdates.get(indent.id)?.productName || indent.productName;
                const groupHead = bulkUpdates.get(indent.id)?.groupHead || indent.groupHead;
                const productOptions = options?.groupHeads[groupHead] || [];
                
                return (
                    <Select
                        value={currentValue}
                        onValueChange={(value) => handleBulkUpdate(indent.id, 'productName', value)}
                        disabled={!isSelected || !groupHead}
                    >
                        <SelectTrigger className={`w-40 text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}>
                            <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                            <div className="flex items-center border-b px-3 pb-3">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <input
                                    placeholder="Search products..."
                                    value={searchTermProduct}
                                    onChange={(e) => setSearchTermProduct(e.target.value)}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                />
                            </div>
                            {productOptions
                                .filter((dep) =>
                                    dep.toLowerCase().includes(searchTermProduct.toLowerCase())
                                )
                                .map((dep, i) => (
                                    <SelectItem key={i} value={dep}>
                                        {dep}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                );
            },
            size: 180,
        },
        {
            accessorKey: 'quantity',
            header: 'Quantity',
            cell: ({ row }) => {
                const indent = row.original;
                const isSelected = selectedRows.has(indent.id);
                const currentValue = bulkUpdates.get(indent.id)?.quantity || indent.quantity;
                
                return (
                    <Input
                        type="number"
                        value={currentValue}
                        onChange={(e) => handleBulkUpdate(indent.id, 'quantity', Number(e.target.value) || 0)}
                        disabled={!isSelected}
                        className={`w-20 text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}
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
            cell: ({ row }) => {
                const indent = row.original;
                const isSelected = selectedRows.has(indent.id);
                const currentValue = bulkUpdates.get(indent.id)?.uom || indent.uom;
                
                return (
                    <Input
                        value={currentValue}
                        onChange={(e) => handleBulkUpdate(indent.id, 'uom', e.target.value)}
                        disabled={!isSelected}
                        className={`w-20 text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}
                        placeholder="UOM"
                    />
                );
            },
            size: 80,
        },
        {
            accessorKey: 'areaOfUse',
            header: 'Area of Use',
            cell: ({ row }) => {
                const indent = row.original;
                const isSelected = selectedRows.has(indent.id);
                const currentValue = bulkUpdates.get(indent.id)?.areaOfUse || indent.areaOfUse;
                
                return (
                    <Input
                        value={currentValue}
                        onChange={(e) => handleBulkUpdate(indent.id, 'areaOfUse', e.target.value)}
                        disabled={!isSelected}
                        className={`w-32 text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}
                        placeholder="Area of use"
                    />
                );
            },
            size: 140,
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ row }) => {
                const indent = row.original;
                const isSelected = selectedRows.has(indent.id);
                const currentValue = bulkUpdates.get(indent.id)?.specifications || indent.specifications;
                
                return (
                    <Textarea
                        value={currentValue}
                        onChange={(e) => handleBulkUpdate(indent.id, 'specifications', e.target.value)}
                        disabled={!isSelected}
                        className={`w-40 min-h-[60px] text-xs sm:text-sm resize-y ${!isSelected ? 'opacity-50' : ''}`}
                        placeholder="Specifications"
                    />
                );
            },
            size: 180,
        },
        {
            accessorKey: 'attachment',
            header: 'Attachment',
            cell: ({ row }) => {
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
    accessorKey: 'vendorType',
    header: 'Vendor Type',
    cell: ({ getValue }) => {
        const value = getValue() as string;
        return (
            <div className={`text-xs sm:text-sm ${!value || value === '' ? 'text-gray-400' : 'font-medium'}`}>
                {value || '-'}
            </div>
        );
    },
    size: 120,
},

    ];

    return (
        <div className="w-full overflow-hidden">
            <Heading
                heading="All Indents"
                subtext="View and manage all indent records"
            >
                <ClipboardList size={50} className="text-primary" />
            </Heading>

            <div className="space-y-4 p-5">
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
                            Update Selected
                        </Button>
                    </div>
                )}
                
                <div className="w-full overflow-x-auto">
                    <DataTable
                        data={tableData}
                        columns={columns}
                        searchFields={['indentNumber', 'indenterName', 'department', 'productName', 'groupHead']}
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
        </div>
    );
};
