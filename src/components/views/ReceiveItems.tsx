
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DownloadOutlined } from "@ant-design/icons";
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabaseClient';
import { uploadFile } from '@/lib/fetchers';
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
import { Truck } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate } from '@/lib/utils';
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

    const [tableData, setTableData] = useState<RecieveItemsData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [selectedIndent, setSelectedIndent] = useState<RecieveItemsData | null>(null);
    const [matchingIndents, setMatchingIndents] = useState<RecieveItemsData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
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
    }, []);

    useEffect(() => {
        const fetchHistoryItems = async () => {
            setLocalReceivedLoading(true);

            // Fetch indents
            const { data: indentData, error: indentError } = await supabase
                .from('indent')
                .select(`
                    indent_number,
                    po_number,
                    actual_4,
                    approved_vendor_name,
                    product_name,
                    approved_quantity,
                    uom,
                    planned_5,
                    actual_5
                `)
                .not('actual_4', 'is', null);

            if (indentError) {
                console.error('Error fetching indent history from Supabase:', indentError);
                toast.error('Failed to fetch history items');
                setLocalReceivedLoading(false);
                return;
            }

            // Fetch received items
            const { data: receivedData, error: receivedError } = await supabase
                .from('received')
                .select('*');

            if (receivedError) {
                console.error('Error fetching received items from Supabase:', receivedError);
                toast.error('Failed to fetch received items');
                setLocalReceivedLoading(false);
                return;
            }

            // Map the combined data
            const mappedData = receivedData.map((receivedRecord: any) => {
                const indent = indentData.find(i => i.indent_number === receivedRecord.indent_number);

                // Calculate totals for this indent to show context
                const totalReceivedForIndent = receivedData
                    .filter((r: any) => r.indent_number === receivedRecord.indent_number)
                    .reduce((sum: number, r: any) => sum + (Number(r.received_quantity) || 0), 0);

                const approvedQty = indent ? (Number(indent.approved_quantity) || 0) : 0;
                const remainingQty = Math.max(0, approvedQty - totalReceivedForIndent);

                return {
                    receiveStatus: receivedRecord.received_status || 'Unknown',
                    poNumber: receivedRecord.po_number || indent?.po_number,
                    poDate: receivedRecord.po_date ? formatDate(new Date(receivedRecord.po_date)) : (indent ? formatDate(new Date(indent.actual_4)) : ''),
                    vendor: receivedRecord.vendor || indent?.approved_vendor_name,
                    product: indent?.product_name || '',
                    orderQuantity: approvedQty,
                    receivedQuantity: Number(receivedRecord.received_quantity) || 0,
                    totalReceivedQty: totalReceivedForIndent,
                    remainingQty: remainingQty,
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

            setHistoryData(mappedData.reverse());
            setLocalReceivedLoading(false);
        };

        fetchHistoryItems();
    }, []);

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
        { accessorKey: 'vendor', header: 'Vendor' },
        { accessorKey: 'indentNumber', header: 'Indent No.' },
        { accessorKey: 'product', header: 'Product' },
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
        { accessorKey: 'vendor', header: 'Vendor' },
        { accessorKey: 'product', header: 'Product' },
        { accessorKey: 'orderQuantity', header: 'Order Quantity' },
        { accessorKey: 'uom', header: 'UOM' },
        { accessorKey: 'receivedDate', header: 'Received Date' },
        { accessorKey: 'receivedQuantity', header: 'Received Qty' },
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
        { accessorKey: 'warrantyStatus', header: 'Warranty Status' },
        { accessorKey: 'warrantyEndDate', header: 'Warranty End Date' },
        { accessorKey: 'billStatus', header: 'Bill Status' },
        { accessorKey: 'billNumber', header: 'Bill Number' },
        { accessorKey: 'billAmount', header: 'Bill Amount' },
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
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Receive Items"
                        subtext="Receive items from purchase orders"
                        tabs
                    >
                        <Truck size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['product', 'department', 'indenter', 'vendorType']}
                            dataLoading={localIndentLoading}
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

                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={[
                                'receiveStatus',
                                'poNumber',
                                'indentNumber',
                                'poDate',
                                'product',
                            ]}
                            dataLoading={localReceivedLoading}
                        />
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
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
                                <div className="bg-primary/10 p-3 rounded-md">
                                    <p className="text-lg font-bold">
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
                                    <h3 className="font-semibold">Common Fields for All Items</h3>

                                    <div className="grid md:grid-cols-2 gap-4">
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

                                {/* Table for matching indents - NICHE */}
                                <div className="border rounded-md overflow-x-auto mt-6">
                                    <h3 className="font-semibold p-3 bg-muted">Items in this PO</h3>
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
