import type { ColumnDef, Row } from '@tanstack/react-table';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { useEffect, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useInfiniteSupabaseQuery } from '@/hooks/useInfiniteSupabaseQuery';
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
    const queryClient = useQueryClient();

    const [selectedIndent, setSelectedIndent] = useState<RateApprovalData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<HistoryData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);

    // Pending Data Query
    const {
        data: pendingDataRaw,
        fetchNextPage: fetchNextPendingPage,
        hasNextPage: hasNextPendingPage,
        isLoading: pendingLoading,
        isFetchingNextPage: isFetchingNextPendingPage,
    } = useInfiniteSupabaseQuery(['ratePending'], {
        tableName: 'indent',
        queryBuilder: (q) => q.not('planned_3', 'is', null).is('actual_3', null).eq('vendor_type', 'Three Party'),
        pageSize: 10,
    });

    // History Data Query
    const {
        data: historyDataRaw,
        fetchNextPage: fetchNextHistoryPage,
        hasNextPage: hasNextHistoryPage,
        isLoading: historyLoading,
        isFetchingNextPage: isFetchingNextHistoryPage,
    } = useInfiniteSupabaseQuery(['rateHistory'], {
        tableName: 'indent',
        queryBuilder: (q) => q.not('planned_3', 'is', null).not('actual_3', 'is', null).eq('vendor_type', 'Three Party'),
        pageSize: 10,
    });

    const tableData = useMemo(() => {
        if (!pendingDataRaw) return [];
        return pendingDataRaw.pages.flatMap(page => page.data).map((record: any) => ({
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
    }, [pendingDataRaw]);

    const historyData = useMemo(() => {
        if (!historyDataRaw) return [];
        return historyDataRaw.pages.flatMap(page => page.data).map((record: any) => ({
            indentNo: record.indent_number || '',
            indenter: record.indenter_name || '',
            department: record.department || '',
            product: record.product_name || '',
            date: new Date(record.created_at).toDateString(),
            vendor: [record.approved_vendor_name || '', record.approved_rate?.toString() || '0'] as [string, string],
        }));
    }, [historyDataRaw]);


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
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedIndent(indent);
                                        setOpenDialog(true);
                                    }}
                                >
                                    Approve
                                </Button>
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
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSelectedHistory(indent);
                                    setOpenDialog(true);
                                }}
                            >
                                Update
                            </Button>
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
            queryClient.invalidateQueries({ queryKey: ['ratePending'] });
            queryClient.invalidateQueries({ queryKey: ['rateHistory'] });
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
            queryClient.invalidateQueries({ queryKey: ['rateHistory'] });
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
                                searchFields={['indentNo', 'product', 'department', 'indenter']}
                                dataLoading={pendingLoading}
                                isFetchingNextPage={isFetchingNextPendingPage}
                                infiniteScroll={true}
                                onLoadMore={fetchNextPendingPage}
                                hasMore={hasNextPendingPage}
                            />
                        </div>
                    </TabsContent>
                    <TabsContent value="history" className="overflow-hidden w-full">
                        <div className="overflow-x-auto max-w-[calc(100vw-3rem)] md:max-w-full">
                            <DataTable
                                data={historyData}
                                columns={historyColumns}
                                searchFields={['indentNo', 'product', 'department', 'indenter']}
                                dataLoading={historyLoading}
                                isFetchingNextPage={isFetchingNextHistoryPage}
                                infiniteScroll={true}
                                onLoadMore={fetchNextHistoryPage}
                                hasMore={hasNextHistoryPage}
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
