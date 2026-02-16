import { type ColumnDef, type Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { ClipboardList, Search } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { supabase } from '@/lib/supabaseClient';
import { fetchFromSupabasePaginated } from '@/lib/fetchers';

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
    const { user } = useAuth();

    const [tableData, setTableData] = useState<AllIndentTableData[]>([]);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [bulkUpdates, setBulkUpdates] = useState<Map<string, Partial<AllIndentTableData>>>(new Map());
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchTermDepartment, setSearchTermDepartment] = useState('');
    const [searchTermGroupHead, setSearchTermGroupHead] = useState('');
    const [searchTermProduct, setSearchTermProduct] = useState('');
    const [indentLoading, setIndentLoading] = useState(true);

    useEffect(() => {
        const fetchIndents = async () => {
            setIndentLoading(true);
            try {
                const data = await fetchFromSupabasePaginated(
                    'indent',
                    '*',
                    { column: 'created_at', options: { ascending: false } }
                );

                if (data) {
                    const transformedData = data.map((record: any) => ({
                        id: record.id ? record.id.toString() : Math.random().toString(), // fallback to random ID if record.id is null/undefined
                        timestamp: formatDate(new Date(record.created_at)),
                        indentNumber: record.indent_number || '',
                        indenterName: record.indenter_name || '',
                        indentApproveBy: record.indent_approve_by || '',
                        indentType: record.indent_type as 'Purchase' | 'Store Out' || 'Purchase',
                        department: record.department || '',
                        groupHead: record.group_head || '',
                        productName: record.product_name || '',
                        quantity: record.quantity || 0,
                        uom: record.uom || '',
                        areaOfUse: record.area_of_use || '',
                        specifications: record.specifications || '',
                        attachment: record.attachment || '',
                        vendorType: record.vendor_type || 'Pending',
                    }));

                    setTableData(transformedData);
                }
            } catch (error: any) {
                console.error('Error fetching indents:', error);
                toast.error('Failed to fetch indents: ' + error.message);
            } finally {
                setIndentLoading(false);
            }
        };

        fetchIndents();
    }, []);
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
            const updatesToProcess = Array.from(selectedRows).map(id => {
                const update = bulkUpdates.get(id);
                const originalRecord = tableData.find(s => s.id === id);

                if (!originalRecord || !update) return null;

                // Prepare update object with only changed fields
                const updatePayload: any = {};

                if (update.indenterName !== originalRecord.indenterName) {
                    updatePayload.indenter_name = update.indenterName;
                }
                if (update.indentApproveBy !== originalRecord.indentApproveBy) {
                    updatePayload.indent_approve_by = update.indentApproveBy;
                }
                if (update.indentType !== originalRecord.indentType) {
                    updatePayload.indent_type = update.indentType;
                }
                if (update.department !== originalRecord.department) {
                    updatePayload.department = update.department;
                }
                if (update.groupHead !== originalRecord.groupHead) {
                    updatePayload.group_head = update.groupHead;
                }
                if (update.productName !== originalRecord.productName) {
                    updatePayload.product_name = update.productName;
                }
                if (update.quantity !== originalRecord.quantity) {
                    updatePayload.quantity = update.quantity;
                }
                if (update.uom !== originalRecord.uom) {
                    updatePayload.uom = update.uom;
                }
                if (update.areaOfUse !== originalRecord.areaOfUse) {
                    updatePayload.area_of_use = update.areaOfUse;
                }
                if (update.specifications !== originalRecord.specifications) {
                    updatePayload.specifications = update.specifications;
                }

                return {
                    id: originalRecord.id,
                    updatePayload
                };
            }).filter((item): item is NonNullable<typeof item> => item !== null);

            // Process each update individually
            for (const updateItem of updatesToProcess) {
                const { data, error } = await supabase
                    .from('indent')
                    .update(updateItem.updatePayload)
                    .eq('id', updateItem.id);

                if (error) {
                    throw error;
                }
            }

            toast.success(`Updated ${updatesToProcess.length} indents successfully`);

            // Refresh the data after updates with pagination
            const data = await fetchFromSupabasePaginated(
                'indent',
                '*',
                { column: 'created_at', options: { ascending: false } }
            );

            if (data) {
                const transformedData = data.map((record: any) => ({
                    id: record.id ? record.id.toString() : Math.random().toString(), // fallback to random ID if record.id is null/undefined
                    timestamp: formatDate(new Date(record.created_at)),
                    indentNumber: record.indent_number || '',
                    indenterName: record.indenter_name || '',
                    indentApproveBy: record.indent_approve_by || '',
                    indentType: record.indent_type as 'Purchase' | 'Store Out' || 'Purchase',
                    department: record.department || '',
                    groupHead: record.group_head || '',
                    productName: record.product_name || '',
                    quantity: record.quantity || 0,
                    uom: record.uom || '',
                    areaOfUse: record.area_of_use || '',
                    specifications: record.specifications || '',
                    attachment: record.attachment || '',
                    vendorType: record.vendor_type || 'Pending',
                }));

                setTableData(transformedData);
            }

            setSelectedRows(new Set());
            setBulkUpdates(new Map());
        } catch (error: any) {
            console.error('Error updating indents:', error);
            toast.error('Failed to update indents: ' + error.message);
        } finally {
            setSubmitting(false);
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
                    <Input
                        value={currentValue}
                        onChange={(e) => handleBulkUpdate(indent.id, 'department', e.target.value)}
                        disabled={!isSelected}
                        className={`w-36 text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}
                        placeholder="Department"
                    />
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
                    <Input
                        value={currentValue}
                        onChange={(e) => handleBulkUpdate(indent.id, 'groupHead', e.target.value)}
                        disabled={!isSelected}
                        className={`w-36 text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}
                        placeholder="Group head"
                    />
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

                return (
                    <Input
                        value={currentValue}
                        onChange={(e) => handleBulkUpdate(indent.id, 'productName', e.target.value)}
                        disabled={!isSelected}
                        className={`w-52 text-xs sm:text-sm ${!isSelected ? 'opacity-50' : ''}`}
                        placeholder="Product name"
                    />
                );
            },
            size: 220,
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
                    />
                </div>
            </div>
        </div>
    );
};
