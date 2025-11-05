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
import { useSheets } from '@/context/SheetsContext';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { postToSheet } from '@/lib/fetchers';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Users } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate } from '@/lib/utils';
import { Input } from '../ui/input';

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
    const { indentLoading, indentSheet, updateIndentSheet } = useSheets();
    const { user } = useAuth();

    const [selectedIndent, setSelectedIndent] = useState<RateApprovalData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<HistoryData | null>(null);
    const [tableData, setTableData] = useState<RateApprovalData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);

    // Fetching table data
    useEffect(() => {
        setTableData(
            indentSheet
                .filter(
                    (sheet) =>
                        sheet.planned3 !== '' &&
                        sheet.actual3 === '' &&
                        sheet.vendorType === 'Three Party'
                )
                .map((sheet) => ({
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    comparisonSheet: sheet.comparisonSheet || '',
                    date: formatDate(new Date(sheet.timestamp)),
                    vendors: [
                        [sheet.vendorName1, sheet.rate1.toString(), sheet.paymentTerm1],
                        [sheet.vendorName2, sheet.rate2.toString(), sheet.paymentTerm2],
                        [sheet.vendorName3, sheet.rate3.toString(), sheet.paymentTerm3],
                    ],
                }))
        );
        setHistoryData(
            indentSheet
                .filter(
                    (sheet) =>
                        sheet.planned3 !== '' &&
                        sheet.actual3 !== '' &&
                        sheet.vendorType === 'Three Party'
                )
                .map((sheet) => ({
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    date: new Date(sheet.timestamp).toDateString(),
                    vendor: [sheet.approvedVendorName, sheet.approvedRate.toString()],
                }))
        );
    }, [indentSheet]);

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
            cell: ({ row }) => {
                const vendors = row.original.vendors;
                return (
                    <div className="grid place-items-center">
                        <div className="flex flex-col gap-1">
                            {vendors.map((vendor) => (
                                <span className="rounded-full text-xs px-3 py-1 bg-accent text-accent-foreground border border-accent-foreground">
                                    {vendor[0]} - &#8377;{vendor[1]}
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
            cell: ({ row }) => {
                const sheet = row.original.comparisonSheet;
                return sheet ? (
                    <a href={sheet} target="_blank">
                        Comparison Sheet
                    </a>
                ) : (
                    <></>
                );
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
            cell: ({ row }) => {
                const vendor = row.original.vendor;
                return (
                    <div className="grid place-items-center">
                        <div className="flex flex-col gap-1">
                            <span className="rounded-full text-xs px-3 py-1 bg-accent text-accent-foreground border border-accent-foreground">
                                {vendor[0]} - &#8377;{vendor[1]}
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
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            vendor: undefined,
        },
    });

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            await postToSheet(
                indentSheet
                    .filter((s) => s.indentNumber === selectedIndent?.indentNo)
                    .map((prev) => ({
                        ...prev,
                        actual3: new Date().toISOString(),
                        approvedVendorName: selectedIndent?.vendors[values.vendor][0],
                        approvedRate: selectedIndent?.vendors[values.vendor][1],
                        approvedPaymentTerm: selectedIndent?.vendors[values.vendor][2],
                    })),
                'update'
            );
            toast.success(`Approved vendor for ${selectedIndent?.indentNo}`);
            setOpenDialog(false);
            form.reset();
            setTimeout(() => updateIndentSheet(), 1000);
        } catch {
            toast.error('Failed to update vendor');
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
                historyUpdateForm.reset({rate: parseInt(selectedHistory.vendor[1])})
            }
        }, [selectedHistory])
    
        async function onSubmitHistoryUpdate(values: z.infer<typeof historyUpdateSchema>) {
             try {
                await postToSheet(
                    indentSheet
                        .filter((s) => s.indentNumber === selectedHistory?.indentNo)
                        .map((prev) => ({
                            ...prev,
                            approvedRate: values.rate,
                        })),
                    'update'
                );
                toast.success(`Updated rate of ${selectedHistory?.indentNo}`);
                setOpenDialog(false);
                historyUpdateForm.reset({ rate: undefined });
                setTimeout(() => updateIndentSheet(), 1000);
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
                        heading="Three Party Rate Approval"
                        subtext="Approve rates for three party vendors"
                        tabs
                    >
                        <Users size={50} className="text-primary" />
                    </Heading>
                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['product', 'department', 'indenter']}
                            dataLoading={indentLoading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['product', 'department', 'indenter']}
                            dataLoading={indentLoading}
                        />
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
