import { useEffect, useState } from 'react';
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
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useSheets } from '@/context/SheetsContext';
import { Button } from '../ui/button';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { postToSheet } from '@/lib/fetchers';
import { PackageCheck } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate } from '@/lib/utils';
import { Pill } from '../ui/pill';
import { DownloadOutlined } from "@ant-design/icons";
import * as XLSX from 'xlsx';
import { EditOutlined, SaveOutlined } from "@ant-design/icons";

interface StoreOutTableData {
    indentNo: string;
    department: string;
    product: string;
    date: string;
    indenter: string;
    areaOfUse: string;
    quantity: number;
    uom: string;
    specifications: string;
    attachment: string;
}
interface HistoryData {
    approvalDate: string;
    indentNo: string;
    department: string;
    product: string;
    date: string;
    indenter: string;
    areaOfUse: string;
    quantity: number;
    uom: string;
    issuedStatus: string;
    requestedQuantity: number;
}

export default () => {
    const { indentSheet, indentLoading, updateIndentSheet } = useSheets();
    const { user } = useAuth();
    const [openDialog, setOpenDialog] = useState(false);
    const [tableData, setTableData] = useState<StoreOutTableData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [selectedIndent, setSelectedIndent] = useState<StoreOutTableData | null>(null);
    const [rejecting, setRejecting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<{
        quantity?: number;
        requestedQuantity?: number;
        indentNo?: string;
        department?: string;
        product?: string;
    }>({});

    const [editingField, setEditingField] = useState<"quantity" | "requestedQuantity" | null>(null);



    const handleSaveEdit = async (row: HistoryData) => {
        try {
            await postToSheet(
                indentSheet
                    .filter(s => s.indentNumber === row.indentNo)
                    .map(prev => ({
                        ...prev,
                        issuedQuantity: editValues.quantity,         // Issued Quantity goes here
                        quantity: editValues.requestedQuantity,      // Requested Quantity goes here
                    })),
                "update"
            );
            toast.success(`Updated ${row.indentNo}`);
            setEditingRow(null);
            setEditValues({});
            setTimeout(() => updateIndentSheet(), 1000);
        } catch {
            toast.error("Failed to update row");
        }
    };



    // Fetching table data
    useEffect(() => {
        setTableData(
            indentSheet
                .filter(
                    (sheet) =>
                        sheet.planned6 !== '' &&
                        sheet.actual6 === '' &&
                        sheet.indentType === 'Store Out'
                )
                .map((sheet) => ({
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    date: formatDate(new Date(sheet.timestamp)),
                    areaOfUse: sheet.areaOfUse,
                    quantity: sheet.quantity,
                    uom: sheet.uom,
                    specifications: sheet.specifications || 'Not specified',
                    attachment: sheet.attachment || '',
                }))
        );
        setHistoryData(
            indentSheet
                .filter(
                    (sheet) =>
                        sheet.planned6 !== '' &&
                        sheet.actual6 !== '' &&
                        sheet.indentType === 'Store Out'
                )
                .map((sheet) => ({
                    approvalDate: formatDate(new Date(sheet.actual6)),
                    indentNo: sheet.indentNumber,
                    indenter: sheet.indenterName,
                    department: sheet.department,
                    product: sheet.productName,
                    date: formatDate(new Date(sheet.timestamp)),
                    areaOfUse: sheet.areaOfUse,
                    quantity: sheet.issuedQuantity,
                    requestedQuantity: sheet.quantity,
                    uom: sheet.uom,
                    issuedStatus: sheet.issueStatus,
                }))
        );
    }, [indentSheet]);

    // Add this function inside your component, before the return statement
    const onDownloadClick = async () => {
        setLoading(true);
        try {
            // Create a new workbook
            const workbook = XLSX.utils.book_new();

            // Convert table data to worksheet format
            const worksheetData = tableData.map(item => ({
                'Indent No.': item.indentNo,
                'Indenter': item.indenter,
                'Department': item.department,
                'Item': item.product,
                'Date': item.date,
                'Area of Use': item.areaOfUse,
                'Quantity': item.quantity,
                'UOM': item.uom,
                'Specifications': item.specifications,
                'Attachment': item.attachment || 'No attachment'
            }));

            // Create worksheet from data
            const worksheet = XLSX.utils.json_to_sheet(worksheetData);

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Store Out Pending');

            // Generate filename with current date
            const currentDate = new Date().toISOString().split('T')[0];
            const filename = `Store_Out_Pending_${currentDate}.xlsx`;

            // Write and download the file
            XLSX.writeFile(workbook, filename);

            toast.success('Excel file downloaded successfully!');
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to download Excel file');
        } finally {
            setLoading(false);
        }
    };

    // Creating table columns
    const columns: ColumnDef<StoreOutTableData>[] = [
        ...(user.storeOutApprovalAction
            ? [
                {
                    header: 'Actions',
                    id: 'actions',
                    cell: ({ row }: { row: Row<StoreOutTableData> }) => {
                        const indent = row.original;

                        return (
                            <div className="flex justify-center">
                                <Button
                                    variant="default"
                                    disabled={rejecting}
                                    onClick={async () => {
                                        setRejecting(true);
                                        try {
                                            await postToSheet(
                                                indentSheet
                                                    .filter((s) => s.indentNumber === indent.indentNo)
                                                    .map((prev) => ({
                                                        ...prev,
                                                        actual6: new Date().toISOString(),
                                                        issueStatus: 'Done', // 👈 ab sirf Done hoga
                                                        issuedQuantity: indent.quantity,
                                                    })),
                                                'update'
                                            );

                                            toast.success(
                                                `Marked ${indent.indentNo} as Done`
                                            );
                                            setTimeout(() => updateIndentSheet(), 1000);
                                        } catch {
                                            toast.error('Failed to update status');
                                        } finally {
                                            setRejecting(false);
                                        }
                                    }}
                                >
                                    {rejecting && (
                                        <Loader
                                            size={20}
                                            color="white"
                                            aria-label="Loading Spinner"
                                        />
                                    )}
                                    Done
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
        { accessorKey: 'product', header: 'Item' },
        { accessorKey: 'date', header: 'Date' },
        { accessorKey: 'specifications', header: 'Specifications' },
        {
            accessorKey: 'attachment',
            header: 'Attachment',
            cell: ({ row }) => {
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
    ];


    const historyColumns: ColumnDef<HistoryData>[] = [
        {
            header: "Edit",
            id: "edit",
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <div className="flex gap-1">
                        <Button
                            size="sm"
                            onClick={() => handleSaveEdit(row.original)}
                            className="flex items-center gap-1"
                        >
                            <SaveOutlined /> Save
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setEditingRow(null);
                                setEditValues({});
                            }}
                            className="flex items-center gap-1"
                        >
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            setEditingRow(row.original.indentNo);
                            setEditValues({
                                quantity: row.original.quantity,
                                requestedQuantity: row.original.requestedQuantity,
                                indentNo: row.original.indentNo,
                                department: row.original.department,
                                product: row.original.product,
                            });
                            setEditingField("quantity"); // Default focus on quantity
                        }}
                    >
                        <EditOutlined /> Edit
                    </Button>

                );
            },
        },

        { accessorKey: "indentNo", header: "Indent No." },
        { accessorKey: "indenter", header: "Indenter" },
        { accessorKey: "department", header: "Department" },
        { accessorKey: "product", header: "Item" },
        { accessorKey: "uom", header: "UOM" },

        // 👇 Issued Quantity editable banaya


        // 2. Update the input cells to use a more stable approach:
        {
            accessorKey: "quantity",
            header: "Issued Quantity",
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                if (isEditing) {
                    return (
                        <Input
                            type="number"
                            value={editValues.quantity ?? ""}
                            onChange={e =>
                                setEditValues(prev => ({
                                    ...prev,
                                    quantity: e.target.value === "" ? undefined : Number(e.target.value)
                                }))
                            }
                            autoFocus={editingField === "quantity"}
                            onFocus={() => setEditingField("quantity")}
                        />
                    );
                }
                return row.original.quantity;
            },
        },
        {
            accessorKey: "requestedQuantity",
            header: "Requested Quantity",
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                if (isEditing) {
                    return (
                        <Input
                            type="number"
                            value={editValues.requestedQuantity ?? ""}
                            onChange={e =>
                                setEditValues(prev => ({
                                    ...prev,
                                    requestedQuantity: e.target.value === "" ? undefined : Number(e.target.value)
                                }))
                            }
                            autoFocus={editingField === "requestedQuantity"}
                            onFocus={() => setEditingField("requestedQuantity")}
                        />
                    );
                }
                return row.original.requestedQuantity;
            },
        },


        { accessorKey: "date", header: "Request Date" },
        { accessorKey: "approvalDate", header: "Approval Date" },
        {
            accessorKey: "issuedStatus",
            header: "Issued Status",
            cell: ({ row }) => {
                const status = row.original.issuedStatus;
                const variant = status === "Rejected" ? "reject" : "secondary";
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
    ];


    // Create approval form
    const schema = z.object({
        approvedBy: z.string().nonempty(),
        approvalDate: z.date(),
        issuedQuantity: z.number(),
        notes: z.string().optional(),
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            approvalDate: undefined,
            approvedBy: '',
            notes: '',
            issuedQuantity: undefined,
        },
    });

    useEffect(() => {
        if (selectedIndent) {
            form.reset({
                issuedQuantity: selectedIndent.quantity,
            });
        }
        form.reset();
    }, [selectedIndent]);

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            await postToSheet(
                indentSheet
                    .filter((s) => s.indentNumber === selectedIndent?.indentNo)
                    .map((prev) => ({
                        ...prev,
                        actual6: values.approvalDate?.toISOString() ?? new Date().toISOString(),
                        issueApprovedBy: values.approvedBy,
                        issueStatus: 'Approved',
                        issuedQuantity: values.issuedQuantity,
                    })),
                'update'
            );
            toast.success(`Updated store out approval status of ${selectedIndent?.indentNo}`);
            setOpenDialog(false);
            form.reset();
            setTimeout(() => updateIndentSheet(), 1000);
        } catch {
            toast.error('Failed to update status');
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }


    return (
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <Tabs defaultValue="pending">
                <Heading heading="Store Out Approval" subtext="Approve store out requests" tabs>
                    <PackageCheck size={50} className="text-primary" />
                </Heading>
                <TabsContent value="pending">
                    <DataTable
                        data={tableData}
                        columns={columns}
                        searchFields={['product', 'department', 'indenter', 'vendorType']}
                        dataLoading={indentLoading}
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
                {/* <TabsContent value="pending">
                    <DataTable
                        data={tableData}
                        columns={columns}
                        searchFields={['product', 'department', 'indenter']}
                        dataLoading={indentLoading}
                    />
                </TabsContent> */}
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
                <DialogContent className="sm:max-w-3xl">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-5">
                            <DialogHeader className="space-y-1">
                                <DialogTitle>Approve Store Out Request</DialogTitle>
                                <DialogDescription>
                                    Approve Store Out Request{' '}
                                    <span className="font-medium">{selectedIndent.indentNo}</span>
                                </DialogDescription>
                            </DialogHeader>
                            <div className="bg-muted p-4 rounded-md grid gap-3">
                                <h3 className="text-lg font-bold">Request Details</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 bg-muted rounded-md gap-3 ">
                                    <div className="space-y-1">
                                        <p className="font-medium">Indenter</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.indenter}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium text-nowrap">Department</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.department}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium text-nowrap">Area of Use</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.areaOfUse}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium text-nowrap">Date</p>
                                        <p className="text-sm font-light">{selectedIndent.date}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-muted p-4 rounded-md grid gap-3">
                                <h3 className="text-lg font-bold">Item Details</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 bg-muted rounded-md gap-3 ">
                                    <div className="space-y-1">
                                        <p className="font-medium">Item Name</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.product}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium text-nowrap">Quantity</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.quantity}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium text-nowrap">UOM</p>
                                        <p className="text-sm font-light">{selectedIndent.uom}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium text-nowrap">Specifications</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.specifications}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="approvedBy"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Approved By</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter approved by" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="issuedQuantity"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Issue Quantity</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="Enter quantity to be issued"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="approvalDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Approval Date</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="date"
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
                            </div>

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem className="w-full">
                                        <FormLabel>Notes</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Enter notes"
                                                className="resize-y" // or "resize-y" to allow vertical resizing
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

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
    );
};
