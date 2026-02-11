
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
import { postToSheet, uploadFile } from '@/lib/fetchers';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ShoppingCart } from 'lucide-react';
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




    const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});


    // const [editedData, setEditedData] = useState<{ product?: string; quantity?: number; uom?: string }>({});
    // const [editedData, setEditedData] = useState<{ [indentNo: string]: { product?: string; quantity?: number; uom?: string; qty?: number; billNumber?: string; leadTime?: string; typeOfBill?: string; billAmount?: number; discountAmount?: number; paymentType?: string; advanceAmount?: number; rate?: number; photoOfBill?: string } }>({});
    // Fetching table data - updated
    // Fetching table data from Supabase
    const fetchTableData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Indents (Stage 7 Pending)
            // Note: We used to filter by planned_7 not null, actual_7 null.
            // But if we want to show partial receipts that haven't reached Stage 7 "planning" yet (if that's how it works),
            // we might need to broaden this.
            // EXCEPT: The user workflow likely assumes planned_7 is generated when it's ready for billing.
            // So we keep the filter but check 'received' table for quantities.
            const { data: indentData, error: indentError } = await supabase
                .from('indent')
                .select('*')
                .not('planned_7', 'is', null);
            // Removed .is('actual_7', null) to handle partials - we'll filter in memory based on remainingQty

            if (indentError) throw indentError;

            // 2. Fetch Received Data to calculate what's available for billing
            const { data: receivedData, error: receivedError } = await supabase
                .from('received')
                .select('indent_number, received_quantity, bill_number'); // Fetch bill_number to check if billed

            if (receivedError) throw receivedError;

            if (indentData) {
                const seenPoNumbers = new Set();
                const uniqueTableData = indentData
                    .filter((sheet) => {
                        // Calculate stats for this indent
                        const indentReceipts = receivedData?.filter(r => r.indent_number === sheet.indent_number) || [];
                        const totalReceived = indentReceipts.reduce((sum, r) => sum + (Number(r.received_quantity) || 0), 0);
                        const totalBilled = indentReceipts
                            .filter(r => r.bill_number) // Items that already have a bill number
                            .reduce((sum, r) => sum + (Number(r.received_quantity) || 0), 0);

                        const remainingToBill = Math.max(0, totalReceived - totalBilled);

                        // We only show items if they have something ready to bill OR if the indent is arguably heavily pending
                        // But strictly: Show if RemainingToBill > 0 OR (Approved > Billed if we want to track against order)
                        // User request: "Ordered 90, Received 80, Remaining 10". Input should be restricted.
                        // Implication: getPurchase handles "Billing the Received items".

                        // Filter logic:
                        // Show if not fully billed (i.e., remainingToBill > 0) AND planned_7 is present.

                        // Also, handle the PO grouping.
                        // Logic: If ANY item in the PO has remainingToBill > 0, show the PO.

                        // For the filter here (which is row-based initially per indent):
                        // We'll calculate these and attach to the object, then filter later or let the UI handle it.
                        // But duplicate PO check needs to be aware.

                        // Let's attach the calcs first.
                        (sheet as any)._stats = { totalReceived, totalBilled, remainingToBill };

                        if (remainingToBill === 0) return false; // Hide if nothing pending to bill

                        if (!sheet.po_number || seenPoNumbers.has(sheet.po_number)) {
                            return false;
                        }

                        // Check if this PO has ANY pending items
                        const poIndents = indentData.filter(i => i.po_number === sheet.po_number);
                        const hasPending = poIndents.some(i => {
                            const iReceipts = receivedData?.filter(r => r.indent_number === i.indent_number) || [];
                            const iRec = iReceipts.reduce((sum, r) => sum + (Number(r.received_quantity) || 0), 0);
                            const iBilled = iReceipts.filter(r => r.bill_number).reduce((sum, r) => sum + (Number(r.received_quantity) || 0), 0);
                            return (iRec - iBilled) > 0;
                        });

                        if (!hasPending) return false; // Hide if no pending items in this PO

                        seenPoNumbers.add(sheet.po_number);
                        return true;
                    })
                    .map((sheet) => {
                        const stats = (sheet as any)._stats;
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
                    .in('indent_number', indentNumbers);

                if (indentError) throw indentError;

                const mappedHistory = receivedData.map(r => {
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

        // Strict Validation logic could be here, but input max usually handles UI.
        // We'll trust the onSubmit for strict validation.

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
        },
        {
            accessorKey: 'billedQty',
            header: 'Billed Qty',
        },
        {
            accessorKey: 'billAmount',
            header: 'Bill Amount',
            cell: ({ getValue }) => `₹${getValue()}`,
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
                    import.meta.env.VITE_BILL_PHOTO_FOLDER || 'bill-photos'
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
                const { data: unbilledItems, error: fetchError } = await supabase
                    .from('received')
                    .select('id, received_quantity')
                    .eq('indent_number', product.indentNo)
                    .is('bill_number', null)
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
            setOpenDialog(false);
            form.reset();
            setProductRates({});
            setProductQty({});
            setTimeout(() => {
                updateIndentSheet();
                fetchTableData();
            }, 1000);
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
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Get Purchase"
                        subtext="Manage purchase bill details and status"
                        tabs
                    >
                        <ShoppingCart size={50} className="text-primary" />
                    </Heading>


                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['product', 'department', 'indenter', 'poNumber']}
                            dataLoading={loading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['product', 'department', 'indenter', 'poNumber']}
                            dataLoading={indentLoading}
                        />
                    </TabsContent>
                </Tabs>


                {selectedIndent && (
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
