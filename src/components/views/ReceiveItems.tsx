
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DownloadOutlined } from "@ant-design/icons";
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabaseClient';
import { uploadFile, fetchFromSupabasePaginated, fetchFromSupabaseWithCount } from '@/lib/fetchers';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Truck, SquarePen, Check, X, Search } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate } from '@/lib/utils';
import { useSheets } from '@/context/SheetsContext';
import { Pill } from '../ui/pill';

interface RecieveItemsData {
    poDate: string;
    poNumber: string;
    vendor: string;
    indentNumber: string;
    product: string;
    uom: string;
    quantity: number;
    receivedQty?: number;
    remainingQty?: number;
    poCopy: string;
}

interface HistoryData {
    id?: string | number;
    indentNumber: string;
    receiveStatus: string;
    poNumber: string;
    poDate: string;
    vendor: string;
    product: string;
    orderQuantity: number;
    uom: string;
    receivedDate: string;
    receivedQuantity: number;
    totalReceivedQty?: number;
    remainingQty?: number;
    photoOfProduct: string;
    warrantyStatus: string;
    warrantyEndDate: string;
    billStatus: string;
    billNumber: string;
    billAmount: number;
    photoOfBill: string;
    anyTransport: string;
    transporterName: string;
    transportingAmount: number;
}

const ReceiveItems = () => {
    const [localIndentLoading, setLocalIndentLoading] = useState(false);
    const [localReceivedLoading, setLocalReceivedLoading] = useState(false);
    const { user } = useAuth();
    const { updateIndentSheet, updateReceivedSheet } = useSheets();

    const [tableData, setTableData] = useState<RecieveItemsData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [selectedIndent, setSelectedIndent] = useState<RecieveItemsData | null>(null);
    const [matchingIndents, setMatchingIndents] = useState<RecieveItemsData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editingCell, setEditingCell] = useState<{ rowId: string; field: 'product' | 'orderQuantity' | 'uom' | 'receivedQuantity' | 'warrantyStatus' | 'billStatus' | 'billAmount'; recordId?: string | number } | null>(null);
    const [editCellValue, setEditCellValue] = useState<string | number>('');
    const [masterItems, setMasterItems] = useState<string[]>([]);
    const [productSearch, setProductSearch] = useState('');

    // Pending Tab Pagination
    const [pendingPageIndex, setPendingPageIndex] = useState(0);
    const [pendingPageSize] = useState(10);
    const [pendingTotalCount, setPendingTotalCount] = useState(0);
    const [hasMorePending, setHasMorePending] = useState(true);

    // History Tab Pagination
    const [historyPageIndex, setHistoryPageIndex] = useState(0);
    const [historyPageSize] = useState(10);
    const [historyTotalCount, setHistoryTotalCount] = useState(0);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);

    const fetchPendingItems = async (isInitial = false) => {
        setLocalIndentLoading(true);

        const currentPage = isInitial ? 0 : pendingPageIndex;
        const from = currentPage * pendingPageSize;
        const to = (currentPage + 1) * pendingPageSize - 1;

        // Fetch indents with pagination
        const { data: indentData, count } = await fetchFromSupabaseWithCount(
            'indent',
            'indent_number, po_number, uom, po_copy, approved_vendor_name, approved_quantity, actual_4, product_name, planned_5, actual_5, department, indenter_name, vendor_type',
            { from, to },
            { column: 'planned_5', options: { ascending: false } },
            (q) => q.not('planned_5', 'is', null).is('actual_5', null)
        );

        if (!indentData || indentData.length === 0) {
            if (isInitial) setTableData([]);
            setPendingTotalCount(0);
            setHasMorePending(false);
            setLocalIndentLoading(false);
            return;
        }

        const indentNumbers = (indentData as any[]).map(i => i.indent_number).filter(Boolean);
        let receivedData: any[] = [];
        if (indentNumbers.length > 0) {
            const { data: rData } = await supabase
                .from('received')
                .select('indent_number, received_quantity')
                .in('indent_number', indentNumbers);
            receivedData = rData || [];
        }

        const mappedBatch = (indentData as any[]).map((item: any) => {
            const totalReceived = receivedData
                .filter((r: any) => r.indent_number === item.indent_number)
                .reduce((sum: number, r: any) => sum + (Number(r.received_quantity) || 0), 0);

            const approvedQty = Number(item.approved_quantity) || 0;
            const remainingQty = Math.max(0, approvedQty - totalReceived);

            return {
                indentNumber: item.indent_number,
                poNumber: item.po_number,
                uom: item.uom,
                poCopy: item.po_copy,
                vendor: item.approved_vendor_name,
                quantity: approvedQty,
                receivedQty: totalReceived,
                remainingQty: remainingQty,
                poDate: item.actual_4,
                product: item.product_name,
                department: item.department || '',
                indenter: item.indenter_name || '',
                vendorType: item.vendor_type || ''
            };
        });

        if (isInitial) {
            setTableData(mappedBatch);
            setPendingPageIndex(1);
        } else {
            setTableData(prev => [...prev, ...mappedBatch]);
            setPendingPageIndex(prev => prev + 1);
        }

        const total = count || 0;
        setPendingTotalCount(total);
        setHasMorePending((isInitial ? mappedBatch.length : tableData.length + mappedBatch.length) < total);
        setLocalIndentLoading(false);
    };

    const fetchHistoryItems = async (isInitial = false) => {
        setLocalReceivedLoading(true);

        const currentPage = isInitial ? 0 : historyPageIndex;
        const from = currentPage * historyPageSize;
        const to = (currentPage + 1) * historyPageSize - 1;

        const { data: receivedData, count } = await fetchFromSupabaseWithCount(
            'received',
            '*',
            { from, to },
            { column: 'timestamp', options: { ascending: false } }
        );

        if (!receivedData || receivedData.length === 0) {
            if (isInitial) setHistoryData([]);
            setHistoryTotalCount(0);
            setHasMoreHistory(false);
            setLocalReceivedLoading(false);
            return;
        }

        const indentNumbers = (receivedData as any[]).map(r => r.indent_number).filter(Boolean);
        let indentData: any[] = [];
        if (indentNumbers.length > 0) {
            const { data: iData } = await supabase
                .from('indent')
                .select('indent_number, po_number, actual_4, approved_vendor_name, product_name, approved_quantity, uom, planned_5, actual_5')
                .in('indent_number', indentNumbers);
            indentData = iData || [];
        }

        const mappedBatch = (receivedData as any[]).map((receivedRecord: any) => {
            const indent = indentData.find(i => i.indent_number === receivedRecord.indent_number);
            const approvedQty = indent ? (Number(indent.approved_quantity) || 0) : 0;

            return {
                id: receivedRecord.id,
                indentNumber: receivedRecord.indent_number || indent?.indent_number || '',
                receiveStatus: receivedRecord.received_status || 'Unknown',
                poNumber: receivedRecord.po_number || indent?.po_number,
                poDate: receivedRecord.po_date ? formatDate(new Date(receivedRecord.po_date)) : (indent ? formatDate(new Date(indent.actual_4)) : ''),
                vendor: receivedRecord.vendor || indent?.approved_vendor_name,
                product: indent?.product_name || '',
                orderQuantity: approvedQty,
                receivedQuantity: Number(receivedRecord.received_quantity) || 0,
                uom: receivedRecord.uom || indent?.uom,
                photoOfProduct: receivedRecord.photo_of_product || '',
                receivedDate: receivedRecord.timestamp ? formatDate(new Date(receivedRecord.timestamp)) : '',
                warrantyStatus: receivedRecord.warranty_status || '',
                warrantyEndDate: receivedRecord.end_date ? formatDate(new Date(receivedRecord.end_date)) : '',
                billStatus: receivedRecord.bill_status || '',
                billNumber: receivedRecord.bill_number || '',
                billAmount: receivedRecord.bill_amount || 0,
                photoOfBill: receivedRecord.photo_of_bill || '',
                anyTransport: receivedRecord.any_transportations || '',
                transporterName: receivedRecord.transporter_name || '',
                transportingAmount: receivedRecord.transporting_amount || 0,
            };
        });

        if (isInitial) {
            setHistoryData(mappedBatch);
            setHistoryPageIndex(1);
        } else {
            setHistoryData(prev => [...prev, ...mappedBatch]);
            setHistoryPageIndex(prev => prev + 1);
        }

        const total = count || 0;
        setHistoryTotalCount(total);
        setHasMoreHistory((isInitial ? mappedBatch.length : historyData.length + mappedBatch.length) < total);
        setLocalReceivedLoading(false);
    };

    useEffect(() => {
        fetchPendingItems(true);
    }, []);

    useEffect(() => {
        fetchHistoryItems(true);
    }, []);

    // Fetch master items for product dropdown
    useEffect(() => {
        const fetchMasterItems = async () => {
            try {
                const data = await fetchFromSupabasePaginated(
                    'master',
                    'item_name',
                    { column: 'item_name', options: { ascending: true } }
                );
                const items = data
                    .map((d: any) => d.item_name)
                    .filter(Boolean);
                setMasterItems([...new Set(items)] as string[]);
            } catch (error) {
                console.error('Error fetching master items:', error);
            }
        };
        fetchMasterItems();
    }, []);

    // Per-cell inline edit handlers for history tab
    const handleStartCellEdit = (rowId: string, field: 'product' | 'orderQuantity' | 'uom' | 'receivedQuantity' | 'warrantyStatus' | 'billStatus' | 'billAmount', currentValue: string | number, recordId?: string | number) => {
        setEditingCell({ rowId, field, recordId });
        setEditCellValue(currentValue);
        setProductSearch('');
    };

    const handleCancelCellEdit = () => {
        setEditingCell(null);
        setEditCellValue('');
        setProductSearch('');
    };

    const handleSaveCellEdit = async () => {
        if (!editingCell) return;
        try {
            const isIndentUpdate = ['product', 'orderQuantity', 'uom'].includes(editingCell.field);
            const localUpdate: any = {};

            if (isIndentUpdate) {
                const updatePayload: any = {};
                if (editingCell.field === 'product') {
                    updatePayload.product_name = editCellValue;
                    localUpdate.product = editCellValue;
                } else if (editingCell.field === 'orderQuantity') {
                    updatePayload.approved_quantity = Number(editCellValue) || 0;
                    localUpdate.orderQuantity = Number(editCellValue) || 0;
                } else if (editingCell.field === 'uom') {
                    updatePayload.uom = editCellValue;
                    localUpdate.uom = editCellValue;
                }

                const { error } = await supabase
                    .from('indent')
                    .update(updatePayload)
                    .eq('indent_number', editingCell.rowId);

                if (error) throw error;

                // Update local state for matching indentNumber
                setHistoryData(prev =>
                    prev.map(item =>
                        item.indentNumber === editingCell.rowId
                            ? { ...item, ...localUpdate }
                            : item
                    )
                );
            } else {
                const updatePayload: any = {};
                if (editingCell.field === 'receivedQuantity') {
                    updatePayload.received_quantity = Number(editCellValue) || 0;
                    localUpdate.receivedQuantity = Number(editCellValue) || 0;
                } else if (editingCell.field === 'warrantyStatus') {
                    updatePayload.warranty_status = editCellValue;
                    localUpdate.warrantyStatus = editCellValue;
                } else if (editingCell.field === 'billStatus') {
                    updatePayload.bill_status = editCellValue;
                    localUpdate.billStatus = editCellValue;
                } else if (editingCell.field === 'billAmount') {
                    updatePayload.bill_amount = Number(editCellValue) || 0;
                    localUpdate.billAmount = Number(editCellValue) || 0;
                }

                if (editingCell.recordId) {
                    const { error } = await supabase
                        .from('received')
                        .update(updatePayload)
                        .eq('id', editingCell.recordId);

                    if (error) throw error;
                }

                // Update local state ONLY for that specific specific record
                setHistoryData(prev =>
                    prev.map(item =>
                        item.id === editingCell.recordId
                            ? { ...item, ...localUpdate }
                            : item
                    )
                );
            }

            toast.success(`Updated ${editingCell.field}`);
            setEditingCell(null);
            setEditCellValue('');
            setProductSearch('');
        } catch (error: any) {
            console.error('Error saving edit:', error);
            toast.error('Failed to save: ' + error.message);
        }
    };

    const handleDownload = (data: (RecieveItemsData | HistoryData)[]) => {
        if (!data || data.length === 0) {
            toast.error("No data to download");
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Receive Items");
        XLSX.writeFile(workbook, `receive-items-${Date.now()}.xlsx`);
    };

    const onDownloadClick = async () => {
        setLoading(true);
        try {
            await handleDownload(tableData);
            toast.success("File downloaded successfully");
        } catch {
            toast.error("Failed to download file");
        } finally {
            setLoading(false);
        }
    };

    const columns: ColumnDef<RecieveItemsData>[] = [
        ...(user.receiveItemView
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<RecieveItemsData> }) => {
                        const indent = row.original;

                        return (
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedIndent(indent);
                                    }}
                                >
                                    Store In
                                </Button>
                            </DialogTrigger>
                        );
                    },
                },
            ]
            : []),
        {
            accessorKey: 'poDate',
            header: 'PO Date',
            accessorFn: (x) => formatDate(new Date(x.poDate)),
        },
        { accessorKey: 'poNumber', header: 'PO Number' },
        {
            accessorKey: 'vendor',
            header: 'Vendor',
            cell: ({ row }) => (
                <div className="whitespace-normal break-words min-w-[150px] max-w-[250px]">
                    {row.original.vendor}
                </div>
            ),
        },
        { accessorKey: 'indentNumber', header: 'Indent No.' },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ row }) => (
                <div className="whitespace-normal break-words min-w-[200px] max-w-[300px]">
                    {row.original.product}
                </div>
            ),
        },
        { accessorKey: 'uom', header: 'UOM' },
        { accessorKey: 'quantity', header: 'Ordered Qty' },
        { accessorKey: 'receivedQty', header: 'Received Qty' },
        { accessorKey: 'remainingQty', header: 'Remaining Qty' },
        {
            accessorKey: 'poCopy',
            header: 'PO Copy',
            cell: ({ row }) => {
                const poCopy = row.original.poCopy;
                return poCopy ? (
                    <a href={poCopy} target="_blank">
                        PDF
                    </a>
                ) : (
                    <></>
                );
            },
        },
    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        { accessorKey: 'indentNumber', header: 'Indent No.' },
        { accessorKey: 'poDate', header: 'PO Date' },
        { accessorKey: 'poNumber', header: 'PO Number' },
        {
            accessorKey: 'receiveStatus',
            header: 'Receive Status',
            cell: ({ row }) => {
                const status = row.original.receiveStatus;
                const variant = status === 'Received' ? 'secondary' : 'reject';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        {
            accessorKey: 'vendor',
            header: 'Vendor',
            cell: ({ row }) => (
                <div className="whitespace-normal break-words min-w-[150px] max-w-[250px]">
                    {row.original.vendor}
                </div>
            ),
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ row }: { row: Row<HistoryData> }) => {
                const item = row.original;
                const isCellEditing = editingCell?.rowId === item.indentNumber && editingCell?.field === 'product';

                if (isCellEditing) {
                    const filteredItems = masterItems.filter(p =>
                        p.toLowerCase().includes(productSearch.toLowerCase())
                    );
                    return (
                        <div className="flex items-center gap-1">
                            <Select
                                value={editCellValue as string}
                                onValueChange={(value) => setEditCellValue(value)}
                            >
                                <SelectTrigger className="w-[180px] text-xs sm:text-sm">
                                    <SelectValue placeholder="Select Product" />
                                </SelectTrigger>
                                <SelectContent className="w-[300px] sm:w-[400px]">
                                    <div className="sticky top-0 z-10 bg-popover p-2 border-b">
                                        <div className="flex items-center bg-muted rounded-md px-3 py-1">
                                            <Search className="h-4 w-4 shrink-0 opacity-50" />
                                            <input
                                                placeholder="Search product..."
                                                value={productSearch}
                                                onChange={(e) => setProductSearch(e.target.value)}
                                                onKeyDown={(e) => e.stopPropagation()}
                                                className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground ml-2"
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto p-1">
                                        {filteredItems.map((p, i) => (
                                            <SelectItem key={i} value={p} className="cursor-pointer">
                                                {p}
                                            </SelectItem>
                                        ))}
                                    </div>
                                </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:bg-green-50" onClick={handleSaveCellEdit}>
                                <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 hover:bg-red-50" onClick={handleCancelCellEdit}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    );
                }

                return (
                    <div className="flex items-center gap-1 whitespace-normal break-words min-w-[200px] max-w-[300px]">
                        <span>{item.product}</span>
                        <button
                            className="ml-1 text-black hover:text-gray-700 shrink-0"
                            onClick={() => handleStartCellEdit(item.indentNumber, 'product', item.product)}
                        >
                            <SquarePen className="h-3.5 w-3.5" />
                        </button>
                    </div>
                );
            },
        },
        {
            accessorKey: 'orderQuantity',
            header: 'Order Quantity',
            cell: ({ row }: { row: Row<HistoryData> }) => {
                const item = row.original;
                const isCellEditing = editingCell?.rowId === item.indentNumber && editingCell?.field === 'orderQuantity';

                if (isCellEditing) {
                    return (
                        <div className="flex items-center gap-1">
                            <Input
                                type="number"
                                value={editCellValue}
                                onChange={(e) => setEditCellValue(Number(e.target.value) || 0)}
                                className="w-20 text-xs sm:text-sm"
                                min="0"
                            />
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:bg-green-50" onClick={handleSaveCellEdit}>
                                <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 hover:bg-red-50" onClick={handleCancelCellEdit}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    );
                }

                return (
                    <div className="flex items-center gap-1">
                        <span>{item.orderQuantity}</span>
                        <button
                            className="ml-1 text-black hover:text-gray-700 shrink-0"
                            onClick={() => handleStartCellEdit(item.indentNumber, 'orderQuantity', item.orderQuantity)}
                        >
                            <SquarePen className="h-3.5 w-3.5" />
                        </button>
                    </div>
                );
            },
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ row }: { row: Row<HistoryData> }) => {
                const item = row.original;
                const isCellEditing = editingCell?.rowId === item.indentNumber && editingCell?.field === 'uom';

                if (isCellEditing) {
                    return (
                        <div className="flex items-center gap-1">
                            <Input
                                value={editCellValue}
                                onChange={(e) => setEditCellValue(e.target.value)}
                                className="w-20 text-xs sm:text-sm"
                                placeholder="UOM"
                            />
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:bg-green-50" onClick={handleSaveCellEdit}>
                                <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 hover:bg-red-50" onClick={handleCancelCellEdit}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    );
                }

                return (
                    <div className="flex items-center gap-1">
                        <span>{item.uom}</span>
                        <button
                            className="ml-1 text-black hover:text-gray-700 shrink-0"
                            onClick={() => handleStartCellEdit(item.indentNumber, 'uom', item.uom)}
                        >
                            <SquarePen className="h-3.5 w-3.5" />
                        </button>
                    </div>
                );
            },
        },
        { accessorKey: 'receivedDate', header: 'Received Date' },
        {
            accessorKey: 'receivedQuantity',
            header: 'Received Qty',
            cell: ({ row }: { row: Row<HistoryData> }) => {
                const item = row.original;
                const isCellEditing = editingCell?.recordId === item.id && editingCell?.field === 'receivedQuantity';

                if (isCellEditing) {
                    return (
                        <div className="flex items-center gap-1">
                            <Input
                                type="number"
                                value={editCellValue}
                                onChange={(e) => setEditCellValue(Number(e.target.value) || 0)}
                                className="w-20 text-xs sm:text-sm"
                                min="0"
                            />
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:bg-green-50" onClick={handleSaveCellEdit}>
                                <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 hover:bg-red-50" onClick={handleCancelCellEdit}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    );
                }

                return (
                    <div className="flex items-center gap-1">
                        <span>{item.receivedQuantity}</span>
                        {item.id && (
                            <button
                                className="ml-1 text-black hover:text-gray-700 shrink-0"
                                onClick={() => handleStartCellEdit(item.indentNumber, 'receivedQuantity', item.receivedQuantity, item.id)}
                            >
                                <SquarePen className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                );
            },
        },
        { accessorKey: 'remainingQty', header: 'Remaining Qty' },
        {
            accessorKey: 'photoOfProduct',
            header: 'Photo of Product',
            cell: ({ row }) => {
                const photo = row.original.photoOfProduct;
                return photo ? (
                    <a href={photo} target="_blank">
                        Product
                    </a>
                ) : (
                    <></>
                );
            },
        },
        {
            accessorKey: 'warrantyStatus',
            header: 'Warranty Status',
            cell: ({ row }: { row: Row<HistoryData> }) => {
                const item = row.original;
                const isCellEditing = editingCell?.recordId === item.id && editingCell?.field === 'warrantyStatus';

                if (isCellEditing) {
                    return (
                        <div className="flex items-center gap-1">
                            <Input
                                value={editCellValue}
                                onChange={(e) => setEditCellValue(e.target.value)}
                                className="w-28 text-xs sm:text-sm"
                                placeholder="Warranty Status"
                            />
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:bg-green-50" onClick={handleSaveCellEdit}>
                                <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 hover:bg-red-50" onClick={handleCancelCellEdit}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    );
                }

                return (
                    <div className="flex items-center gap-1">
                        <span>{item.warrantyStatus}</span>
                        {item.id && (
                            <button
                                className="ml-1 text-black hover:text-gray-700 shrink-0"
                                onClick={() => handleStartCellEdit(item.indentNumber, 'warrantyStatus', item.warrantyStatus, item.id)}
                            >
                                <SquarePen className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                );
            },
        },
        { accessorKey: 'warrantyEndDate', header: 'Warranty End Date' },
        {
            accessorKey: 'billStatus',
            header: 'Bill Status',
            cell: ({ row }: { row: Row<HistoryData> }) => {
                const item = row.original;
                const isCellEditing = editingCell?.recordId === item.id && editingCell?.field === 'billStatus';

                if (isCellEditing) {
                    return (
                        <div className="flex items-center gap-1">
                            <Select
                                value={editCellValue as string}
                                onValueChange={(value) => setEditCellValue(value)}
                            >
                                <SelectTrigger className="w-[120px] text-xs sm:text-sm">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Received">Received</SelectItem>
                                    <SelectItem value="Not Received">Not Received</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:bg-green-50" onClick={handleSaveCellEdit}>
                                <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 hover:bg-red-50" onClick={handleCancelCellEdit}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    );
                }

                return (
                    <div className="flex items-center gap-1">
                        <span>{item.billStatus}</span>
                        {item.id && (
                            <button
                                className="ml-1 text-black hover:text-gray-700 shrink-0"
                                onClick={() => handleStartCellEdit(item.indentNumber, 'billStatus', item.billStatus, item.id)}
                            >
                                <SquarePen className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                );
            },
        },
        { accessorKey: 'billNumber', header: 'Bill Number' },
        {
            accessorKey: 'billAmount',
            header: 'Bill Amount',
            cell: ({ row }: { row: Row<HistoryData> }) => {
                const item = row.original;
                const isCellEditing = editingCell?.recordId === item.id && editingCell?.field === 'billAmount';

                if (isCellEditing) {
                    return (
                        <div className="flex items-center gap-1">
                            <Input
                                type="number"
                                value={editCellValue}
                                onChange={(e) => setEditCellValue(Number(e.target.value) || 0)}
                                className="w-20 text-xs sm:text-sm"
                                min="0"
                            />
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:bg-green-50" onClick={handleSaveCellEdit}>
                                <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 hover:bg-red-50" onClick={handleCancelCellEdit}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    );
                }

                return (
                    <div className="flex items-center gap-1">
                        <span>{item.billAmount}</span>
                        {item.id && (
                            <button
                                className="ml-1 text-black hover:text-gray-700 shrink-0"
                                onClick={() => handleStartCellEdit(item.indentNumber, 'billAmount', item.billAmount, item.id)}
                            >
                                <SquarePen className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'photoOfBill',
            header: 'Photo of Bill',
            cell: ({ row }) => {
                const photo = row.original.photoOfBill;
                return photo ? (
                    <a href={photo} target="_blank">
                        Bill
                    </a>
                ) : (
                    <></>
                );
            },
        },
        { accessorKey: 'anyTransport', header: 'Any Transport' },
        { accessorKey: 'transporterName', header: 'Transporter Name' },
        { accessorKey: 'transportingAmount', header: 'Transporting Amount' },
    ];

    // Updated Schema - status ko top level pe add kiya
    const schema = z
        .object({
            status: z.enum(['Received', 'Not Received']),
            items: z.array(
                z.object({
                    indentNumber: z.string(),
                    quantity: z.coerce.number().optional().default(0),
                })
            ),
            billReceived: z.enum(['Received', 'Not Received']).optional(),
            billAmount: z.coerce.number().optional(),
            photoOfBill: z.instanceof(File).optional(),
        })
        .superRefine((data, ctx) => {
            if (data.status === 'Received') {
                data.items.forEach((item, index) => {
                    if (item.quantity === undefined || item.quantity === 0) {
                        ctx.addIssue({
                            path: ['items', index, 'quantity'],
                            code: z.ZodIssueCode.custom,
                            message: 'Quantity required',
                        });
                    }
                });
            }

            if (data.billReceived === 'Received') {
                if (data.billAmount === undefined) {
                    ctx.addIssue({ path: ['billAmount'], code: z.ZodIssueCode.custom });
                }
            }
        });

    // Updated Form
    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            status: undefined,
            items: [],
            billAmount: undefined,
            photoOfBill: undefined,
            billReceived: undefined,
        },
    });

    const status = form.watch('status');
    const billReceived = form.watch('billReceived');

    // Updated useEffect for matching indents
    useEffect(() => {
        if (selectedIndent) {
            const matching = tableData.filter(
                (item) => item.poNumber === selectedIndent.poNumber
            );
            setMatchingIndents(matching);

            // Initialize items array in form with REMAINING quantity
            const initialItems = matching.map((indent) => ({
                indentNumber: indent.indentNumber,
                quantity: indent.remainingQty, // Default to remaining quantity
            }));
            form.setValue('items', initialItems);
        } else if (!openDialog) {
            setMatchingIndents([]);
            form.reset({
                status: undefined,
                items: [],
                billAmount: undefined,
                photoOfBill: undefined,
                billReceived: undefined,
            });
        }
    }, [selectedIndent, openDialog, tableData, form]);

    // Updated onSubmit
    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            // Validate quantities against remaining
            for (const item of values.items) {
                const originalItem = matchingIndents.find(i => i.indentNumber === item.indentNumber);
                if (originalItem && (item.quantity > (originalItem.remainingQty || 0))) {
                    toast.error(`Quantity for ${originalItem.product} cannot exceed remaining (${originalItem.remainingQty})`);
                    return;
                }
            }

            // Photo of bill upload
            let billPhotoUrl = '';
            if (values.photoOfBill !== undefined) {
                billPhotoUrl = await uploadFile(
                    values.photoOfBill,
                    'bill_photo', // Use Supabase bucket name
                    'supabase'    // Specify upload type
                );
            }

            // Insert received items into Supabase
            const receivedRows = values.items.map((item) => ({
                indent_number: item.indentNumber,
                po_date: selectedIndent?.poDate,
                po_number: selectedIndent?.poNumber,
                vendor: selectedIndent?.vendor,
                received_status: values.status,
                received_quantity: item.quantity,
                uom: matchingIndents.find(i => i.indentNumber === item.indentNumber)?.uom,
                bill_status: values.billReceived,
                bill_amount: values.billAmount,
                photo_of_bill: billPhotoUrl,
            }));

            const { error: receivedError } = await supabase
                .from('received')
                .insert(receivedRows);

            if (receivedError) {
                throw receivedError;
            }

            // Update each indent in Supabase
            for (const item of values.items) {
                // Calculate new total received to see if we should close the indent
                const currentIndent = tableData.find(d => d.indentNumber === item.indentNumber);
                const previousReceived = currentIndent?.receivedQty || 0;
                const newTotalReceived = previousReceived + item.quantity;
                const approvedQty = currentIndent?.quantity || 0;
                const remaining = Math.max(0, approvedQty - newTotalReceived);

                const updatePayload: any = {
                    receive_status: values.status
                };

                // Only set actual_5 (completion date) if fully received
                if (remaining === 0) {
                    updatePayload.actual_5 = formatDate(new Date());
                }

                const { error: updateError } = await supabase
                    .from('indent')
                    .update(updatePayload)
                    .eq('indent_number', item.indentNumber);

                if (updateError) {
                    throw updateError;
                }
            }

            toast.success(`Items received for PO ${selectedIndent?.poNumber}`);
            updateIndentSheet(); // Update context for sidebar
            updateReceivedSheet(); // Update context for history
            setOpenDialog(false);

            // Refresh the data after successful submission
            const fetchPendingItems = async () => {
                setLocalIndentLoading(true);

                // Fetch indents (Stage 4 passed means PO created)
                const { data: indentData, error: indentError } = await supabase
                    .from('indent')
                    .select(`
                        indent_number,
                        po_number,
                        uom,
                        po_copy,
                        approved_vendor_name,
                        approved_quantity,
                        actual_4,
                        product_name
                    `)
                    .not('actual_4', 'is', null); // PO Created

                if (indentError) {
                    console.error('Error fetching pending items from Supabase:', indentError);
                    toast.error('Failed to fetch pending items');
                    setLocalIndentLoading(false);
                    return;
                }

                // Fetch all received records to calculate totals
                const { data: receivedData, error: receivedError } = await supabase
                    .from('received')
                    .select('indent_number, received_quantity');

                if (receivedError) {
                    console.error('Error fetching received data:', receivedError);
                    setLocalIndentLoading(false);
                    return;
                }

                const mappedData = indentData.map((item: any) => {
                    const totalReceived = receivedData
                        .filter((r: any) => r.indent_number === item.indent_number)
                        .reduce((sum: number, r: any) => sum + (Number(r.received_quantity) || 0), 0);

                    const approvedQty = Number(item.approved_quantity) || 0;
                    const remainingQty = Math.max(0, approvedQty - totalReceived);

                    return {
                        indentNumber: item.indent_number,
                        poNumber: item.po_number,
                        uom: item.uom,
                        poCopy: item.po_copy,
                        vendor: item.approved_vendor_name,
                        quantity: approvedQty,
                        receivedQty: totalReceived,
                        remainingQty: remainingQty,
                        poDate: item.actual_4,
                        product: item.product_name,
                    };
                }).filter((item) => item.remainingQty > 0); // Only show items with remaining quantity

                setTableData(mappedData.reverse());
                setLocalIndentLoading(false);
            };

            fetchPendingItems();
        } catch (error) {
            console.error('Error submitting received items:', error);
            toast.error('Failed to receive items');
        }
    }

    function onError(e: FieldErrors<z.infer<typeof schema>>) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] overflow-hidden">
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending" className="flex flex-col h-full overflow-hidden">
                    <div className="shrink-0 mb-1">
                        <Heading
                            heading="Receive Items"
                            subtext="Receive items from purchase orders"
                            tabs
                        >
                            <Truck size={50} className="text-primary" />
                        </Heading>
                    </div>

                    <TabsContent value="pending" className="m-0 flex-1 flex flex-col overflow-hidden min-h-0">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['indentNumber', 'poNumber', 'product', 'vendor']}
                            dataLoading={localIndentLoading}
                            infiniteScroll={true}
                            onLoadMore={() => fetchPendingItems(false)}
                            hasMore={hasMorePending}
                            extraActions={
                                <Button
                                    variant="default"
                                    onClick={onDownloadClick}
                                    style={{
                                        background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "0 16px",
                                        fontWeight: "bold",
                                        boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                    }}
                                >
                                    <DownloadOutlined />
                                    {loading ? "Downloading..." : "Download"}
                                </Button>
                            }
                        />
                    </TabsContent>

                    <TabsContent value="history" className="m-0 flex-1 flex flex-col overflow-hidden min-h-0">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['indentNumber', 'poNumber', 'product', 'vendor']}
                            dataLoading={localReceivedLoading}
                            infiniteScroll={true}
                            onLoadMore={() => fetchHistoryItems(false)}
                            hasMore={hasMoreHistory}
                        />
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent className="w-full max-w-[95vw] sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-5"
                            >
                                <DialogHeader className="space-y-1">
                                    <DialogTitle>Receive Items</DialogTitle>
                                    <DialogDescription>
                                        Receive items for PO Number{' '}
                                        <span className="font-medium">
                                            {selectedIndent.poNumber}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>

                                {/* PO Number Display */}
                                <div className="bg-primary/10 p-3 sm:p-4 rounded-md">
                                    <p className="text-sm sm:text-base md:text-lg font-bold break-words">
                                        PO Number: {selectedIndent.poNumber}
                                    </p>
                                </div>

                                {/* Common Receive Status Field - TOP ME */}
                                <div className="border-b pb-4">
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Receiving Status (Common for all items)</FormLabel>
                                                <FormControl>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Set status" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Received">
                                                                Received
                                                            </SelectItem>
                                                            <SelectItem value="Not Received">
                                                                Not Received
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Common fields */}
                                <div className="space-y-4">
                                    <h3 className="text-sm sm:text-base font-semibold">Common Fields for All Items</h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                        <FormField
                                            control={form.control}
                                            name="billReceived"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Bill Received</FormLabel>
                                                    <FormControl>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Set bill received" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Received">
                                                                    Received
                                                                </SelectItem>
                                                                <SelectItem value="Not Received">
                                                                    Not Received
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="billAmount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Bill Amount</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            disabled={billReceived !== 'Received'}
                                                            placeholder="Enter bill amount"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="photoOfBill"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Photo of Bill</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="file"
                                                            disabled={billReceived !== 'Received'}
                                                            onChange={(e) =>
                                                                field.onChange(e.target.files?.[0])
                                                            }
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Table for matching indents - Responsive */}
                                <div className="border rounded-md mt-6">
                                    <h3 className="font-semibold p-3 bg-muted text-sm sm:text-base">Items in this PO</h3>

                                    {/* Desktop Table View */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <div className="w-full overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-muted">
                                                    <tr>
                                                        <th className="p-2 text-left text-sm font-medium">Indent Number</th>
                                                        <th className="p-2 text-left text-sm font-medium">Item Name</th>
                                                        <th className="p-2 text-left text-sm font-medium">Ordered Qty</th>
                                                        <th className="p-2 text-left text-sm font-medium">UOM</th>
                                                        <th className="p-2 text-left text-sm font-medium">Received Qty</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {matchingIndents.map((indent, index) => (
                                                        <tr key={indent.indentNumber} className="border-t">
                                                            <td className="p-2 text-sm">{indent.indentNumber}</td>
                                                            <td className="p-2 text-sm">{indent.product}</td>
                                                            <td className="p-2 text-sm">{indent.quantity}</td>
                                                            <td className="p-2 text-sm">{indent.uom}</td>
                                                            <td className="p-2">
                                                                <FormField
                                                                    control={form.control}
                                                                    name={`items.${index}.quantity`}
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormControl>
                                                                                <div className="flex flex-col">
                                                                                    <Input
                                                                                        type="number"
                                                                                        className="h-8"
                                                                                        placeholder="Qty"
                                                                                        max={indent.remainingQty}
                                                                                        disabled={status !== 'Received'}
                                                                                        {...field}
                                                                                    />
                                                                                    <span className="text-xs text-muted-foreground mt-1">
                                                                                        Max: {indent.remainingQty}
                                                                                    </span>
                                                                                </div>
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Mobile Card View */}
                                    <div className="md:hidden space-y-3 p-3">
                                        {matchingIndents.map((indent, index) => (
                                            <div key={indent.indentNumber} className="bg-muted/50 p-3 rounded-lg space-y-2">
                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Indent Number</p>
                                                        <p className="font-medium break-words">{indent.indentNumber}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">UOM</p>
                                                        <p className="font-medium">{indent.uom}</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Item Name</p>
                                                    <p className="font-medium text-sm break-words">{indent.product}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Ordered Qty</p>
                                                        <p className="font-medium">{indent.quantity}</p>
                                                    </div>
                                                    <div>
                                                        <FormField
                                                            control={form.control}
                                                            name={`items.${index}.quantity`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs text-muted-foreground">
                                                                        Received Qty
                                                                    </FormLabel>
                                                                    <FormControl>
                                                                        <div className="flex flex-col">
                                                                            <Input
                                                                                type="number"
                                                                                className="h-9"
                                                                                placeholder="Qty"
                                                                                max={indent.remainingQty}
                                                                                disabled={status !== 'Received'}
                                                                                {...field}
                                                                            />
                                                                            <span className="text-xs text-muted-foreground mt-1">
                                                                                Max: {indent.remainingQty}
                                                                            </span>
                                                                        </div>
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="secondary" type="button">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Loader size={20} color="#ffffff" className="mr-2" />
                                                Receiving...
                                            </>
                                        ) : (
                                            'Receive'
                                        )}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
};

export default ReceiveItems;
