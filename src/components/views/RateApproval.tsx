import type { ColumnDef, Row } from '@tanstack/react-table';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../ui/dialog';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { postToSheet, uploadFile, fetchFromSupabaseWithCount } from '@/lib/fetchers';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Users } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { useSheets } from '@/context/SheetsContext';
import Heading from '../element/Heading';
import { formatDate } from '@/lib/utils';
import { Input } from '../ui/input';
import { supabase } from '@/lib/supabaseClient';

interface RateApprovalData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    comparisonSheet: string;
    vendors: [string, string, string][];
    date: string;
}
interface HistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    vendor: [string, string];
    date: string;
}

export default () => {
    const { user } = useAuth();
    const { updateIndentSheet } = useSheets();

    const [selectedIndent, setSelectedIndent] = useState<RateApprovalData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<HistoryData | null>(null);
    const [tableData, setTableData] = useState<RateApprovalData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);

    // Pagination state - Pending
    const [pendingPageIndex, setPendingPageIndex] = useState(0);
    const [pendingPageSize] = useState(10);
    const [pendingTotalCount, setPendingTotalCount] = useState(0);
    const [hasMorePending, setHasMorePending] = useState(true);

    // Pagination state - History
    const [historyPageIndex, setHistoryPageIndex] = useState(0);
    const [historyPageSize] = useState(10);
    const [historyTotalCount, setHistoryTotalCount] = useState(0);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);

    const fetchPendingData = async (isInitial = true) => {
        setDataLoading(true);
        try {
            const currentPage = isInitial ? 0 : pendingPageIndex;
            const from = currentPage * pendingPageSize;
            const to = from + pendingPageSize - 1;

            const { data, count } = await fetchFromSupabaseWithCount(
                'indent',
                'indent_number, indenter_name, department, product_name, comparison_sheet, created_at, vendor_name_1, rate_1, payment_term_1, vendor_name_2, rate_2, payment_term_2, vendor_name_3, rate_3, payment_term_3',
                { from, to },
                { column: 'created_at', options: { ascending: false } },
                (q) => q.not('planned_3', 'is', null).is('actual_3', null).eq('vendor_type', 'Three Party')
            );

            if (data) {
                const pendingTableData = data.map((record: any) => ({
                    indentNo: record.indent_number || '',
                    indenter: record.indenter_name || '',
                    department: record.department || '',
                    product: record.product_name || '',
                    comparisonSheet: record.comparison_sheet || '',
                    date: formatDate(new Date(record.created_at)),
                    vendors: [
                        [record.vendor_name_1 || '', record.rate_1?.toString() || '0', record.payment_term_1 || ''] as [string, string, string],
                        [record.vendor_name_2 || '', record.rate_2?.toString() || '0', record.payment_term_2 || ''] as [string, string, string],
                        [record.vendor_name_3 || '', record.rate_3?.toString() || '0', record.payment_term_3 || ''] as [string, string, string],
                    ],
                }));
                
                if (isInitial) {
                    setTableData(pendingTableData);
                    setPendingPageIndex(1);
                } else {
                    setTableData(prev => [...prev, ...pendingTableData]);
                    setPendingPageIndex(prev => prev + 1);
                }
                
                setPendingTotalCount(count || 0);
                setHasMorePending(data.length === pendingPageSize);
            }
        } catch (error: any) {
            console.error('Error fetching data from Supabase:', error);
            toast.error('Failed to fetch data: ' + error.message);
        } finally {
            setDataLoading(false);
        }
    };

    const fetchHistoryData = async (isInitial = true) => {
        setDataLoading(true);
        try {
            const currentPage = isInitial ? 0 : historyPageIndex;
            const from = currentPage * historyPageSize;
            const to = from + historyPageSize - 1;

            const { data, count } = await fetchFromSupabaseWithCount(
                'indent',
                'indent_number, indenter_name, department, product_name, created_at, approved_vendor_name, approved_rate',
                { from, to },
                { column: 'created_at', options: { ascending: false } },
                (q) => q.not('planned_3', 'is', null).not('actual_3', 'is', null).eq('vendor_type', 'Three Party')
            );

            if (data) {
                const historyTableData = data.map((record: any) => ({
                    indentNo: record.indent_number || '',
                    indenter: record.indenter_name || '',
                    department: record.department || '',
                    product: record.product_name || '',
                    date: new Date(record.created_at).toDateString(),
                    vendor: [record.approved_vendor_name || '', record.approved_rate?.toString() || '0'] as [string, string],
                }));

                if (isInitial) {
                    setHistoryData(historyTableData);
                    setHistoryPageIndex(1);
                } else {
                    setHistoryData(prev => [...prev, ...historyTableData]);
                    setHistoryPageIndex(prev => prev + 1);
                }

                setHistoryTotalCount(count || 0);
                setHasMoreHistory(data.length === historyPageSize);
            }
        } catch (error: any) {
            console.error('Error fetching data from Supabase:', error);
            toast.error('Failed to fetch data: ' + error.message);
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingData(true);
        fetchHistoryData(true);
    }, []);

    // Creating table columns
    const columns: ColumnDef<RateApprovalData>[] = [
        ...(user.threePartyApprovalAction
            ? [
                {
                    header: 'Action',
                    id: 'action',
                    cell: ({ row }: { row: Row<RateApprovalData> }) => {
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
                                        Approve
                                    </Button>
                                </DialogTrigger>
                            </div>
                        );
                    },
                },
            ]
            : []),
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'product', header: 'Product' },
        { accessorKey: 'date', header: 'Date' },
        {
            accessorKey: 'vendors',
            header: 'Vendors',
            enableSorting: false,   // <-- ADD THIS
            cell: ({ row }) => {
                const vendors = row.original.vendors;
                return (
                    <div className="grid place-items-center">
                        <div className="flex flex-col gap-1">
                            {vendors.map((vendor) => (
                                <span className="rounded-full text-xs px-3 py-1 bg-accent text-accent-foreground border border-accent-foreground">
                                    {vendor[0]} - ₹{vendor[1]}
                                </span>
                            ))}
                        </div>
                    </div>
                );
            },
        },

        {
            accessorKey: 'comparisonSheet',
            header: 'Comparison Sheet',
            enableSorting: false,    // <-- ADD THIS
            cell: ({ row }) => {
                const sheet = row.original.comparisonSheet;
                return sheet ? (
                    <a href={sheet} target="_blank">Comparison Sheet</a>
                ) : <></>;
            },
        },

    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        ...(user.updateVendorAction ? [
            {
                header: 'Action',
                cell: ({ row }: { row: Row<HistoryData> }) => {
                    const indent = row.original;

                    return (
                        <div>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedHistory(indent);
                                    }}
                                >
                                    Update
                                </Button>
                            </DialogTrigger>
                        </div>
                    );
                },
            },
        ] : []),
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'product', header: 'Product' },
        { accessorKey: 'date', header: 'Date' },
        {
            accessorKey: 'vendor',
            header: 'Vendor',
            enableSorting: false,     // <-- ADD THIS
            cell: ({ row }) => {
                const vendor = row.original.vendor;
                return (
                    <div className="grid place-items-center">
                        <div className="flex flex-col gap-1">
                            <span className="rounded-full text-xs px-3 py-1 bg-accent text-accent-foreground border border-accent-foreground">
                                {vendor[0]} - ₹{vendor[1]}
                            </span>
                        </div>
                    </div>
                );
            },
        },

    ];

    // Creating approval form
    const schema = z.object({
        vendor: z.coerce.number(),
        photoOfBill: z.instanceof(File).optional(),
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            vendor: undefined,
            photoOfBill: undefined,
        },
    });

    const getCurrentFormattedDateOnly = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            let photoUrl = '';
            if (values.photoOfBill) {
                photoUrl = await uploadFile(values.photoOfBill, 'bill_photo', 'supabase');
            }

            const selectedVendor = selectedIndent?.vendors[values.vendor];

            const { error } = await supabase
                .from('indent')
                .update({
                    actual_3: getCurrentFormattedDateOnly(),
                    approved_vendor_name: selectedVendor?.[0],
                    approved_rate: selectedVendor?.[1],
                    approved_payment_term: selectedVendor?.[2],
                    photo_of_bill: photoUrl || undefined,
                })
                .eq('indent_number', selectedIndent?.indentNo);

            if (error) throw error;            toast.success(`Approved vendor for ${selectedIndent?.indentNo}`);
            updateIndentSheet(); // Update context to sync sidebar counts
            setOpenDialog(false);
            form.reset();

            // Refresh the data after update
            fetchPendingData(true);
            fetchHistoryData(true);
        } catch (error: any) {
            console.error('Error updating vendor:', error);
            toast.error('Failed to update vendor: ' + error.message);
        }
    }

    const historyUpdateSchema = z.object({
        rate: z.coerce.number(),
    })

    const historyUpdateForm = useForm({
        resolver: zodResolver(historyUpdateSchema),
        defaultValues: {
            rate: 0,
        },
    })

    useEffect(() => {
        if (selectedHistory) {
            historyUpdateForm.reset({ rate: parseInt(selectedHistory.vendor[1]) })
        }
    }, [selectedHistory])

    async function onSubmitHistoryUpdate(values: z.infer<typeof historyUpdateSchema>) {
        try {
            const { error } = await supabase
                .from('indent')
                .update({
                    approved_rate: values.rate,
                })
                .eq('indent_number', selectedHistory?.indentNo);

            if (error) throw error;

            toast.success(`Updated rate of ${selectedHistory?.indentNo}`);
            updateIndentSheet(); // Update context to sync sidebar counts
            setOpenDialog(false);
            historyUpdateForm.reset({ rate: undefined });

            // Refresh the data after update
            fetchHistoryData(true);
        } catch (error: any) {
            console.error('Error updating vendor:', error);
            toast.error('Failed to update vendor: ' + error.message);
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
                        heading="Three Party Rate Approval"
                        subtext="Approve rates for three party vendors"
                        tabs
                    >
                        <Users size={50} className="text-primary" />
                    </Heading>
                    <TabsContent value="pending" className="overflow-hidden w-full">
                        <div className="overflow-x-auto max-w-[calc(100vw-3rem)] md:max-w-full">
                            <DataTable
                                data={tableData}
                                columns={columns}
                                searchFields={['indentNo', 'product', 'department', 'indenter', 'date']}
                                dataLoading={dataLoading}
                                infiniteScroll={true}
                                onLoadMore={() => fetchPendingData(false)}
                                hasMore={hasMorePending}
                            />
                        </div>
                    </TabsContent>
                    <TabsContent value="history" className="overflow-hidden w-full">
                        <div className="overflow-x-auto max-w-[calc(100vw-3rem)] md:max-w-full">
                            <DataTable
                                data={historyData}
                                columns={historyColumns}
                                searchFields={['indentNo', 'product', 'department', 'indenter', 'date']}
                                dataLoading={dataLoading}
                                infiniteScroll={true}
                                onLoadMore={() => fetchHistoryData(false)}
                                hasMore={hasMoreHistory}
                            />
                        </div>
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent>
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-5"
                            >
                                <DialogHeader className="space-y-1">
                                    <DialogTitle>Rate Approval</DialogTitle>
                                    <DialogDescription>
                                        Update vendor for{' '}
                                        <span className="font-medium">
                                            {selectedIndent.indentNo}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-muted py-2 px-5 rounded-md ">
                                    <div className="space-y-1">
                                        <p className="font-medium">Indenter</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.indenter}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium">Department</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.department}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium">Product</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.product}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid gap-3">
                                    <FormField
                                        control={form.control}
                                        name="vendor"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Select a vendor</FormLabel>
                                                <FormControl>
                                                    <RadioGroup onChange={field.onChange}>
                                                        {selectedIndent.vendors.map(
                                                            (vendor, index) => (
                                                                <FormItem>
                                                                    <FormLabel className="flex items-center gap-4 border hover:bg-accent p-3 rounded-md">
                                                                        <FormControl>
                                                                            <RadioGroupItem
                                                                                value={`${index}`}
                                                                            />
                                                                        </FormControl>
                                                                        <div className="font-normal w-full">
                                                                            <div className="flex justify-between items-center w-full">
                                                                                <div>
                                                                                    <p className="font-medium text-base">
                                                                                        {vendor[0]}
                                                                                    </p>
                                                                                    <p className="text-xs">
                                                                                        Payment
                                                                                        Term:{' '}
                                                                                        {vendor[2]}
                                                                                    </p>
                                                                                </div>
                                                                                <p className="text-base">
                                                                                    &#8377;
                                                                                    {vendor[1]}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </FormLabel>
                                                                </FormItem>
                                                            )
                                                        )}
                                                    </RadioGroup>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="photoOfBill"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Upload Bill Photo (Optional)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="file"
                                                        accept="image/*,application/pdf"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) field.onChange(file);
                                                        }}
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
                                        Update
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}

                {selectedHistory && (
                    <DialogContent>
                        <Form {...historyUpdateForm}>
                            <form onSubmit={historyUpdateForm.handleSubmit(onSubmitHistoryUpdate, onError)} className="space-y-7">
                                <DialogHeader className="space-y-1">
                                    <DialogTitle>Update Rate</DialogTitle>
                                    <DialogDescription>
                                        Update rate for{' '}
                                        <span className="font-medium">
                                            {selectedHistory.indentNo}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-3">
                                    <FormField
                                        control={historyUpdateForm.control}
                                        name="rate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Rate</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>

                                    <Button
                                        type="submit"
                                        disabled={historyUpdateForm.formState.isSubmitting}
                                    >
                                        {historyUpdateForm.formState.isSubmitting && (
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
