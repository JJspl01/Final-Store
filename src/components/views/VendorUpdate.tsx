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
import { postToSheet, uploadFile, fetchVendors, fetchFromSupabasePaginated } from '@/lib/fetchers';
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
import { useSheets } from '@/context/SheetsContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

interface VendorUpdateData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    vendorType: 'Three Party' | 'Regular';
    vendorName?: string;
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
    vendorName?: string;
}

export default () => {
    const { user } = useAuth();
    const { updateIndentSheet } = useSheets();

    const [selectedIndent, setSelectedIndent] = useState<VendorUpdateData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<HistoryData | null>(null);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [tableData, setTableData] = useState<VendorUpdateData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<HistoryData>>({});
    const [vendorSearch, setVendorSearch] = useState('');
    const [vendors, setVendors] = useState([]);
    const [vendorsLoading, setVendorsLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(true);

    useEffect(() => {
        const loadVendors = async () => {
            setVendorsLoading(true);
            const vendorsList = await fetchVendors();
            setVendors(vendorsList);
            setVendorsLoading(false);
        };
        loadVendors();
    }, []);

    // Fetching table data
    useEffect(() => {
        const fetchData = async () => {
            setDataLoading(true);
            try {
                // Fetch pending data with pagination
                const pendingData = await fetchFromSupabasePaginated(
                    'indent',
                    '*',
                    { column: 'created_at', options: { ascending: false } },
                    (q) => q.not('planned_2', 'is', null).is('actual_2', null)
                );

                if (pendingData) {
                    const pendingTableData = pendingData.map((record: any) => ({
                        indentNo: record.indent_number || '',
                        indenter: record.indenter_name || '',
                        department: record.department || '',
                        product: record.product_name || '',
                        quantity: record.approved_quantity || 0,
                        uom: record.uom || '',
                        vendorType: record.vendor_type as VendorUpdateData['vendorType'],
                        vendorName: record.approved_vendor_name || record.vendor_name_1 || '',
                    }));
                    setTableData(pendingTableData);
                }

                // Fetch history data with pagination
                const historyDataResult = await fetchFromSupabasePaginated(
                    'indent',
                    '*',
                    { column: 'created_at', options: { ascending: false } },
                    (q) => q.not('planned_2', 'is', null).not('actual_2', 'is', null)
                );

                if (historyDataResult) {
                    const historyTableData = historyDataResult.map((record: any) => ({
                        date: formatDate(new Date(record.actual_2)),
                        indentNo: record.indent_number || '',
                        indenter: record.indenter_name || '',
                        department: record.department || '',
                        product: record.product_name || '',
                        quantity: record.quantity || 0,
                        uom: record.uom || '',
                        rate: record.approved_rate || 0,
                        vendorType: record.vendor_type as HistoryData['vendorType'],
                        vendorName: record.approved_vendor_name || record.vendor_name_1 || '',
                    }));
                    setHistoryData(historyTableData);
                }
            } catch (error: any) {
                console.error('Error fetching data from Supabase:', error);
                toast.error('Failed to fetch data: ' + error.message);
            } finally {
                setDataLoading(false);
            }
        };

        fetchData();
    }, []);


    const handleEditClick = (row: HistoryData) => {
        setEditingRow(row.indentNo);
        setEditValues({
            quantity: row.quantity,
            uom: row.uom,
            vendorType: row.vendorType,
            rate: row.rate,
            product: row.product,
            vendorName: row.vendorName,
        });
    };


    const handleCancelEdit = () => {
        setEditingRow(null);
        setEditValues({});
    };

    const handleSaveEdit = async (indentNo: string) => {
        try {
            const updatePayload: any = {};

            if (editValues.quantity !== undefined) {
                updatePayload.quantity = editValues.quantity;
            }
            if (editValues.uom) {
                updatePayload.uom = editValues.uom;
            }
            if (editValues.vendorType) {
                updatePayload.vendor_type = editValues.vendorType;
            }
            if (editValues.rate !== undefined) {
                updatePayload.rate_1 = editValues.rate.toString();
                updatePayload.approved_rate = editValues.rate;
            }
            if (editValues.product) {
                updatePayload.product_name = editValues.product;
            }
            if (editValues.vendorName) {
                updatePayload.approved_vendor_name = editValues.vendorName;
                updatePayload.vendor_name_1 = editValues.vendorName;
            }

            const { error } = await supabase
                .from('indent')
                .update(updatePayload)
                .eq('indent_number', indentNo);

            if (error) throw error;

            toast.success(`Updated indent ${indentNo}`);
            updateIndentSheet(); // Update context to sync sidebar counts

            // Refresh the data after update
            const { data: historyDataResult, error: historyError } = await supabase
                .from('indent')
                .select('*')
                .not('planned_2', 'is', null)
                .not('actual_2', 'is', null)
                .order('created_at', { ascending: false });

            if (historyError) throw historyError;

            if (historyDataResult) {
                const historyTableData = historyDataResult.map((record: any) => ({
                    date: formatDate(new Date(record.actual_2)),
                    indentNo: record.indent_number || '',
                    indenter: record.indenter_name || '',
                    department: record.department || '',
                    product: record.product_name || '',
                    quantity: record.quantity || 0,
                    uom: record.uom || '',
                    rate: record.approved_rate || 0,
                    vendorType: record.vendor_type as HistoryData['vendorType'],
                    vendorName: record.approved_vendor_name || record.vendor_name_1 || '',
                }));
                setHistoryData(historyTableData);
            }

            setEditingRow(null);
            setEditValues({});
        } catch (error: any) {
            console.error('Error updating indent:', error);
            toast.error('Failed to update indent: ' + error.message);
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
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Input
                        value={editValues.product ?? row.original.product}
                        onChange={(e) => handleInputChange('product', e.target.value)}
                        className="w-[150px]"
                    />
                ) : (
                    <div className="max-w-[150px] break-words whitespace-normal flex items-center gap-2">
                        {row.original.product}
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
                const isEditing = editingRow === row.original.indentNo;
                const rate = row.original.rate;
                const vendorType = row.original.vendorType;

                if (!rate && vendorType === "Three Party") {
                    return (
                        <span className="text-muted-foreground">Not Decided</span>
                    )
                }

                return isEditing ? (
                    <Input
                        type="number"
                        value={editValues.rate ?? rate}
                        onChange={(e) => handleInputChange('rate', Number(e.target.value))}
                        className="w-20"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        &#8377;{rate}
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
            accessorKey: 'vendorName',
            header: 'Vendor Name',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Input
                        value={editValues.vendorName ?? row.original.vendorName}
                        onChange={(e) => handleInputChange('vendorName', e.target.value)}
                        className="w-[150px]"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        {row.original.vendorName}
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
            rate: undefined,
            paymentTerm: '',
        },
    });

    // const getCurrentFormattedDate = () => {
    //     const now = new Date();
    //     const day = String(now.getDate()).padStart(2, '0');
    //     const month = String(now.getMonth() + 1).padStart(2, '0');
    //     const year = now.getFullYear();
    //     const hours = String(now.getHours()).padStart(2, '0');
    //     const minutes = String(now.getMinutes()).padStart(2, '0');
    //     const seconds = String(now.getSeconds()).padStart(2, '0');
    //     return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    // };

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



    async function onSubmitRegular(values: z.infer<typeof regularSchema>) {
        try {
            const { error } = await supabase
                .from('indent')
                .update({
                    actual_2: getCurrentFormattedDateOnly(),
                    vendor_name_1: values.vendorName,
                    rate_1: values.rate.toString(),
                    payment_term_1: values.paymentTerm,
                    approved_vendor_name: values.vendorName,
                    approved_rate: values.rate,
                    approved_payment_term: values.paymentTerm,
                })
                .eq('indent_number', selectedIndent?.indentNo);

            if (error) throw error;

            toast.success(`Updated vendor of ${selectedIndent?.indentNo}`);
            updateIndentSheet(); // Update context to sync sidebar counts
            setOpenDialog(false);
            regularForm.reset();

            // Refresh the data after update
            const { data: pendingData, error: pendingError } = await supabase
                .from('indent')
                .select('*')
                .not('planned_2', 'is', null)
                .is('actual_2', null)
                .order('created_at', { ascending: false });

            if (pendingError) throw pendingError;

            if (pendingData) {
                const pendingTableData = pendingData.map((record: any) => ({
                    indentNo: record.indent_number || '',
                    indenter: record.indenter_name || '',
                    department: record.department || '',
                    product: record.product_name || '',
                    quantity: record.approved_quantity || 0,
                    uom: record.uom || '',
                    vendorType: record.vendor_type as VendorUpdateData['vendorType'],
                    vendorName: record.approved_vendor_name || record.vendor_name_1 || '',
                }));
                setTableData(pendingTableData);
            }
        } catch (error: any) {
            console.error('Error updating vendor:', error);
            toast.error('Failed to update vendor: ' + error.message);
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

            const { error } = await supabase
                .from('indent')
                .update({
                    actual_2: getCurrentFormattedDateOnly(),
                    vendor_name_1: values.vendors[0].vendorName,
                    rate_1: values.vendors[0].rate.toString(),
                    payment_term_1: values.vendors[0].paymentTerm,
                    vendor_name_2: values.vendors[1].vendorName,
                    rate_2: values.vendors[1].rate.toString(),
                    payment_term_2: values.vendors[1].paymentTerm,
                    vendor_name_3: values.vendors[2].vendorName,
                    rate_3: values.vendors[2].rate.toString(),
                    payment_term_3: values.vendors[2].paymentTerm,
                    comparison_sheet: url,
                })
                .eq('indent_number', selectedIndent?.indentNo);

            if (error) throw error;

            toast.success(`Updated vendors of ${selectedIndent?.indentNo}`);
            updateIndentSheet(); // Update context to sync sidebar counts
            setOpenDialog(false);
            threePartyForm.reset();

            // Refresh the data after update
            const { data: pendingData, error: pendingError } = await supabase
                .from('indent')
                .select('*')
                .not('planned_2', 'is', null)
                .is('actual_2', null)
                .order('created_at', { ascending: false });

            if (pendingError) throw pendingError;

            if (pendingData) {
                const pendingTableData = pendingData.map((record: any) => ({
                    indentNo: record.indent_number || '',
                    indenter: record.indenter_name || '',
                    department: record.department || '',
                    product: record.product_name || '',
                    quantity: record.approved_quantity || 0,
                    uom: record.uom || '',
                    vendorType: record.vendor_type as VendorUpdateData['vendorType'],
                    vendorName: record.approved_vendor_name || record.vendor_name_1 || '',
                }));
                setTableData(pendingTableData);
            }
        } catch (error: any) {
            console.error('Error updating vendor:', error);
            toast.error('Failed to update vendor: ' + error.message);
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
            const { error } = await supabase
                .from('indent')
                .update({
                    actual_2: getCurrentFormattedDateOnly(),
                    rate_1: values.rate.toString(),
                    approved_rate: values.rate,
                })
                .eq('indent_number', selectedHistory?.indentNo);

            if (error) throw error;

            toast.success(`Updated rate of ${selectedHistory?.indentNo}`);
            setOpenDialog(false);
            historyUpdateForm.reset({ rate: undefined });

            // Refresh the data after update with pagination
            const historyDataResult = await fetchFromSupabasePaginated(
                'indent',
                '*',
                { column: 'created_at', options: { ascending: false } },
                (q) => q.not('planned_2', 'is', null).not('actual_2', 'is', null)
            );

            if (historyDataResult) {
                const historyTableData = historyDataResult.map((record: any) => ({
                    date: formatDate(new Date(record.actual_2)),
                    indentNo: record.indent_number || '',
                    indenter: record.indenter_name || '',
                    department: record.department || '',
                    product: record.product_name || '',
                    quantity: record.quantity || 0,
                    uom: record.uom || '',
                    rate: record.approved_rate || 0,
                    vendorType: record.vendor_type as HistoryData['vendorType'],
                    vendorName: record.approved_vendor_name || record.vendor_name_1 || '',
                }));
                setHistoryData(historyTableData);
            }
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
                            searchFields={['product', 'department', 'indenter', 'vendorType', 'vendorName']}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['product', 'department', 'indenter', 'vendorType', 'vendorName']}
                            dataLoading={dataLoading}
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
                                                                <Select
                                                                    onValueChange={field.onChange}
                                                                    value={field.value}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger className="w-full">
                                                                            <SelectValue placeholder="Select vendor" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <div className="max-h-[300px] overflow-y-auto">
                                                                            {vendorsLoading ? (
                                                                                <div className="py-6 text-center text-sm text-muted-foreground">
                                                                                    Loading vendors...
                                                                                </div>
                                                                            ) : vendors?.length > 0 ? (
                                                                                vendors.map((vendor, i) => (
                                                                                    <SelectItem key={i} value={vendor.vendorName}>
                                                                                        {vendor.vendorName}
                                                                                    </SelectItem>
                                                                                ))
                                                                            ) : (
                                                                                <div className="py-6 text-center text-sm text-muted-foreground">
                                                                                    No vendors available
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </SelectContent>
                                                                </Select>
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
                                        {/* <FormField
                                            control={regularForm.control}
                                            name="vendorName"
                                            render={({ field }) => {
                                                const filteredVendors = options?.vendors?.filter(vendor =>
                                                    vendor.vendorName.toLowerCase().includes(vendorSearch.toLowerCase())
                                                );

                                                return (
                                                    <FormItem>
                                                        <FormLabel>Vendor Name</FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                            onOpenChange={(open) => {
                                                                if (!open) setVendorSearch(""); // Close hone pe search clear karo
                                                            }}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select vendor" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-2">
                                                                    <Input
                                                                        placeholder="Search vendors..."
                                                                        className="h-8 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                                                        value={vendorSearch}
                                                                        onChange={(e) => setVendorSearch(e.target.value)}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                    />
                                                                </div>
                                                                <div className="max-h-[200px] overflow-y-auto">
                                                                    {filteredVendors?.map((vendor, i) => (
                                                                        <SelectItem key={i} value={vendor.vendorName}>
                                                                            {vendor.vendorName}
                                                                        </SelectItem>
                                                                    ))}
                                                                    {filteredVendors?.length === 0 && (
                                                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                                                            No vendors found
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                );
                                            }}
                                        /> */}

                                        <FormField
                                            control={regularForm.control}
                                            name="vendorName"
                                            render={({ field }) => {
                                                const filteredVendors = vendors?.filter(vendor =>
                                                    vendor.vendorName.toLowerCase().includes(vendorSearch.toLowerCase())
                                                );

                                                return (
                                                    <FormItem>
                                                        <FormLabel>Vendor Name</FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                            onOpenChange={(open) => {
                                                                if (!open) setVendorSearch("");
                                                            }}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select vendor" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-2">
                                                                    <Input
                                                                        placeholder="Search vendors..."
                                                                        className="h-8 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                                                        value={vendorSearch}
                                                                        onChange={(e) => setVendorSearch(e.target.value)}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                    />
                                                                </div>
                                                                <div className="max-h-[200px] overflow-y-auto">
                                                                    {vendorsLoading ? (
                                                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                                                            Loading vendors...
                                                                        </div>
                                                                    ) : filteredVendors?.length > 0 ? (
                                                                        filteredVendors.map((vendor, i) => (
                                                                            <SelectItem key={i} value={vendor.vendorName}>
                                                                                {vendor.vendorName}
                                                                            </SelectItem>
                                                                        ))
                                                                    ) : (
                                                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                                                            No vendors found
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                );
                                            }}
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
                                                            {[
                                                                "Immediate Payment",
                                                                "Net 30 Days",
                                                                "Net 60 Days",
                                                                "Net 90 Days",
                                                                "Other"
                                                            ].map((term, i) => (
                                                                <SelectItem
                                                                    key={i}
                                                                    value={term}
                                                                >
                                                                    {term}
                                                                </SelectItem>
                                                            ))}
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