



import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { toast } from 'sonner';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import { ClipLoader as Loader } from 'react-spinners';
import { ClipboardList, Trash, Search, Plus } from 'lucide-react'; // Plus ko import karo
import { postToSheet, uploadFile } from '@/lib/fetchers';
import type { IndentSheet } from '@/types';
import { useSheets } from '@/context/SheetsContext';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';


export default () => {
    const { indentSheet: sheet, updateIndentSheet, masterSheet: options } = useSheets();
    const [indentSheet, setIndentSheet] = useState<IndentSheet[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchTermGroupHead, setSearchTermGroupHead] = useState("");
    const [searchTermProductName, setSearchTermProductName] = useState("");
    const [newProductName, setNewProductName] = useState<{[key: number]: string}>({});
    const [showAddProduct, setShowAddProduct] = useState<{[key: number]: boolean}>({});
    const [localProducts, setLocalProducts] = useState<{[key: string]: string[]}>({});


    useEffect(() => {
        setIndentSheet(sheet);
    }, [sheet]);


    const schema = z.object({
        indenterName: z.string().nonempty(),
        indentApproveBy: z.string().nonempty(),
        indentType: z.enum(['Purchase', 'Store Out'], { required_error: 'Select a status' }),
        products: z
            .array(
                z.object({
                    department: z.string().nonempty(),
                    groupHead: z.string().nonempty(),
                    productName: z.string().nonempty(),
                    quantity: z.coerce.number().gt(0, 'Must be greater than 0'),
                    uom: z.string().nonempty(),
                    areaOfUse: z.string().nonempty(),
                    attachment: z.instanceof(File).optional(),
                    specifications: z.string().optional(),
                })
            )
            .min(1, 'At least one product is required'),
    });


   const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
        indenterName: '',
        indentApproveBy: '',
        indentType: '' as any, // Change from undefined to ''
        products: [
            {
                attachment: undefined,
                uom: '',
                productName: '',
                specifications: '',
                quantity: 1,
                areaOfUse: '',
                groupHead: '',
                department: '',
            },
        ],
    },
});


    const products = form.watch('products');
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'products',
    });


   // Function to generate next indent number
const getNextIndentNumber = () => {
    if (indentSheet.length === 0) {
        return 'SI-0001';
    }
    
    const indentNumbers = indentSheet
        .map(row => row.indentNumber)
        .filter(num => num && num.startsWith('SI-'))
        .map(num => parseInt(num.replace('SI-', ''), 10))
        .filter(num => !isNaN(num));
    
    const maxNumber = Math.max(...indentNumbers, 0);
    const nextNumber = maxNumber + 1;
    
    return `SI-${String(nextNumber).padStart(4, '0')}`;
};


// Better approach using image tag
const submitProductToMasterSheet = (productName: string, groupHead: string) => {
    const MASTER_SHEET_URL = 'https://script.google.com/a/macros/jjspl.in/s/AKfycbyybfRgC2y9wLktUTQ9fTqp-qGMleFrj1c3pQJbLEQiMWr9-hNEaZyoqkWpeV9HF9Az/exec';
    
    const params = new URLSearchParams({
        sheetName: 'Items And Location',
        productName: productName,
        groupHead: groupHead
    });
    
    // Use image tag trick (no CORS issue)
    const img = new Image();
    img.src = `${MASTER_SHEET_URL}?${params.toString()}`;
    
    return Promise.resolve(true);
};

// Update addNewProductLocally - sync version
const addNewProductLocally = (index: number, groupHead: string) => {
    const productName = newProductName[index]?.trim();
    
    if (!productName) {
        toast.error('Please enter a product name');
        return;
    }
    
    if (!groupHead) {
        toast.error('Please select a group head first');
        return;
    }
    
    // Add to local state
    setLocalProducts(prev => ({
        ...prev,
        [groupHead]: [...(prev[groupHead] || []), productName]
    }));
    
    // Set the value in form
    form.setValue(`products.${index}.productName`, productName);
    
    // Reset states
    setNewProductName(prev => ({...prev, [index]: ''}));
    setShowAddProduct(prev => ({...prev, [index]: false}));
    
    // Submit to master sheet
    submitProductToMasterSheet(productName, groupHead);
    
    toast.success('Product added successfully');
};

async function onSubmit(data: z.infer<typeof schema>) {
    try {
        // Create timestamp in DD/MM/YYYY HH:mm:ss format (India time)
        const now = new Date();
        
        const day = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit' });
        const month = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: '2-digit' });
        const year = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric' });
        const time = now.toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        const timestamp = `${day}/${month}/${year} ${time}`;

        const rows: Partial<IndentSheet>[] = [];
        
        // Get the starting indent number
        let currentIndentNumber = getNextIndentNumber();
        
        for (let i = 0; i < data.products.length; i++) {
            const product = data.products[i];
            
            // Generate unique indent number for each product
            if (i > 0) {
                const lastNumber = parseInt(currentIndentNumber.replace('SI-', ''), 10);
                currentIndentNumber = `SI-${String(lastNumber + 1).padStart(4, '0')}`;
            }
            
            const row: Partial<IndentSheet> = {
                timestamp: timestamp,
                indentNumber: currentIndentNumber,
                indenterName: data.indenterName,
                department: product.department,
                areaOfUse: product.areaOfUse,
                groupHead: product.groupHead,
                productName: product.productName,
                quantity: product.quantity,
                uom: product.uom,
                specifications: product.specifications || '',
                indentApprovedBy: data.indentApproveBy,
                indentType: data.indentType,
            };

            if (product.attachment !== undefined) {
                row.attachment = await uploadFile(
                    product.attachment,
                    import.meta.env.VITE_IDENT_ATTACHMENT_FOLDER
                );
            }

            rows.push(row);
        }
    
        await postToSheet(rows);
        setTimeout(() => updateIndentSheet(), 1000);
        
        toast.success('Indent created successfully');
        
        form.reset({
            indenterName: '',
            indentApproveBy: '',
            indentType: '' as any,
            products: [
                {
                    attachment: undefined,
                    uom: '',
                    productName: '',
                    specifications: '',
                    quantity: 1,
                    areaOfUse: '',
                    groupHead: '',
                    department: '',
                },
            ],
        });
        
        // Reset local products and states
        setLocalProducts({});
        setNewProductName({});
        setShowAddProduct({});
    } catch (_) {
        toast.error('Error while creating indent! Please try again');
    }
}



    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }


    return (
        <div>
            <Heading heading="Indent Form" subtext="Create new Indent">
                <ClipboardList size={50} className="text-primary" />
            </Heading>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6 p-5">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <FormField
                            control={form.control}
                            name="indenterName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Indenter Name
                                        <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter indenter name" {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />


                        <FormField
                            control={form.control}
                            name="indentType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Indent Type
                                        <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Purchase">Purchase</SelectItem>
                                            <SelectItem value="Store Out">Store Out</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />


                        <FormField
                            control={form.control}
                            name="indentApproveBy"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Approved By
                                        <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter approved by" {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>


                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-semibold">Products</h2>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    append({
                                        department: '',
                                        groupHead: '',
                                        productName: '',
                                        quantity: 1,
                                        uom: '',
                                        areaOfUse: '',
                                        // @ts-ignore
                                        priority: undefined,
                                        attachment: undefined,
                                    })
                                }
                            >
                                Add Product
                            </Button>
                        </div>


                        {fields.map((field, index) => {
                            const groupHead = products[index]?.groupHead;
                            
                            // Combine master sheet products + local products
                            const masterProducts = options?.groupHeads[groupHead] || [];
                            const localGroupProducts = localProducts[groupHead] || [];
                            const productOptions = [...masterProducts, ...localGroupProducts];


                            return (
                                <div
                                    key={field.id}
                                    className="flex flex-col gap-4 border p-4 rounded-lg"
                                >
                                    <div className="flex justify-between">
                                        <h3 className="text-md font-semibold">
                                            Product {index + 1}
                                        </h3>
                                        <Button
                                            variant="destructive"
                                            type="button"
                                            onClick={() => fields.length > 1 && remove(index)}
                                            disabled={fields.length === 1}
                                        >
                                            <Trash />
                                        </Button>
                                    </div>
                                    <div className="grid gap-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.department`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Department
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select department" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    <input
                                                                        placeholder="Search departments..."
                                                                        value={searchTerm}
                                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                    />
                                                                </div>
                                                                {options?.departments
                                                                    .filter((dep) =>
                                                                        dep.toLowerCase().includes(searchTerm.toLowerCase())
                                                                    )
                                                                    .map((dep, i) => (
                                                                        <SelectItem key={i} value={dep}>
                                                                            {dep}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.groupHead`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Group Head
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select group head" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    <input
                                                                        placeholder="Search group heads..."
                                                                        value={searchTermGroupHead}
                                                                        onChange={(e) => setSearchTermGroupHead(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                    />
                                                                </div>
                                                                {Object.keys(options?.groupHeads || {})
                                                                    .filter((dep) =>
                                                                        dep.toLowerCase().includes(searchTermGroupHead.toLowerCase())
                                                                    )
                                                                    .map((dep, i) => (
                                                                        <SelectItem key={i} value={dep}>
                                                                            {dep}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.areaOfUse`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Area Of Use
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="Enter area of use"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.productName`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Product Name
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                            disabled={!groupHead}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full">
                                                                    <SelectValue placeholder="Select product" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    <input
                                                                        placeholder="Search products..."
                                                                        value={searchTermProductName}
                                                                        onChange={(e) => setSearchTermProductName(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                    />
                                                                </div>

                                                                {!showAddProduct[index] && (
                                                                    <div 
                                                                        className="flex items-center px-3 py-2 cursor-pointer hover:bg-accent"
                                                                        onClick={() => setShowAddProduct(prev => ({...prev, [index]: true}))}
                                                                    >
                                                                        <Plus className="mr-2 h-4 w-4" />
                                                                        <span className="text-sm font-medium">Add New Product</span>
                                                                    </div>
                                                                )}

                                                                {showAddProduct[index] && (
                                                                    <div className="flex items-center gap-2 px-3 py-2 border-b">
                                                                        <Input
                                                                            placeholder="Enter new product name"
                                                                            value={newProductName[index] || ''}
                                                                            onChange={(e) => setNewProductName(prev => ({...prev, [index]: e.target.value}))}
                                                                            onKeyDown={(e) => {
                                                                                e.stopPropagation();
                                                                                if (e.key === 'Enter') {
                                                                                    e.preventDefault();
                                                                                    addNewProductLocally(index, groupHead);
                                                                                }
                                                                            }}
                                                                            className="flex-1"
                                                                        />
                                                                        <Button
                                                                            type="button"
                                                                            size="sm"
                                                                            onClick={() => addNewProductLocally(index, groupHead)}
                                                                        >
                                                                            Add
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => {
                                                                                setShowAddProduct(prev => ({...prev, [index]: false}));
                                                                                setNewProductName(prev => ({...prev, [index]: ''}));
                                                                            }}
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                    </div>
                                                                )}

                                                                {productOptions
                                                                    .filter((dep) =>
                                                                        dep.toLowerCase().includes(searchTermProductName.toLowerCase())
                                                                    )
                                                                    .map((dep, i) => (
                                                                        <SelectItem key={i} value={dep}>
                                                                            {dep}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.quantity`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Quantity
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                {...field}
                                                                disabled={!groupHead}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.uom`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            UOM
                                                            <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                {...field}
                                                                disabled={!groupHead}
                                                                placeholder="e.g. Pcs, Kgs"
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name={`products.${index}.attachment`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Attachment</FormLabel>
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
                                        <FormField
                                            control={form.control}
                                            name={`products.${index}.specifications`}
                                            render={({ field }) => (
                                                <FormItem className="w-full">
                                                    <FormLabel>Specifications</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="Enter specifications"
                                                            className="resize-y"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>


                    <div>
                        <Button
                            className="w-full"
                            type="submit"
                            disabled={form.formState.isSubmitting}
                        >
                            {form.formState.isSubmitting && (
                                <Loader size={20} color="white" aria-label="Loading Spinner" />
                            )}
                            Create Indent
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
};
