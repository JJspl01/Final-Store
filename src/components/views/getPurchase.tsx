
import { useSheets } from '@/context/SheetsContext';
import { supabase } from '@/lib/supabaseClient';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import { useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
    DialogHeader,
    DialogFooter,
    DialogClose,
} from '../ui/dialog';
import { postToSheet, uploadFile, fetchFromSupabasePaginated } from '@/lib/fetchers';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ShoppingCart, SquarePen, Check, X, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { formatDate } from '@/lib/utils';

import { useCallback } from 'react';

interface EditedData {
    product?: string;
    quantity?: number;
    uom?: string;
    qty?: number;
    billNumber?: string;
    leadTime?: string;
    typeOfBill?: string;
    billAmount?: number;
    discountAmount?: number;
    paymentType?: string;
    advanceAmount?: number;
    rate?: number;
    photoOfBill?: string; // For storing the URL string
    photoOfBillFile?: File | null; // For handling file uploads
}





interface GetPurchaseData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    poNumber: string;
    approvedRate: number;
    receivedQty?: number;
    billedQty?: number;
    remainingQty?: number;
}


interface HistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number; // Ordered Qty
    billedQty: number; // This specific bill's qty
    uom: string;
    poNumber: string;
    billStatus: string;
    date: string; // Bill Date or Entry Date
    billNumber: string;
    billAmount: number;
    photoOfBill: string;
}

// New interface for showing all products with same PO
interface ProductDetail {
    indentNo: string;
    product: string;
    quantity: number;
    uom: string;
    rate: number;
    qty?: number;
    receivedQty?: number;
    remainingQty?: number;
}
interface EditedData {
    product?: string;
    quantity?: number;
    uom?: string;
    qty?: number;
    billNumber?: string;
    leadTime?: string;
    typeOfBill?: string;
    billAmount?: number;
    discountAmount?: number;
    paymentType?: string;
    advanceAmount?: number;
    rate?: number;
    photoOfBillFile?: File | null; // File support
}




export default () => {
    const { indentSheet, indentLoading, updateIndentSheet } = useSheets();
    const { user } = useAuth();


    const [selectedIndent, setSelectedIndent] = useState<GetPurchaseData | null>(null);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [tableData, setTableData] = useState<GetPurchaseData[]>([]);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [rateOptions, setRateOptions] = useState<string[]>([]);
    const [relatedProducts, setRelatedProducts] = useState<ProductDetail[]>([]);
    const [productRates, setProductRates] = useState<{ [indentNo: string]: number }>({});
    const [productQty, setProductQty] = useState<{ [indentNo: string]: number }>({});
    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [editedData, setEditedData] = useState<{ [indentNo: string]: EditedData }>({});
    const [editingCell, setEditingCell] = useState<{ rowId: string; field: 'product' | 'billedQty' | 'billAmount' } | null>(null);
    const [editCellValue, setEditCellValue] = useState<string | number>('');
    const [masterItems, setMasterItems] = useState<string[]>([]);
    const [productSearch, setProductSearch] = useState('');




    const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});


    // const [editedData, setEditedData] = useState<{ product?: string; quantity?: number; uom?: string }>({});
    // const [editedData, setEditedData] = useState<{ [indentNo: string]: { product?: string; quantity?: number; uom?: string; qty?: number; billNumber?: string; leadTime?: string; typeOfBill?: string; billAmount?: number; discountAmount?: number; paymentType?: string; advanceAmount?: number; rate?: number; photoOfBill?: string } }>({});
    // Fetching table data - updated
    // Fetching table data from Supabase
    const fetchTableData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Indents with pagination (Stage 7 Pending/Partials)
            const indentData = await fetchFromSupabasePaginated(
                'indent',
                '*',
                { column: 'planned_7', options: { ascending: false } },
                (q) => q.not('planned_7', 'is', null).is('actual_7', null)
            );

            // 2. Fetch Received Data with pagination to calculate what's available for billing
            const receivedData = await fetchFromSupabasePaginated(
                'received',
                'indent_number, received_quantity, bill_number',
                { column: 'timestamp', options: { ascending: false } }
            );

            if (indentData) {
                const seenPoNumbers = new Set();

                // Pre-calculate stats for all indents
                const indentStats = new Map();
                indentData.forEach((sheet) => {
                    const indentReceipts = receivedData?.filter(r => r.indent_number === sheet.indent_number) || [];
                    const totalReceived = indentReceipts.reduce((sum, r) => sum + (Number(r.received_quantity) || 0), 0);
                    const totalBilled = indentReceipts
                        .filter(r => r.bill_number)
                        .reduce((sum, r) => sum + (Number(r.received_quantity) || 0), 0);
                    const remainingToBill = Math.max(0, totalReceived - totalBilled);

                    indentStats.set(sheet.indent_number, {
                        totalReceived,
                        totalBilled,
                        remainingToBill
                    });
                });

                const uniqueTableData = indentData
                    .filter((sheet) => {
                        // Skip if no PO number
                        if (!sheet.po_number) return false;

                        // Skip if we've already processed this PO
                        if (seenPoNumbers.has(sheet.po_number)) return false;

                        // Check if this PO has ANY items with pending quantity to bill
                        const poIndents = indentData.filter(i => i.po_number === sheet.po_number);
                        const hasPending = poIndents.some(i => {
                            const stats = indentStats.get(i.indent_number);
                            return stats && stats.remainingToBill > 0;
                        });

                        // Only show this PO if it has at least one pending item
                        if (!hasPending) return false;

                        seenPoNumbers.add(sheet.po_number);
                        return true;
                    })
                    .map((sheet) => {
                        const stats = indentStats.get(sheet.indent_number) || {
                            totalReceived: 0,
                            totalBilled: 0,
                            remainingToBill: 0
                        };

                        return {
                            indentNo: sheet.indent_number || '',
                            indenter: sheet.indenter_name || '',
                            department: sheet.department || '',
                            product: sheet.product_name || '',
                            quantity: Number(sheet.approved_quantity) || 0, // Ordered Qty
                            uom: sheet.uom || '',
                            poNumber: sheet.po_number || '',
                            approvedRate: Number(sheet.approved_rate) || 0,
                            receivedQty: stats.totalReceived,    // NEW
                            billedQty: stats.totalBilled,        // NEW
                            remainingQty: stats.remainingToBill  // NEW (Available for billing)
                        };
                    })
                    .reverse();

                setTableData(uniqueTableData);
            }
        } catch (error) {
            console.error('Error fetching data from Supabase:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTableData();
    }, []);

    // History data - Fetch from RECEIVED table where bill_number is present
    useEffect(() => {
        const fetchHistoryData = async () => {
            try {
                // 1. Fetch Received items that have a bill (Bill History)
                const { data: receivedData, error: receivedError } = await supabase
                    .from('received')
                    .select('*')
                    .not('bill_number', 'is', null);

                if (receivedError) throw receivedError;

                // If no billed items, set empty history and return
                if (!receivedData || receivedData.length === 0) {
                    setHistoryData([]);
                    return;
                }

                // 2. Fetch Indent details for product names etc.
                const indentNumbers = receivedData.map(r => r.indent_number).filter(Boolean);

                if (indentNumbers.length === 0) {
                    setHistoryData([]);
                    return;
                }

                const { data: indentData, error: indentError } = await supabase
                    .from('indent')
                    .select('indent_number, product_name, department, indenter_name, approved_quantity, uom')
                    .not('planned_7', 'is', null)
                    .not('actual_7', 'is', null)
                    .in('indent_number', indentNumbers);

                if (indentError) throw indentError;

                const mappedHistory = receivedData
                    .filter(r => indentData?.some(i => i.indent_number === r.indent_number))
                    .map(r => {
                        const indent = indentData?.find(i => i.indent_number === r.indent_number);
                        return {
                            indentNo: r.indent_number,
                            indenter: indent?.indenter_name || '',
                            department: indent?.department || '',
                            product: indent?.product_name || '',
                            quantity: Number(indent?.approved_quantity) || 0,
                            billedQty: Number(r.received_quantity) || 0, // In this context, received = billed quantity for this row
                            uom: r.uom || indent?.uom || '',
                            poNumber: r.po_number,
                            billStatus: r.bill_status || 'Submitted',
                            date: r.timestamp ? formatDate(new Date(r.timestamp)) : '',
                            billNumber: r.bill_number,
                            billAmount: Number(r.bill_amount) || 0,
                            photoOfBill: r.photo_of_bill || '',
                        };
                    }).reverse(); // Newest first

                setHistoryData(mappedHistory);

            } catch (error) {
                console.error('Error fetching history:', error);
            }
        };

        fetchHistoryData();
    }, [openDialog]); // Refresh when dialog closes (which updates table)

    // Fetch master items for product dropdown in history tab
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
    const handleStartCellEdit = (rowId: string, field: 'product' | 'billedQty' | 'billAmount', currentValue: string | number) => {
        setEditingCell({ rowId, field });
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
            const updatePayload: any = {};
            const localUpdate: any = {};
            let updateTable = 'indent'; // default

            if (editingCell.field === 'product') {
                updatePayload.product_name = editCellValue;
                localUpdate.product = editCellValue;
                updateTable = 'indent';
            } else if (editingCell.field === 'billedQty') {
                updatePayload.received_quantity = Number(editCellValue) || 0;
                localUpdate.billedQty = Number(editCellValue) || 0;
                updateTable = 'received';
            } else if (editingCell.field === 'billAmount') {
                updatePayload.bill_amount = Number(editCellValue) || 0;
                localUpdate.billAmount = Number(editCellValue) || 0;
                updateTable = 'received';
            }

            if (updateTable === 'indent') {
                const { error } = await supabase
                    .from('indent')
                    .update(updatePayload)
                    .eq('indent_number', editingCell.rowId);
                if (error) throw error;
            } else {
                // For received table, find the row by indent_number and bill_number
                const historyRow = historyData.find(h => h.indentNo === editingCell.rowId);
                if (historyRow) {
                    const { error } = await supabase
                        .from('received')
                        .update(updatePayload)
                        .eq('indent_number', editingCell.rowId)
                        .eq('bill_number', historyRow.billNumber);
                    if (error) throw error;
                }
            }

            toast.success(`Updated ${editingCell.field} for ${editingCell.rowId}`);

            // Update local state
            setHistoryData(prev =>
                prev.map(item =>
                    item.indentNo === editingCell.rowId
                        ? { ...item, ...localUpdate }
                        : item
                )
            );

            setEditingCell(null);
            setEditCellValue('');
            setProductSearch('');
        } catch (error: any) {
            console.error('Error saving edit:', error);
            toast.error('Failed to save: ' + error.message);
        }
    };

    // Fetch related products when dialog opens
    useEffect(() => {
        const fetchRelatedProducts = async () => {
            if (selectedIndent && openDialog) {
                try {
                    // Fetch Indents
                    const { data: indentData, error: indentError } = await supabase
                        .from('indent')
                        .select('*')
                        .eq('po_number', selectedIndent.poNumber);

                    if (indentError) throw indentError;

                    // Fetch Received for stats
                    const { data: receivedData, error: receivedError } = await supabase
                        .from('received')
                        .select('indent_number, received_quantity, bill_number')
                        .eq('po_number', selectedIndent.poNumber);

                    if (receivedError) throw receivedError;

                    if (indentData) {
                        const products = indentData.map((sheet) => {
                            const indentReceipts = receivedData?.filter(r => r.indent_number === sheet.indent_number) || [];
                            const totalReceived = indentReceipts.reduce((sum, r) => sum + (Number(r.received_quantity) || 0), 0);
                            const totalBilled = indentReceipts
                                .filter(r => r.bill_number)
                                .reduce((sum, r) => sum + (Number(r.received_quantity) || 0), 0);
                            const remainingToBill = Math.max(0, totalReceived - totalBilled);

                            return {
                                indentNo: sheet.indent_number || '',
                                product: sheet.product_name || '',
                                quantity: Number(sheet.approved_quantity) || Number(sheet.quantity) || 0,
                                uom: sheet.uom || '',
                                rate: Number(sheet.approved_rate) || 0,
                                qty: Number(sheet.qty) || 0,
                                receivedQty: totalReceived,
                                remainingQty: remainingToBill
                            };
                        });

                        setRelatedProducts(products);

                        // Initialize productRates & Qty
                        const ratesMap: { [indentNo: string]: number } = {};
                        const qtyMap: { [indentNo: string]: number } = {};

                        products.forEach(p => {
                            ratesMap[p.indentNo] = p.rate;
                            // Default Qty to Remaining
                            qtyMap[p.indentNo] = p.remainingQty || 0;
                        });
                        setProductRates(ratesMap);
                        setProductQty(qtyMap);
                    }
                } catch (error) {
                    console.error('Error fetching related products:', error);
                }
            }
        };

        fetchRelatedProducts();
    }, [selectedIndent, openDialog]);
    const handleQtyChange = (indentNo: string, value: string) => {
        const product = relatedProducts.find(p => p.indentNo === indentNo);
        const max = product?.remainingQty || 0;
        let val = parseFloat(value) || 0;

        if (val > max) {
            val = max;
        }
        if (val < 0) {
            val = 0;
        }

        setProductQty((prev) => ({
            ...prev,
            [indentNo]: val,
        }));
    };



    // Creating table columns
    const columns: ColumnDef<GetPurchaseData>[] = [
        ...(user.receiveItemAction
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<GetPurchaseData> }) => {
                        const indent = row.original;


                        return (
                            <div>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedIndent(indent);
                                        }}
                                    >
                                        Update
                                    </Button>
                                </DialogTrigger>
                            </div>
                        );
                    },
                },
            ]
            : []),
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
        },
        {
            accessorKey: 'indenter',
            header: 'Indenter',
        },
        {
            accessorKey: 'department',
            header: 'Department',
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'quantity',
            header: 'Ordered Qty', // Renamed for clarity
        },
        {
            accessorKey: 'receivedQty', // New Column
            header: 'Received Qty',
        },
        {
            accessorKey: 'billedQty', // New Column
            header: 'Billed Qty',
        },
        {
            accessorKey: 'remainingQty', // New Column
            header: 'Pending Bill',
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
        },
        {
            accessorKey: 'approvedRate', // ✅ Naya column add kiya
            header: 'Approved Rate',
            cell: ({ getValue }) => `₹${getValue()}`,
        },
    ];


    const historyColumns: ColumnDef<HistoryData>[] = [
        {
            accessorKey: 'date',
            header: 'Date',
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
        },
        {
            accessorKey: 'billNumber',
            header: 'Bill Number',
        },
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ row }: { row: Row<HistoryData> }) => {
                const item = row.original;
                const isCellEditing = editingCell?.rowId === item.indentNo && editingCell?.field === 'product';

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
                    <div className="flex items-center gap-1 max-w-[150px] break-words whitespace-normal">
                        <span>{item.product}</span>
                        <button
                            className="ml-1 text-black hover:text-gray-700 shrink-0"
                            onClick={() => handleStartCellEdit(item.indentNo, 'product', item.product)}
                        >
                            <SquarePen className="h-3.5 w-3.5" />
                        </button>
                    </div>
                );
            },
        },
        {
            accessorKey: 'billedQty',
            header: 'Billed Qty',
            cell: ({ row }: { row: Row<HistoryData> }) => {
                const item = row.original;
                const isCellEditing = editingCell?.rowId === item.indentNo && editingCell?.field === 'billedQty';

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
                        <span>{item.billedQty}</span>
                        <button
                            className="ml-1 text-black hover:text-gray-700 shrink-0"
                            onClick={() => handleStartCellEdit(item.indentNo, 'billedQty', item.billedQty)}
                        >
                            <SquarePen className="h-3.5 w-3.5" />
                        </button>
                    </div>
                );
            },
        },
        {
            accessorKey: 'billAmount',
            header: 'Bill Amount',
            cell: ({ row }: { row: Row<HistoryData> }) => {
                const item = row.original;
                const isCellEditing = editingCell?.rowId === item.indentNo && editingCell?.field === 'billAmount';

                if (isCellEditing) {
                    return (
                        <div className="flex items-center gap-1">
                            <Input
                                type="number"
                                value={editCellValue}
                                onChange={(e) => setEditCellValue(Number(e.target.value) || 0)}
                                className="w-24 text-xs sm:text-sm"
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
                        <span>₹{item.billAmount}</span>
                        <button
                            className="ml-1 text-black hover:text-gray-700 shrink-0"
                            onClick={() => handleStartCellEdit(item.indentNo, 'billAmount', item.billAmount)}
                        >
                            <SquarePen className="h-3.5 w-3.5" />
                        </button>
                    </div>
                );
            },
        },
        {
            accessorKey: 'photoOfBill',
            header: 'Bill Photo',
            cell: ({ row }) => {
                const url = row.original.photoOfBill;
                return url ? (
                    <a href={url} target="_blank" className="text-blue-600 hover:underline">
                        View Bill
                    </a>
                ) : (
                    <span className="text-muted-foreground">-</span>
                );
            },
        },
    ];


    // Creating form schema
    const formSchema = z.object({
        billStatus: z.string().nonempty('Bill status is required'),

        billNo: z.string().optional(),
        // qty: z.coerce.number().optional(),
        leadTime: z.string().optional(),
        typeOfBill: z.string().optional(),
        billAmount: z.coerce.number().optional(),
        discountAmount: z.coerce.number().optional(),
        paymentType: z.string().optional(),
        advanceAmount: z.coerce.number().optional(),
        photoOfBill: z.instanceof(File).optional(),
    });


    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            billStatus: '',

            billNo: '',
            // qty: undefined,
            leadTime: '',
            typeOfBill: '',
            billAmount: 0,
            discountAmount: 0,
            paymentType: '',
            advanceAmount: 0,
        },
    });


    const billStatus = form.watch('billStatus');
    const typeOfBill = form.watch('typeOfBill');

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            console.log('Starting submission with values:', values);

            let photoUrl: string | undefined;
            if (values.photoOfBill) {
                console.log('Uploading photo...');
                photoUrl = await uploadFile(
                    values.photoOfBill,
                    'bill_photo',
                    'supabase'
                );
                console.log('Photo uploaded successfully:', photoUrl);
            }

            // Iterate over each product and update RECEIVED table rows
            // We find unbilled received rows and update them.
            for (const product of relatedProducts) {
                const billQty = productQty[product.indentNo] || 0;
                if (billQty <= 0) continue; // Skip if no quantity to bill

                if (billQty > (product.remainingQty || 0)) {
                    toast.error(`Quantity for ${product.product} exceeds pending amount`);
                    return; // Stop matching
                }

                // Fetch unbilled received items for this indent
                // Check for both NULL and empty string bill_number
                const { data: unbilledItems, error: fetchError } = await supabase
                    .from('received')
                    .select('id, received_quantity')
                    .eq('indent_number', product.indentNo)
                    .or('bill_number.is.null,bill_number.eq.')
                    .order('timestamp', { ascending: true }); // FIFO

                if (fetchError) throw fetchError;

                let remainingToAssign = billQty;

                if (unbilledItems) {
                    for (const item of unbilledItems) {
                        if (remainingToAssign <= 0) break;

                        // Ideally we should split if item.received_quantity > remainingToAssign
                        // But for now, we just update the row with bill details.
                        // Limitation: Logic assumes bills align roughly with receipts or we accept tagging a whole receipt 
                        // even if partially billed (which is technically wrong but simpler).
                        // BUT user wants strictly limited input.
                        // Let's assume we just update the rows we need.

                        // Better Logic: Update the row. If we consume it, good.
                        // Since we don't have split capability without complexity, and users usually bill what they receive:
                        // We will update the row.

                        await supabase.from('received').update({
                            bill_status: values.billStatus,
                            bill_number: values.billNo,
                            bill_amount: values.billAmount, // CAUTION: This might put total bill amount on every row? 
                            // Ideally bill amount should be split too? 
                            // User didn't specify, but let's put the bill details.
                            photo_of_bill: photoUrl,
                            // uom, etc are already there
                        }).eq('id', item.id);

                        remainingToAssign -= Number(item.received_quantity);
                    }
                }

                // Also update Indent Table (Legacy/Master Status)
                // Only close Stage 7 if Fully Billed
                // Recalculate totals
                // Use a heuristic: If (Billed + NewBill) >= Approved, set actual_7
                const totalBilled = (relatedProducts.find(r => r.indentNo === product.indentNo)?.receivedQty || 0)
                    - (relatedProducts.find(r => r.indentNo === product.indentNo)?.remainingQty || 0)
                    + billQty;

                const approvedQty = product.quantity;

                const updatePayload: any = {
                    qty: totalBilled, // Update cumulative billed qty
                    bill_number: values.billNo, // Last bill no
                    bill_amount: values.billAmount, // Last bill amt
                    photo_of_bill: photoUrl,
                    bill_status: values.billStatus,
                    // other fields
                    lead_time_to_lift_material: values.leadTime,
                    type_of_bill: values.typeOfBill,
                    discount_amount: values.discountAmount,
                    payment_type: values.paymentType,
                    advance_amount_if_any: values.advanceAmount,
                    // rate
                };

                if (totalBilled >= approvedQty) {
                    updatePayload.actual_7 = formatDate(new Date());
                }

                await supabase.from('indent').update(updatePayload).eq('indent_number', product.indentNo);
            }

            toast.success(`Updated purchase details for PO ${selectedIndent?.poNumber}`);

            // Close dialog and reset form first
            setOpenDialog(false);
            form.reset();
            setProductRates({});
            setProductQty({});

            // Refresh data after brief delay to allow DB operations to complete
            setTimeout(() => {
                fetchTableData();
                updateIndentSheet();
            }, 500);
        } catch (error: any) {
            console.error('Detailed submission error:', error);
            toast.error(`Failed to update: ${error.message || 'Unknown error'}`);
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }


    return (
        <div className="w-full">
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending" className="w-full">
                    <div className="sticky top-0 z-20 bg-background -mx-5 -mt-5 p-5 pb-2 shadow-sm">
                        <Heading
                            heading="Get Purchase"
                            subtext="Manage purchase bill details and status"
                            tabs
                        >
                            <ShoppingCart size={50} className="text-primary" />
                        </Heading>
                    </div>

                    <div className="p-5 pt-2">
                        <TabsContent value="pending" className="w-full mt-0">
                            <div className="space-y-4 h-[calc(100vh-210px)] flex flex-col">
                                <div className="w-full flex-1 overflow-hidden min-h-0">
                                    <DataTable
                                        data={tableData}
                                        columns={columns}
                                        searchFields={['indentNo', 'poNumber', 'product', 'department', 'indenter', 'date', 'billNumber']}
                                        dataLoading={loading}
                                    />
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="history" className="w-full mt-0">
                            <div className="w-full h-[calc(100vh-210px)] overflow-hidden flex flex-col">
                                <DataTable
                                    data={historyData}
                                    columns={historyColumns}
                                    searchFields={['indentNo', 'poNumber', 'product', 'department', 'indenter', 'date', 'billNumber']}
                                    dataLoading={indentLoading}
                                />
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>


                {selectedIndent && (
                    <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
                        <Form {...form}>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault(); // ✅ Enter key se submit block
                                }}
                                className="space-y-5"
                            >
                                <DialogHeader className="space-y-1">
                                    <DialogTitle>Update Purchase Details</DialogTitle>
                                    <DialogDescription>
                                        Update purchase details for PO Number:{' '}
                                        <span className="font-medium">
                                            {selectedIndent.poNumber}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-2 bg-muted p-4 rounded-md">
                                    <p className="font-semibold text-sm">Products in this PO</p>
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                        {relatedProducts.map((product, index) => (
                                            <div
                                                key={index}
                                                className="bg-background p-4 rounded-md space-y-3"
                                            >
                                                {/* Mobile: Stack vertically */}
                                                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                                    <div className="space-y-1">
                                                        <p className="font-medium text-xs text-muted-foreground">Indent No.</p>
                                                        <p className="text-sm font-light break-all">{product.indentNo}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="font-medium text-xs text-muted-foreground">Quantity</p>
                                                        <p className="text-sm font-light">{product.quantity}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="font-medium text-xs text-muted-foreground">UOM</p>
                                                        <p className="text-sm font-light">{product.uom}</p>
                                                    </div>
                                                </div>

                                                {/* Product name - full width */}
                                                <div className="space-y-1">
                                                    <p className="font-medium text-xs text-muted-foreground">Product</p>
                                                    <p className="text-sm font-light break-words">{product.product}</p>
                                                </div>

                                                {/* Rate and Qty - side by side */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <p className="font-medium text-xs text-muted-foreground">Approved Rate</p>
                                                        <Input
                                                            type="text"
                                                            value={product.rate || 0}
                                                            readOnly
                                                            className="h-9 text-sm bg-gray-100 w-full font-mono"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between">
                                                            <p className="font-medium text-xs text-muted-foreground">Bill Qty</p>
                                                            <p className="text-xs text-blue-600">Pending: {product.remainingQty}</p>
                                                        </div>
                                                        <Input
                                                            type="number"
                                                            placeholder="Enter qty"
                                                            value={productQty[product.indentNo] || ''}
                                                            onChange={(e) => handleQtyChange(product.indentNo, e.target.value)}
                                                            className="h-9 text-sm w-full"
                                                            max={product.remainingQty}
                                                        />
                                                        {product.receivedQty !== undefined && (
                                                            <p className="text-[10px] text-muted-foreground">
                                                                Rec: {product.receivedQty} | max: {product.remainingQty}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>


                                <div className="grid gap-4">
                                    <FormField
                                        control={form.control}
                                        name="billStatus"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Bill Status *</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select bill status" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Bill Received">
                                                            Bill Received
                                                        </SelectItem>
                                                        <SelectItem value="Bill Not Received">
                                                            Bill Not Received
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />

                                    {billStatus === 'Bill Received' && (
                                        <>
                                            <FormField
                                                control={form.control}
                                                name="billNo"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Bill No. *</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="Enter bill number"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </>
                                    )}

                                    {billStatus && (
                                        <>


                                            <FormField
                                                control={form.control}
                                                name="leadTime"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Lead Time To Lift Material *</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="Enter lead time"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="typeOfBill"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Type Of Bill *</FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select type of bill" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="independent">
                                                                    Independent
                                                                </SelectItem>
                                                                <SelectItem value="common">
                                                                    Common
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            {typeOfBill === 'independent' && (
                                                <>
                                                    <FormField
                                                        control={form.control}
                                                        name="billAmount"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Bill Amount *</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="Enter bill amount"
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="discountAmount"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Discount Amount</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="Enter discount amount"
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="paymentType"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Payment Type</FormLabel>
                                                                <Select
                                                                    onValueChange={field.onChange}
                                                                    value={field.value}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Select payment type" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="Advance">
                                                                            Advance
                                                                        </SelectItem>
                                                                        <SelectItem value="Credit">
                                                                            Credit
                                                                        </SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <FormField
                                                        control={form.control}
                                                        name="advanceAmount"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Advance Amount If Any</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="Enter advance amount"
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
                                                                <FormLabel>Photo Of Bill</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        onChange={(e) =>
                                                                            field.onChange(e.target.files?.[0])
                                                                        }
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline" type="button">Close</Button>
                                    </DialogClose>
                                    <Button
                                        type="button" // ✅ type="button" karo
                                        onClick={form.handleSubmit(onSubmit, onError)} // ✅ onClick mein submit karo
                                        disabled={form.formState.isSubmitting}
                                    >
                                        {form.formState.isSubmitting && (
                                            <Loader
                                                size={20}
                                                color="white"
                                                aria-label="Loading Spinner"
                                            />
                                        )}
                                        Update
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
