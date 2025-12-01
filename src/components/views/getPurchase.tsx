
import { useSheets } from '@/context/SheetsContext';
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
}


interface HistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    poNumber: string;
    billStatus: string;
    date: string;
}

// New interface for showing all products with same PO
interface ProductDetail {
    indentNo: string;
    product: string;
    quantity: number;
    uom: string;
    rate: number;
    qty?: number;
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
    const [openDialog, setOpenDialog] = useState(false);
    const [rateOptions, setRateOptions] = useState<string[]>([]);
    const [relatedProducts, setRelatedProducts] = useState<ProductDetail[]>([]);
const [productRates, setProductRates] = useState<{ [indentNo: string]: number }>({});
const [productQty, setProductQty] = useState<{ [indentNo: string]: number }>({});
const [editingRow, setEditingRow] = useState<string | null>(null);
const [editedData, setEditedData] = useState<{ [indentNo: string]: EditedData }>({});




const inputRefs = useRef<{[key: string]: HTMLInputElement | null}>({});


// const [editedData, setEditedData] = useState<{ product?: string; quantity?: number; uom?: string }>({});
// const [editedData, setEditedData] = useState<{ [indentNo: string]: { product?: string; quantity?: number; uom?: string; qty?: number; billNumber?: string; leadTime?: string; typeOfBill?: string; billAmount?: number; discountAmount?: number; paymentType?: string; advanceAmount?: number; rate?: number; photoOfBill?: string } }>({});
  // Fetching table data - updated
useEffect(() => {
    // Unique PO numbers ke liye Set use karo
    const seenPoNumbers = new Set();
    
    const uniqueTableData = indentSheet
        .filter((sheet) => sheet.planned7 !== '' && sheet.actual7 == '')
        .filter((sheet) => {
            // Agar PO number pehle se nahi dekha hai toh include karo
            if (!sheet.poNumber || seenPoNumbers.has(sheet.poNumber)) {
                return false;
            }
            seenPoNumbers.add(sheet.poNumber);
            return true;
        })
        .map((sheet) => ({
            indentNo: sheet.indentNumber,
            indenter: sheet.indenterName,
            department: sheet.department,
            product: sheet.productName,
            quantity: sheet.approvedQuantity,
            uom: sheet.uom,
            poNumber: sheet.poNumber,
            approvedRate: sheet.approvedRate
        }))
        .reverse();

    setTableData(uniqueTableData);

    // History data (yahan unique nahi karna kyunki history me sab dikhna chahiye)
    setHistoryData(
        indentSheet
            .filter((sheet) => sheet.planned7 !== '' && sheet.actual7 !== '')
            .map((sheet) => ({
                date: formatDate(new Date(sheet.actual5)),
                indentNo: sheet.indentNumber,
                indenter: sheet.indenterName,
                department: sheet.department,
                product: sheet.productName,
                quantity: sheet.approvedQuantity,
                uom: sheet.uom,
                poNumber: sheet.poNumber,
                billStatus: sheet.billStatus || 'Not Updated',
            }))
            .sort((a, b) => b.indentNo.localeCompare(a.indentNo))
    );
}, [indentSheet]);

  // Fetch related products when dialog opens
useEffect(() => {
    if (selectedIndent && openDialog) {
        const matchingRows = indentSheet.filter(
            (sheet) => sheet.poNumber === selectedIndent.poNumber
        );

        const products = matchingRows.map((sheet) => ({
            indentNo: sheet.indentNumber,
            product: sheet.productName,
            quantity: sheet.approvedQuantity,
            uom: sheet.uom,
             rate: sheet.approvedRate, // Include existing rate
             qty: sheet.qty || 0,
        }));
        
        setRelatedProducts(products);
        
        // Initialize productRates state with existing rates
        const ratesMap: { [indentNo: string]: number } = {};
        products.forEach(p => {
            ratesMap[p.indentNo] = p.rate;
        });
        setProductRates(ratesMap);
    }
}, [selectedIndent, openDialog, indentSheet]);
const handleQtyChange = (indentNo: string, value: string) => {
    setProductQty((prev) => ({
        ...prev,
        [indentNo]: parseFloat(value) || 0,
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
            header: 'Quantity',
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
            header: 'Action',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return (
                    <div className="flex gap-2">
                    {isEditing ? (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                    try {
                                        const sheetRow = indentSheet.find(s => s.indentNumber === row.original.indentNo);
                                        if (sheetRow) {
                                            const { timestamp, actual4, poNumber, poCopy, ...safeData } = sheetRow;
                                            const currentEdit = editedData[row.original.indentNo];
                                
                                            let photoUrl = sheetRow.photoOfBill || '';
                                
                                            // agar naya file select hua hai to upload karo
                                            if (currentEdit?.photoOfBillFile) {
                                                photoUrl = await uploadFile(
                                                    currentEdit.photoOfBillFile,
                                                    import.meta.env.VITE_BILL_PHOTO_FOLDER || 'bill-photos'
                                                );
                                            }
                                
                                            await postToSheet(
                                                [
                                                    {
                                                        ...safeData,
                                                        productName: currentEdit?.product || row.original.product,
                                                        quantity: currentEdit?.quantity || row.original.quantity,
                                                        approvedQuantity: currentEdit?.quantity || row.original.quantity,
                                                        uom: currentEdit?.uom || row.original.uom,
                                                        qty: currentEdit?.qty || row.original.quantity,
                                                        billNumber: currentEdit?.billNumber || sheetRow.billNumber || '',
                                                        leadTimeToLiftMaterial: currentEdit?.leadTime || sheetRow.leadTimeToLiftMaterial || '',
                                                        typeOfBill: currentEdit?.typeOfBill || sheetRow.typeOfBill || '',
                                                        billAmount: currentEdit?.billAmount || sheetRow.billAmount || 0,
                                                        discountAmount: currentEdit?.discountAmount || sheetRow.discountAmount || 0,
                                                        paymentType: currentEdit?.paymentType || sheetRow.paymentType || '',
                                                        advanceAmountIfAny: currentEdit?.advanceAmount || sheetRow.advanceAmountIfAny || 0,
                                                        rate: currentEdit?.rate || sheetRow.rate || sheetRow.approvedRate || 0,
                                                        photoOfBill: photoUrl, // 👈 yahan updated URL save hoga
                                                    },
                                                ],
                                                'update'
                                            );
                                
                                            toast.success('Updated successfully');
                                            setTimeout(() => updateIndentSheet(), 1000);
                                        }
                                    } catch {
                                        toast.error('Failed to update');
                                    }
                                    setEditingRow(null);
                                    setEditedData({});
                                }}
                                
                            >
                                💾 Save
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setEditingRow(null);
                                    setEditedData({});
                                }}
                            >
                                ❌ Cancel
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setEditingRow(row.original.indentNo);
                                setEditedData(prev => ({
                                    ...prev,
                                    [row.original.indentNo]: {
                                        product: row.original.product,
                                        quantity: row.original.quantity,
                                        uom: row.original.uom,
                                        qty: row.original.quantity,
                                        billNumber: indentSheet.find(s => s.indentNumber === row.original.indentNo)?.billNumber || '',
                                        leadTime: indentSheet.find(s => s.indentNumber === row.original.indentNo)?.leadTimeToLiftMaterial || '',
                                        typeOfBill: indentSheet.find(s => s.indentNumber === row.original.indentNo)?.typeOfBill || '',
                                        billAmount: indentSheet.find(s => s.indentNumber === row.original.indentNo)?.billAmount || 0,
                                        discountAmount: indentSheet.find(s => s.indentNumber === row.original.indentNo)?.discountAmount || 0,
                                        paymentType: indentSheet.find(s => s.indentNumber === row.original.indentNo)?.paymentType || '',
                                        advanceAmount: indentSheet.find(s => s.indentNumber === row.original.indentNo)?.advanceAmountIfAny || 0,
                                        rate: indentSheet.find(s => s.indentNumber === row.original.indentNo)?.approvedRate || 0,
                                    }
                                }));
                            }}
                        >
                            ✏️ Edit
                        </Button>
                    )}
                    </div>
                );
            },
        },
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
                return (
                    <div className="flex items-center gap-2 max-w-[150px]">
                    {isEditing ? (
                        <Input
                        key={row.original.indentNo}
                            value={editedData[row.original.indentNo]?.product || ''}
                            onChange={(e) => {
                                setEditedData(prev => ({
                                    ...prev,
                                    [row.original.indentNo]: {
                                        ...prev[row.original.indentNo],
                                        product: e.target.value,
                                    }
                                }));
                            }}
                            className="h-8"
                        />
                    ) : (
                        <div className="break-words whitespace-normal">{row.original.product}</div>
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
                        value={editedData[row.original.indentNo]?.quantity || 0}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [row.original.indentNo]: {
                                    ...prev[row.original.indentNo],
                                    quantity: parseFloat(e.target.value) || 0,
                                }
                            }));
                        }}
                        className="h-8 w-20"
                    />
                ) : (
                    row.original.quantity
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
                        value={editedData[row.original.indentNo]?.uom || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [row.original.indentNo]: {
                                    ...prev[row.original.indentNo],
                                    uom: e.target.value,
                                }
                            }));
                        }}
                        className="h-8 w-20"
                    />
                ) : (
                    row.original.uom
                );
            },
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
        },
        // Editable columns BF to BO
        {
            id: 'billNumber',
            header: 'Bill Number',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                const sheetRow = indentSheet.find(s => s.indentNumber === row.original.indentNo);
                return isEditing ? (
                    <Input
                        value={editedData[row.original.indentNo]?.billNumber || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [row.original.indentNo]: {
                                    ...prev[row.original.indentNo],
                                    billNumber: e.target.value,
                                }
                            }));
                        }}
                        className="h-8 w-full"
                    />
                ) : (
                    sheetRow?.billNumber || '-'
                );
            },
        },
        {
            id: 'qty',
            header: 'Qty',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                const sheetRow = indentSheet.find(s => s.indentNumber === row.original.indentNo);
                return isEditing ? (
                    <Input
                        type="number"
                        value={editedData[row.original.indentNo]?.qty || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [row.original.indentNo]: {
                                    ...prev[row.original.indentNo],
                                    qty: parseFloat(e.target.value) || 0,
                                }
                            }));
                        }}
                        className="h-8 w-20"
                    />
                ) : (
                    sheetRow?.qty || row.original.quantity
                );
            },
        },
        {
            id: 'leadTime',
            header: 'Lead Time',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                const sheetRow = indentSheet.find(s => s.indentNumber === row.original.indentNo);
                return isEditing ? (
                    <Input
                        value={editedData[row.original.indentNo]?.leadTime || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [row.original.indentNo]: {
                                    ...prev[row.original.indentNo],
                                    leadTime: e.target.value,
                                }
                            }));
                        }}
                        className="h-8 w-full"
                    />
                ) : (
                    sheetRow?.leadTimeToLiftMaterial || '-'
                );
            },
        },
        {
            id: 'typeOfBill',
            header: 'Type Of Bill',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                const sheetRow = indentSheet.find(s => s.indentNumber === row.original.indentNo);
                return isEditing ? (
                    <Input
                        value={editedData[row.original.indentNo]?.typeOfBill || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [row.original.indentNo]: {
                                    ...prev[row.original.indentNo],
                                    typeOfBill: e.target.value,
                                }
                            }));
                        }}
                        className="h-8 w-full"
                    />
                ) : (
                    sheetRow?.typeOfBill || '-'
                );
            },
        },
        {
            id: 'billAmount',
            header: 'Bill Amount',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                const sheetRow = indentSheet.find(s => s.indentNumber === row.original.indentNo);
                return isEditing ? (
                    <Input
                        type="number"
                        value={editedData[row.original.indentNo]?.billAmount || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [row.original.indentNo]: {
                                    ...prev[row.original.indentNo],
                                    billAmount: parseFloat(e.target.value) || 0,
                                }
                            }));
                        }}
                        className="h-8 w-24"
                    />
                ) : (
                    sheetRow?.billAmount ? `₹${sheetRow.billAmount}` : '-'
                );
            },
        },
        {
            id: 'discountAmount',
            header: 'Discount Amt',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                const sheetRow = indentSheet.find(s => s.indentNumber === row.original.indentNo);
                return isEditing ? (
                    <Input
                        type="number"
                        value={editedData[row.original.indentNo]?.discountAmount || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [row.original.indentNo]: {
                                    ...prev[row.original.indentNo],
                                    discountAmount: parseFloat(e.target.value) || 0,
                                }
                            }));
                        }}
                        className="h-8 w-24"
                    />
                ) : (
                    sheetRow?.discountAmount ? `₹${sheetRow.discountAmount}` : '-'
                );
            },
        },
        {
            id: 'paymentType',
            header: 'Payment Type',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                const sheetRow = indentSheet.find(s => s.indentNumber === row.original.indentNo);
                return isEditing ? (
                    <Input
                        value={editedData[row.original.indentNo]?.paymentType || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [row.original.indentNo]: {
                                    ...prev[row.original.indentNo],
                                    paymentType: e.target.value,
                                }
                            }));
                        }}
                        className="h-8 w-full"
                    />
                ) : (
                    sheetRow?.paymentType || '-'
                );
            },
        },
        {
            id: 'advanceAmount',
            header: 'Advance Amt',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                const sheetRow = indentSheet.find(s => s.indentNumber === row.original.indentNo);
                return isEditing ? (
                    <Input
                        type="number"
                        value={editedData[row.original.indentNo]?.advanceAmount || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [row.original.indentNo]: {
                                    ...prev[row.original.indentNo],
                                    advanceAmount: parseFloat(e.target.value) || 0,
                                }
                            }));
                        }}
                        className="h-8 w-24"
                    />
                ) : (
                    sheetRow?.advanceAmountIfAny ? `₹${sheetRow.advanceAmountIfAny}` : '-'
                );
            },
        },
        {
            id: 'photoOfBill',
            header: 'Bill Photo',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                const sheetRow = indentSheet.find(
                    (s) => s.indentNumber === row.original.indentNo
                );
        
                if (isEditing) {
                    return (
                        <div className="flex items-center gap-2">
                            {/* Nice compact upload button */}
                            <label className="inline-flex items-center px-2 py-1 text-xs font-medium border border-dashed border-primary/50 rounded-md bg-primary/5 text-primary cursor-pointer hover:bg-primary/10">
                                Choose image
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        setEditedData((prev) => ({
                                            ...prev,
                                            [row.original.indentNo]: {
                                                ...prev[row.original.indentNo],
                                                photoOfBillFile: file,
                                            },
                                        }));
                                    }}
                                />
                            </label>
        
                            {/* Existing image link */}
                            {sheetRow?.photoOfBill && (
                                <a
                                    href={sheetRow.photoOfBill}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline"
                                >
                                    View
                                </a>
                            )}
                        </div>
                    );
                }
        
                return sheetRow?.photoOfBill ? (
                    <a
                        href={sheetRow.photoOfBill}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                    >
                        View
                    </a>
                ) : (
                    '-'
                );
            },
        },
        
        {
            id: 'approvedRate',
            header: 'Rate',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                const sheetRow = indentSheet.find(s => s.indentNumber === row.original.indentNo);
                return isEditing ? (
                    <Input
                        type="number"
                        value={editedData[row.original.indentNo]?.rate || ''}
                        onChange={(e) => {
                            setEditedData(prev => ({
                                ...prev,
                                [row.original.indentNo]: {
                                    ...prev[row.original.indentNo],
                                    rate: parseFloat(e.target.value) || 0,
                                }
                            }));
                        }}
                        className="h-8 w-24"
                    />
                ) : (
                    `₹${sheetRow?.approvedRate || sheetRow?.rate || 0}`
                );
            },
        },
        {
            accessorKey: 'billStatus',
            header: 'Bill Status',
            cell: ({ row }) => {
                const status = row.original.billStatus;
                const variant = status === 'Bill Received' ? 'primary' : 'secondary';
                return <Pill variant={variant}>{status}</Pill>;
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
        let photoUrl: string | undefined;
        if (values.photoOfBill) {
            photoUrl = await uploadFile(
                values.photoOfBill,
                import.meta.env.VITE_BILL_PHOTO_FOLDER || 'bill-photos'
            );
        }

        // Update ALL rows with matching PO Number
        await postToSheet(
            indentSheet
                .filter((s) => s.poNumber === selectedIndent?.poNumber)
                .map((prev) => {
                    const { timestamp, actual4, poNumber, poCopy, ...safeData } = prev;
                    return {
                        ...safeData,
                        actual7: new Date().toISOString(),
                        billStatus: values.billStatus,
                        billNumber: values.billNo || '',
                        qty: productQty[prev.indentNumber] || prev.approvedQuantity, // Updated line
                        leadTimeToLiftMaterial: values.leadTime || prev.leadTimeToLiftMaterial,
                        typeOfBill: values.typeOfBill || '',
                        billAmount: values.billAmount || 0,
                        discountAmount: values.discountAmount || 0,
                        paymentType: values.paymentType || '',
                        advanceAmountIfAny: values.advanceAmount || 0,
                        photoOfBill: photoUrl,
                        rate: productRates[prev.indentNumber] || prev.approvedRate || 0,
                    };
                }),
            'update'
        );

        toast.success(`Updated purchase details for PO ${selectedIndent?.poNumber}`);
        setOpenDialog(false);
        form.reset();
        setProductRates({});
        setProductQty({}); // Add this line to reset qty
        setTimeout(() => updateIndentSheet(), 1000);
    } catch {
        toast.error('Failed to update purchase details');
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
                            dataLoading={indentLoading}
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
                        <p className="font-medium text-xs text-muted-foreground">Qty</p>
                        <Input
                            type="number"
                            placeholder="Enter qty"
                            value={productQty[product.indentNo] || ''}
                            onChange={(e) => handleQtyChange(product.indentNo, e.target.value)}
                            className="h-9 text-sm w-full"
                        />
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
