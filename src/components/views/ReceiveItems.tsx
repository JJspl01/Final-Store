import { useSheets } from '@/context/SheetsContext';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { postToSheet, uploadFile } from '@/lib/fetchers';
import type { ReceivedSheet } from '@/types';
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

export default () => {
    const { indentSheet, receivedSheet, updateAll, indentLoading, receivedLoading } = useSheets();
    const { user } = useAuth();

    const [tableData, setTableData] = useState<RecieveItemsData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [selectedIndent, setSelectedIndent] = useState<RecieveItemsData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);

    useEffect(() => {
        setTableData(
            indentSheet
                .filter((i) => i.planned5 !== '' && i.actual5 === '')
                .map((i) => ({
                    indentNumber: i.indentNumber,
                    poNumber: i.poNumber,
                    uom: i.uom,
                    poCopy: i.poCopy,
                    vendor: i.approvedVendorName,
                    quantity: i.approvedQuantity,
                    poDate: i.actual4,
                    product: i.productName,
                }))
        );
    }, [indentSheet]);

   useEffect(() => {
    setHistoryData(
        receivedSheet.map((r) => {
            const indent = indentSheet.find((i) => i.indentNumber === r.indentNumber);
            return {
                receiveStatus: r.receivedStatus,
                poNumber: r.poNumber,
                poDate: formatDate(new Date(r.poDate)),
                vendor: indent?.approvedVendorName || '',
                product: indent?.productName || '',
                orderQuantity: indent?.approvedQuantity || 0,
                uom: indent?.uom || '',
                photoOfProduct: r.photoOfProduct,
                receivedDate: formatDate(new Date(r.timestamp)),

                receivedQuantity: r.receivedQuantity,
                warrantyStatus: r.warrantyStatus,
                warrantyEndDate: r.endDate ? formatDate(new Date(r.endDate)) : '',

                billStatus: r.billStatus,
                billNumber: r.billNumber,
                billAmount: r.billAmount,
                photoOfBill: r.photoOfBill,
                anyTransport: r.anyTransportations,
                transporterName: r.transporterName,
                transportingAmount: r.transportingAmount,
            };
        })
    );
}, [receivedSheet, indentSheet]);

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
        { accessorKey: 'quantity', header: 'Quantity' },
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
        { accessorKey: 'receivedQuantity', header: 'Received Quantity' },
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

    const schema = z
        .object({
            status: z.enum(['Received', 'Not Received']),
            quantity: z.coerce.number().optional().default(0),
            photoOfProduct: z.instanceof(File).optional(),

            warrantyStatus: z.enum(['Not Any', 'Gaurantee', 'Warranty']).optional(),
            warrantyDate: z.date().optional(),

            billReceived: z.enum(['Received', 'Not Received']).optional(),
            billNo: z.string().optional(),
            billAmount: z.coerce.number().optional(),
            photoOfBill: z.instanceof(File).optional(),

            anyTransport: z.enum(['Yes', 'No']).optional(),
            transporterName: z.string().optional(),
            transportingAmount: z.coerce.number().optional(),
        })
        .superRefine((data, ctx) => {
            if (data.status === 'Received') {

                if (data.quantity === undefined) {
                    ctx.addIssue({ path: ['quantity'], code: z.ZodIssueCode.custom });
                }
                if (data.warrantyStatus === undefined) {
                    ctx.addIssue({ path: ['warrantyStatus'], code: z.ZodIssueCode.custom });
                }
                if (data.billReceived === undefined) {
                    ctx.addIssue({ path: ['billReceived'], code: z.ZodIssueCode.custom });
                }
                if (data.anyTransport === undefined) {
                    ctx.addIssue({ path: ['anyTransport'], code: z.ZodIssueCode.custom });
                }

                if (data.warrantyStatus !== 'Not Any') {
                    if (data.warrantyDate === undefined) {
                        ctx.addIssue({ path: ['warrantyDate'], code: z.ZodIssueCode.custom });
                    }
                }
                if (data.billReceived === 'Received') {
                    if (!data.billNo?.trim()) {
                        ctx.addIssue({ path: ['billNo'], code: z.ZodIssueCode.custom });
                    }
                    if (data.billAmount === undefined) {
                        ctx.addIssue({ path: ['billAmount'], code: z.ZodIssueCode.custom });
                    }
                }

                if (data.anyTransport === 'Yes') {
                    if (!data.transporterName?.trim()) {
                        ctx.addIssue({ path: ['transporterName'], code: z.ZodIssueCode.custom });
                    }
                    if (data.transportingAmount === undefined) {
                        ctx.addIssue({ path: ['transporingAmount'], code: z.ZodIssueCode.custom });
                    }
                }
            }
        });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            billNo: '',
            quantity: undefined,
            warrantyStatus: undefined,
            status: undefined,
            billAmount: undefined,
            photoOfBill: undefined,
            anyTransport: undefined,
            billReceived: undefined,
            warrantyDate: undefined,
            photoOfProduct: undefined,
            transporterName: '',
            transportingAmount: undefined,
        },
    });

    const status = form.watch('status');
    const billReceived = form.watch('billReceived');
    const anyTransport = form.watch('anyTransport');
    const warrantyStatus = form.watch('warrantyStatus');

    useEffect(() => {
        if (selectedIndent) {
            form.setValue('quantity', selectedIndent.quantity);
        } else if (!openDialog) {
            form.reset({
                billNo: '',
                quantity: undefined,
                warrantyStatus: undefined,
                status: undefined,
                billAmount: undefined,
                photoOfBill: undefined,
                anyTransport: undefined,
                billReceived: undefined,
                warrantyDate: undefined,
                photoOfProduct: undefined,
                transporterName: '',
                transportingAmount: undefined,
            });
        }
    }, [selectedIndent, openDialog]);

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            const row: Partial<ReceivedSheet> = {
                timestamp: new Date().toISOString(),
                indentNumber: selectedIndent?.indentNumber,
                poDate: selectedIndent?.poDate,
                poNumber: selectedIndent?.poNumber,
                vendor: selectedIndent?.vendor,
                receivedStatus: values.status,
                receivedQuantity: values.quantity,
                uom: selectedIndent?.uom,
                warrantyStatus: values.warrantyStatus,
                endDate: values.warrantyDate?.toISOString(),
                billStatus: values.billReceived,
                billNumber: values.billNo,
                billAmount: values.billAmount,
                anyTransportations: values.anyTransport,
                transporterName: values.transporterName,
                transportingAmount: values.transportingAmount,
            };

            console.log('here', 1);
            if (values.photoOfProduct !== undefined) {
                row.photoOfProduct = await uploadFile(
                    values.photoOfProduct,
                    import.meta.env.VITE_PRODUCT_PHOTO_FOLDER
                );
            }

            console.log('here', 2);
            if (values.photoOfBill !== undefined) {
                row.photoOfBill = await uploadFile(
                    values.photoOfBill,
                    import.meta.env.VITE_BILL_PHOTO_FOLDER
                );
            }
            console.log('here', 3);
            await postToSheet([row], 'insert', 'RECEIVED');

            console.log('here', 4);
            await postToSheet(
                indentSheet
                    .filter((s) => s.indentNumber === selectedIndent?.indentNumber)
                    .map((prev) => ({
                        ...prev,
                        actual5: new Date().toISOString(),
                    })),
                'update'
            );
            console.log('here', 5);
            toast.success(`Approved vendor for ${selectedIndent?.indentNumber}`);
            setOpenDialog(false);
            setTimeout(() => updateAll(), 1000);
        } catch {
            toast.error('Failed to update vendor');
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
                            searchFields={['product', 'poNumber', 'indentNumber']}
                            dataLoading={indentLoading}
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
                            dataLoading={receivedLoading}
                        />
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent className="sm:max-w-3xl">
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-5"
                            >
                                <DialogHeader className="space-y-1">
                                    <DialogTitle>Receive Item</DialogTitle>
                                    <DialogDescription>
                                        Receive item fron indent{' '}
                                        <span className="font-medium">
                                            {selectedIndent.indentNumber}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="bg-muted p-4 rounded-md grid gap-3">
                                    <h3 className="text-lg font-bold">Item Details</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 bg-muted rounded-md gap-3 ">
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">Indent Number</p>
                                            <p className="text-sm font-light">
                                                {selectedIndent.indentNumber}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium">Item Name</p>
                                            <p className="text-sm font-light">
                                                {selectedIndent.product}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">
                                                Ordered Quantity
                                            </p>
                                            <p className="text-sm font-light">
                                                {selectedIndent.quantity}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium text-nowrap">UOM</p>
                                            <p className="text-sm font-light">
                                                {selectedIndent.uom}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <FormLabel>Receiving Status</FormLabel>
                                                        <FormControl>
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Set status" />
                                                            </SelectTrigger>
                                                        </FormControl>
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
                                        name="quantity"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Received Quantity</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="Enter received quantity"
                                                        max={selectedIndent.quantity}
                                                        disabled={status !== 'Received'}
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="photoOfProduct"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Photo of Product</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="file"
                                                    disabled={status !== 'Received'}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.files?.[0])
                                                    }
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <div className="grid md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="warrantyStatus"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <FormLabel>Warranty</FormLabel>
                                                        <FormControl>
                                                            <SelectTrigger
                                                                className="w-full"
                                                                disabled={status !== 'Received'}
                                                            >
                                                                <SelectValue placeholder="Set warranty" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Not Any">
                                                                Not Any
                                                            </SelectItem>
                                                            <SelectItem value="Warranty">
                                                                Warranty
                                                            </SelectItem>
                                                            <SelectItem value="Gaurantee">
                                                                Gaurantee
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="warrantyDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>End of Warrany / Guarantee</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="date"
                                                        disabled={
                                                            status !== 'Received' ||
                                                            !['Warranty', 'Gaurantee'].includes(
                                                                warrantyStatus || ''
                                                            )
                                                        }
                                                        value={
                                                            field.value
                                                                ? field.value
                                                                    .toISOString()
                                                                    .split('T')[0]
                                                                : ''
                                                        }
                                                        onChange={(e) =>
                                                            field.onChange(
                                                                e.target.value
                                                                    ? new Date(e.target.value)
                                                                    : undefined
                                                            )
                                                        }
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="billReceived"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <FormLabel>Bill Received</FormLabel>
                                                        <FormControl>
                                                            <SelectTrigger
                                                                className="w-full"
                                                                disabled={status !== 'Received'}
                                                            >
                                                                <SelectValue placeholder="Set bill received" />
                                                            </SelectTrigger>
                                                        </FormControl>
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
                                        name="billNo"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Bill Number</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        disabled={
                                                            status !== 'Received' ||
                                                            billReceived !== 'Received'
                                                        }
                                                        placeholder="Enter bill number"
                                                        {...field}
                                                    />
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
                                                        disabled={
                                                            status !== 'Received' ||
                                                            billReceived !== 'Received'
                                                        }
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
                                                        disabled={
                                                            status !== 'Received' ||
                                                            billReceived !== 'Received'
                                                        }
                                                        onChange={(e) =>
                                                            field.onChange(e.target.files?.[0])
                                                        }
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="anyTransport"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                >
                                                    <FormLabel>Any transport</FormLabel>
                                                    <FormControl>
                                                        <SelectTrigger
                                                            className="w-full"
                                                            disabled={status !== 'Received'}
                                                        >
                                                            <SelectValue placeholder="Any tranport?" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Yes">Yes</SelectItem>
                                                        <SelectItem value="No">No</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <div className="grid md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="transporterName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Transporter Name</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        disabled={
                                                            status !== 'Received' ||
                                                            anyTransport !== 'Yes'
                                                        }
                                                        placeholder="Enter transporter name"
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="transportingAmount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Transporting Amount</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        disabled={
                                                            status !== 'Received' ||
                                                            anyTransport !== 'Yes'
                                                        }
                                                        placeholder="Enter transporting amount"
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>

                                    <Button type="submit" disabled={form.formState.isSubmitting}>
                                        {form.formState.isSubmitting && (
                                            <Loader
                                                size={20}
                                                color="white"
                                                aria-label="Loading Spinner"
                                            />
                                        )}
                                        Store In
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
