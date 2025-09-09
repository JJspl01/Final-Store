import { useSheets } from '@/context/SheetsContext';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
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
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { UserCheck, PenSquare } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { formatDate } from '@/lib/utils';

interface VendorUpdateData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    vendorType: 'Three Party' | 'Regular';
}
interface HistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    rate: number;
    vendorType: 'Three Party' | 'Regular';
    date: string;
    lastUpdated?: string;
}

export default () => {
    const { indentSheet, indentLoading, updateIndentSheet, masterSheet: options } = useSheets();
    const { user } = useAuth();

    const [selectedIndent, setSelectedIndent] = useState<VendorUpdateData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<HistoryData | null>(null);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [tableData, setTableData] = useState<VendorUpdateData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<HistoryData>>({});

    // Fetching table data
    useEffect(() => {
        setTableData(
            indentSheet
                .filter((sheet) => sheet.planned2 !== '' && sheet.actual2 === '')
                .map((sheet) => ({
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    quantity: sheet.approvedQuantity,
                    uom: sheet.uom,
                    vendorType: sheet.vendorType as VendorUpdateData['vendorType'],
                }))
        );
        setHistoryData(
            indentSheet
                .filter((sheet) => sheet.planned2 !== '' && sheet.actual2 !== '')
                .map((sheet) => ({
                    date: formatDate(new Date(sheet.actual2)),
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    quantity: sheet.quantity,
                    uom: sheet.uom,
                    rate: sheet.approvedRate || 0,
                    vendorType: sheet.vendorType as HistoryData['vendorType'],
                    // lastUpdated: sheet.lastUpdated,
                }))
                // Sort by indentNo in descending order (newest first)
                .sort((a, b) => {
                    return b.indentNo.localeCompare(a.indentNo);
                })
        );
    }, [indentSheet]);

    const handleEditClick = (row: HistoryData) => {
        setEditingRow(row.indentNo);
        setEditValues({
            quantity: row.quantity,
            uom: row.uom,
            vendorType: row.vendorType,
        });
    };

    const handleCancelEdit = () => {
        setEditingRow(null);
        setEditValues({});
    };

    const handleSaveEdit = async (indentNo: string) => {
        try {
            await postToSheet(
                indentSheet
                    .filter((s) => s.indentNumber === indentNo)
                    .map((prev) => ({
                        ...prev,
                        quantity: editValues.quantity,
                        uom: editValues.uom,
                        vendorType: editValues.vendorType,
                        lastUpdated: new Date().toISOString(),
                    })),
                'update'
            );
            toast.success(`Updated indent ${indentNo}`);
            updateIndentSheet();
            setEditingRow(null);
            setEditValues({});
        } catch {
            toast.error('Failed to update indent');
        }
    };

    const handleInputChange = (field: keyof HistoryData, value: any) => {
        setEditValues(prev => ({ ...prev, [field]: value }));
    };

    // Creating table columns
    const columns: ColumnDef<VendorUpdateData>[] = [
        ...(user.updateVendorAction
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<VendorUpdateData> }) => {
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
            header: 'Quantity',
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
        },
        {
            accessorKey: 'vendorType',
            header: 'Vendor Type',
            cell: ({ row }) => {
                const status = row.original.vendorType;
                const variant = status === 'Regular' ? 'primary' : 'secondary';
                return <Pill variant={variant}>{status}</Pill>;
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
                                    disabled={indent.vendorType === "Three Party"}
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
        {
            accessorKey: 'date',
            header: 'Date',
        },
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
            header: 'Quantity',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Input
                        type="number"
                        value={editValues.quantity ?? row.original.quantity}
                        onChange={(e) => handleInputChange('quantity', Number(e.target.value))}
                        className="w-20"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        {row.original.quantity}
                        {user.updateVendorAction && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: "rate",
            header: "Rate",
            cell: ({ row }) => {
                const rate = row.original.rate;
                const vendorType = row.original.vendorType;

                if (!rate && vendorType === "Three Party") {
                    return (
                        <span className="text-muted-foreground">Not Decided</span>
                    )
                }
                return <>&#8377;{rate}</>;
            },
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Input
                        value={editValues.uom ?? row.original.uom}
                        onChange={(e) => handleInputChange('uom', e.target.value)}
                        className="w-20"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        {row.original.uom}
                        {user.updateVendorAction && editingRow !== row.original.indentNo && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'vendorType',
            header: 'Vendor Type',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Select
                        value={editValues.vendorType ?? row.original.vendorType}
                        onValueChange={(value) => handleInputChange('vendorType', value)}
                    >
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Regular Vendor">Regular</SelectItem>
                            <SelectItem value="Three Party">Three Party</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="flex items-center gap-2">
                        <Pill
                            variant={row.original.vendorType === 'Regular' ? 'primary' : 'secondary'}
                        >
                            {row.original.vendorType}
                        </Pill>
                        {user.updateVendorAction && editingRow !== row.original.indentNo && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
        ...(user.updateVendorAction
            ? [
                {
                    id: 'editActions',
                    cell: ({ row }: { row: Row<HistoryData> }) => {
                        const isEditing = editingRow === row.original.indentNo;
                        return isEditing ? (
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => handleSaveEdit(row.original.indentNo)}
                                >
                                    Save
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : null;
                    },
                },
            ]
            : []),
    ];

    // Creating Regular Vendor form
    const regularSchema = z.object({
        vendorName: z.string().nonempty(),
        rate: z.coerce.number().gt(0),
        paymentTerm: z.string().nonempty(),
    });

    const regularForm = useForm<z.infer<typeof regularSchema>>({
        resolver: zodResolver(regularSchema),
        defaultValues: {
            vendorName: '',
            rate: 0,
            paymentTerm: '',
        },
    });

    async function onSubmitRegular(values: z.infer<typeof regularSchema>) {
        try {
            await postToSheet(
                indentSheet
                    .filter((s) => s.indentNumber === selectedIndent?.indentNo)
                    .map((prev) => ({
                        ...prev,
                        actual2: new Date().toISOString(),
                        vendorName1: values.vendorName,
                        rate1: values.rate.toString(),
                        paymentTerm1: values.paymentTerm,
                        approvedVendorName: values.vendorName,
                        approvedRate: values.rate,
                        approvedPaymentTerm: values.paymentTerm,
                        lastUpdated: new Date().toISOString(), // This ensures newly updated items appear at top
                    })),
                'update'
            );
            toast.success(`Updated vendor of ${selectedIndent?.indentNo}`);
            setOpenDialog(false);
            regularForm.reset();
            setTimeout(() => updateIndentSheet(), 1000);
        } catch {
            toast.error('Failed to update vendor');
        }
    }

    // Creating Three Party Vendor form
    const threePartySchema = z.object({
        comparisonSheet: z.instanceof(File).optional(),
        vendors: z.array(
            z.object({
                vendorName: z.string().nonempty(),
                rate: z.coerce.number().gt(0),
                paymentTerm: z.string().nonempty(),
            })
        ).max(3).min(3),
    });

    const threePartyForm = useForm<z.infer<typeof threePartySchema>>({
        resolver: zodResolver(threePartySchema),
        defaultValues: {
            vendors: [
                {
                    vendorName: '',
                    rate: 0,
                    paymentTerm: '',
                },
                {
                    vendorName: '',
                    rate: 0,
                    paymentTerm: '',
                },
                {
                    vendorName: '',
                    rate: 0,
                    paymentTerm: '',
                },
            ],
        },
    });

    const { fields } = useFieldArray({
        control: threePartyForm.control,
        name: 'vendors',
    });

    async function onSubmitThreeParty(values: z.infer<typeof threePartySchema>) {
        try {
            let url: string = '';
            if (values.comparisonSheet) {
                url = await uploadFile(
                    values.comparisonSheet,
                    import.meta.env.VITE_COMPARISON_SHEET_FOLDER
                );
            }

            await postToSheet(
                indentSheet
                    .filter((s) => s.indentNumber === selectedIndent?.indentNo)
                    .map((prev) => ({
                        ...prev,
                        actual2: new Date().toISOString(),
                        vendorName1: values.vendors[0].vendorName,
                        rate1: values.vendors[0].rate.toString(),
                        paymentTerm1: values.vendors[0].paymentTerm,
                        vendorName2: values.vendors[1].vendorName,
                        rate2: values.vendors[1].rate.toString(),
                        paymentTerm2: values.vendors[1].paymentTerm,
                        vendorName3: values.vendors[2].vendorName,
                        rate3: values.vendors[2].rate.toString(),
                        paymentTerm3: values.vendors[2].paymentTerm,
                        comparisonSheet: url,
                        lastUpdated: new Date().toISOString(), // This ensures newly updated items appear at top
                    })),
                'update'
            );
            toast.success(`Updated vendors of ${selectedIndent?.indentNo}`);
            setOpenDialog(false);
            threePartyForm.reset();
            setTimeout(() => updateIndentSheet(), 1000);
        } catch {
            toast.error('Failed to update vendor');
        }
    }

    // History Update form
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
            historyUpdateForm.reset({ rate: selectedHistory.rate })
        }
    }, [selectedHistory])

    async function onSubmitHistoryUpdate(values: z.infer<typeof historyUpdateSchema>) {
        try {
            await postToSheet(
                indentSheet
                    .filter((s) => s.indentNumber === selectedHistory?.indentNo)
                    .map((prev) => ({
                        ...prev,
                        rate1: values.rate.toString(),
                        approvedRate: values.rate,
                        lastUpdated: new Date().toISOString(), // This ensures updated items appear at top
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
                        heading="Vendor Rate Update"
                        subtext="Update vendors for Regular and Three Party indents"
                        tabs
                    >
                        <UserCheck size={50} className="text-primary" />
                    </Heading>
                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['product', 'department', 'indenter', 'vendorType']}
                            dataLoading={indentLoading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['product', 'department', 'indenter', 'vendorType']}
                            dataLoading={indentLoading}
                        />
                    </TabsContent>
                </Tabs>
                {selectedIndent &&
                    (selectedIndent.vendorType === 'Three Party' ? (
                        <DialogContent>
                            <Form {...threePartyForm}>
                                <form
                                    onSubmit={threePartyForm.handleSubmit(
                                        onSubmitThreeParty,
                                        onError
                                    )}
                                    className="space-y-7"
                                >
                                    <DialogHeader className="space-y-1">
                                        <DialogTitle>Three Party Vendors</DialogTitle>
                                        <DialogDescription>
                                            Update vendors for{' '}
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
                                    <Tabs
                                        defaultValue="0"
                                        className="grid gap-5 p-4 border rounded-md"
                                    >
                                        <TabsList className="w-full p-1">
                                            <TabsTrigger value="0">Vendor 1</TabsTrigger>
                                            <TabsTrigger value="1">Vendor 2</TabsTrigger>
                                            <TabsTrigger value="2">Vendor 3</TabsTrigger>
                                        </TabsList>
                                        {fields.map((field, index) => (
                                            <TabsContent value={`${index}`} key={field.id}>
                                                <div className="grid gap-3">
                                                    <FormField
                                                        control={threePartyForm.control}
                                                        name={`vendors.${index}.vendorName`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Vendor Name</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        placeholder="Enter vendor name"
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={threePartyForm.control}
                                                        name={`vendors.${index}.rate`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Rate</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="Enter rate"
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={threePartyForm.control}
                                                        name={`vendors.${index}.paymentTerm`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Payment Term</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        placeholder="Enter payment term"
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </TabsContent>
                                        ))}
                                    </Tabs>
                                    <FormField
                                        control={threePartyForm.control}
                                        name="comparisonSheet"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Comparison Sheet</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="file"
                                                        onChange={(e) =>
                                                            field.onChange(e.target.files?.[0])
                                                        }
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="outline">Close</Button>
                                        </DialogClose>

                                        <Button
                                            type="submit"
                                            disabled={threePartyForm.formState.isSubmitting}
                                        >
                                            {threePartyForm.formState.isSubmitting && (
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
                    ) : (
                        <DialogContent>
                            <Form {...regularForm}>
                                <form
                                    onSubmit={regularForm.handleSubmit(onSubmitRegular, onError)}
                                    className="space-y-5"
                                >
                                    <DialogHeader className="space-y-1">
                                        <DialogTitle>Regular Vendor</DialogTitle>
                                        <DialogDescription>
                                            Update vendor for{' '}
                                            <span className="font-medium">
                                                {selectedIndent.indentNo}
                                            </span>
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid grid-cols-3 bg-muted p-2 rounded-md ">
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
                                            control={regularForm.control}
                                            name="vendorName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <FormLabel>Vendor Name</FormLabel>
                                                        <FormControl>
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Select vendor" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {options?.vendors?.map(
                                                                ({ vendorName }, i) => (
                                                                    <SelectItem
                                                                        key={i}
                                                                        value={vendorName}
                                                                    >
                                                                        {vendorName}
                                                                    </SelectItem>
                                                                )
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={regularForm.control}
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
                                        <FormField
                                            control={regularForm.control}
                                            name="paymentTerm"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <FormLabel>Payment Term</FormLabel>
                                                        <FormControl>
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Select payment term" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {options?.paymentTerms?.map(
                                                                (term, i) => (
                                                                    <SelectItem
                                                                        key={i}
                                                                        value={term}
                                                                    >
                                                                        {term}
                                                                    </SelectItem>
                                                                )
                                                            )}
                                                        </SelectContent>
                                                    </Select>
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
                                            disabled={regularForm.formState.isSubmitting}
                                        >
                                            {regularForm.formState.isSubmitting && (
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
                    ))}

                {selectedHistory &&
                    selectedHistory.vendorType === "Regular" && (
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
    )
};