import { type ColumnDef, type Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useEffect, useState } from 'react';
import { useSheets } from '@/context/SheetsContext';
import { DownloadOutlined } from "@ant-design/icons";

import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Dialog } from '@radix-ui/react-dialog';
import { z } from 'zod';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { postToSheet } from '@/lib/fetchers';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { Tabs, TabsContent } from '../ui/tabs';
import { ClipboardCheck, PenSquare } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { Input } from '../ui/input';

const statuses = ['Pending', 'Reject', 'Three Party', 'Regular'];

interface ApproveTableData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    vendorType: 'Pending' | 'Reject' | 'Three Party' | 'Regular';
    date: string;
    attachment: string;
    specifications: string;
}

interface HistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    uom: string;
    approvedQuantity: number;
    vendorType: 'Reject' | 'Three Party' | 'Regular';
    date: string;
    approvedDate: string;
    specifications: string;
    lastUpdated?: string;
}

export default () => {
    const { indentSheet, indentLoading, updateIndentSheet } = useSheets();
    const { user } = useAuth();

    const [selectedIndent, setSelectedIndent] = useState<ApproveTableData | null>(null);
    const [tableData, setTableData] = useState<ApproveTableData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<HistoryData>>({});
    const [loading, setLoading] = useState(false);

    // Fetching table data
    useEffect(() => {
        setTableData(
            indentSheet
                .filter(
                    (sheet) =>
                        sheet.planned1 !== '' &&
                        sheet.actual1 === '' &&
                        sheet.indentType === 'Purchase'
                )
                .map((sheet) => ({
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    quantity: sheet.quantity,
                    uom: sheet.uom,
                    attachment: sheet.attachment,
                    specifications: sheet.specifications || '',
                    vendorType: statuses.includes(sheet.vendorType)
                        ? (sheet.vendorType as ApproveTableData['vendorType'])
                        : 'Pending',
                    date: formatDate(new Date(sheet.timestamp)),
                }))
        );
        setHistoryData(
            indentSheet
                .filter(
                    (sheet) =>
                        sheet.planned1 !== '' &&
                        sheet.actual1 !== '' &&
                        sheet.indentType === 'Purchase'
                )
                .map((sheet) => ({
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    approvedQuantity: sheet.approvedQuantity || sheet.quantity,
                    vendorType: sheet.vendorType as HistoryData['vendorType'],
                    uom: sheet.uom,
                    specifications: sheet.specifications || '',
                    date: formatDate(new Date(sheet.timestamp)),
                    approvedDate: formatDate(new Date(sheet.actual1)),
                    // lastUpdated: sheet.lastUpdated,
                }))
                // Sort by indentNo in descending order (newest first)
                .sort((a, b) => {
                    return b.indentNo.localeCompare(a.indentNo);
                })
        );
    }, [indentSheet]);

    const handleDownload = (data: any[]) => {
        if (!data || data.length === 0) {
            toast.error("No data to download");
            return;
        }

        // Column headers
        const headers = Object.keys(data[0]);

        // CSV rows
        const csvRows = [
            headers.join(","),
            ...data.map(row =>
                headers.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
            )
        ];

        const csvContent = csvRows.join("\n");

        // Blob create & download trigger
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `pending-indents-${Date.now()}.csv`); // CSV extension
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    const onDownloadClick = async () => {
        setLoading(true);
        try {
            await handleDownload(tableData); // agar async function hai
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (row: HistoryData) => {
        setEditingRow(row.indentNo);
        setEditValues({
            approvedQuantity: row.approvedQuantity,
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
                        approvedQuantity: editValues.approvedQuantity,
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
    const columns: ColumnDef<ApproveTableData>[] = [
        ...(user.indentApprovalAction
            ? [
                {
                    header: 'Action',
                    id: 'action',
                    cell: ({ row }: { row: Row<ApproveTableData> }) => {
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
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        { accessorKey: 'quantity', header: 'Quantity' },
        { accessorKey: 'uom', header: 'UOM' },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ row, getValue }) => {
                const [value, setValue] = useState(getValue() as string);
                const indentNo = row.original.indentNo;

                const handleBlur = async () => {
                    try {
                        await postToSheet(
                            indentSheet
                                .filter((s) => s.indentNumber === indentNo)
                                .map((prev) => ({
                                    ...prev,
                                    specifications: value,
                                })),
                            'update'
                        );
                        toast.success(`Updated specifications for ${indentNo}`);
                        updateIndentSheet();
                    } catch {
                        toast.error('Failed to update specifications');
                    }
                };

                return (
                    <div className="max-w-[150px]">
                        <Input
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onBlur={handleBlur}
                            className="border-none focus:border-1"
                        />
                    </div>
                );
            },
        },
        {
            accessorKey: 'vendorType',
            header: 'Status',
            cell: ({ row }: { row: Row<ApproveTableData> }) => {
                const status = row.original.vendorType;
                return <Pill variant="pending">{status}</Pill>;
            },
        },
        {
            accessorKey: 'attachment',
            header: 'Attachment',
            cell: ({ row }: { row: Row<ApproveTableData> }) => {
                const attachment = row.original.attachment;
                return attachment ? (
                    <a href={attachment} target="_blank">
                        Attachment
                    </a>
                ) : (
                    <></>
                );
            },
        },
        { accessorKey: 'date', header: 'Date' },
    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
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
            accessorKey: 'approvedQuantity',
            header: 'Quantity',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Input
                        type="number"
                        value={editValues.approvedQuantity ?? row.original.approvedQuantity}
                        onChange={(e) => handleInputChange('approvedQuantity', Number(e.target.value))}
                        className="w-20"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        {row.original.approvedQuantity}
                        {user.indentApprovalAction && (
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
                        {user.indentApprovalAction && editingRow !== row.original.indentNo && (
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
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
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
                            <SelectItem value="Reject">Reject</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="flex items-center gap-2">
                        <Pill
                            variant={
                                row.original.vendorType === 'Reject'
                                    ? 'reject'
                                    : row.original.vendorType === 'Regular'
                                        ? 'primary'
                                        : 'secondary'
                            }
                        >
                            {row.original.vendorType}
                        </Pill>
                        {user.indentApprovalAction && editingRow !== row.original.indentNo && (
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
        { accessorKey: 'date', header: 'Request Date' },
        { accessorKey: 'approvedDate', header: 'Approval Date' },
        ...(user.indentApprovalAction
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

    // Creating Form
    const schema = z
        .object({
            approval: z.enum(['Reject', 'Three Party', 'Regular']),
            approvedQuantity: z.coerce.number().optional(),
        })
        .superRefine((data, ctx) => {
            if (data.approval !== 'Reject') {
                if (!data.approvedQuantity || data.approvedQuantity === 0) {
                    ctx.addIssue({
                        path: ['approvedQuantity'],
                        code: z.ZodIssueCode.custom,
                    });
                }
            }
        });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { approvedQuantity: undefined, approval: undefined },
    });

    const approval = form.watch('approval');

    useEffect(() => {
        if (selectedIndent) {
            form.setValue("approvedQuantity", selectedIndent.quantity)
        }
    }, [selectedIndent]);

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            await postToSheet(
                indentSheet
                    .filter((s) => s.indentNumber === selectedIndent?.indentNo)
                    .map((prev) => ({
                        ...prev,
                        vendorType: values.approval,
                        approvedQuantity: values.approvedQuantity,
                        actual1: new Date().toISOString(),
                        lastUpdated: new Date().toISOString(), // This ensures newly approved items appear at top
                    })),
                'update'
            );
            toast.success(`Updated approval status of ${selectedIndent?.indentNo}`);
            setOpenDialog(false);
            form.reset();
            setTimeout(() => updateIndentSheet(), 1000);
        } catch {
            toast.error('Failed to approve indent');
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
                        heading="Approve Indent"
                        subtext="Update Indent status to Approve or Reject them"
                        tabs
                    >
                        <ClipboardCheck size={50} className="text-primary" />
                    </Heading>
                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['product', 'department', 'indenter', 'vendorType']}
                            dataLoading={indentLoading}
                            extraActions={
                                <Button
                                    variant="default"  // or "outline", "secondary", etc. based on your design
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
                            searchFields={['product', 'department', 'indenter', 'vendorType']}
                            dataLoading={indentLoading}
                        />
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent>
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="grid gap-5"
                            >
                                <DialogHeader className="grid gap-2">
                                    <DialogTitle>Approve Indent</DialogTitle>
                                    <DialogDescription>
                                        Approve indent{' '}
                                        <span className="font-medium">
                                            {selectedIndent.indentNo}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="grid gap-3">
                                    <FormField
                                        control={form.control}
                                        name="approval"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Vendor Type</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select approval status" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Regular">
                                                            Regular
                                                        </SelectItem>
                                                        <SelectItem value="Three Party">
                                                            Three Party
                                                        </SelectItem>
                                                        <SelectItem value="Reject">
                                                            Reject
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="approvedQuantity"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Quantity</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        disabled={approval === 'Reject'}
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
                                        Approve
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