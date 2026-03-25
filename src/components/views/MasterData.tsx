import { Database, Plus, Edit, Search, UserPlus, PackagePlus } from 'lucide-react';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fetchFromSupabaseWithCount, fetchIndentMasterData } from '@/lib/fetchers';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'; // Added Tabs
import type { ColumnDef } from '@tanstack/react-table';
import DataTable from '../element/DataTable';

/* ───── types ───── */
interface MasterRow {
    id: number;
    vendor_name: string;
    vendor_gstin: string | null;
    vendor_address: string | null;
    vendor_email: string | null;
    payment_term: string | null;
    department: string | null;
    group_head: string | null;
    item_name: string | null;
    uom: string | null; // Added uom
    created_at: string | null;
}

interface MasterForm {
    vendor_name: string;
    vendor_gstin: string;
    vendor_address: string;
    vendor_email: string;
    payment_term: string;
    department: string;
    group_head: string;
    item_name: string;
    uom: string; // Added uom
}

const emptyForm: MasterForm = {
    vendor_name: '',
    vendor_gstin: '',
    vendor_address: '',
    vendor_email: '',
    payment_term: '',
    department: '',
    group_head: '',
    item_name: '',
    uom: '',
};

/* ───── field helper ───── */
function Field({
    label,
    id,
    type = 'text',
    value,
    onChange,
    required,
    placeholder,
    textarea,
}: {
    label: string;
    id: string;
    type?: string;
    value: string;
    onChange: (val: string) => void;
    required?: boolean;
    placeholder?: string;
    textarea?: boolean;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id} className="text-sm font-medium">
                {label}
                {required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            {textarea ? (
                <Textarea
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder ?? `Enter ${label.toLowerCase()}`}
                    rows={2}
                    className="resize-none text-sm"
                />
            ) : (
                <Input
                    id={id}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder ?? `Enter ${label.toLowerCase()}`}
                    className="text-sm"
                />
            )}
        </div>
    );
}

function TruncCell({ value, width = 140 }: { value: string | null; width?: number }) {
    if (!value) return <span className="text-muted-foreground">—</span>;
    return (
        <span
            title={value}
            style={{ maxWidth: width }}
            className="truncate block"
        >
            {value}
        </span>
    );
}

/* ───── main component ───── */
export default function MasterData() {
    const [tableData, setTableData] = useState<MasterRow[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'Vendors' | 'Items'>('Vendors');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<MasterForm>(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [vendorFilter, setVendorFilter] = useState('All');
    const [deptFilter, setDeptFilter] = useState('All');
    const [groupHeadFilter, setGroupHeadFilter] = useState('All');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [allVendorNames, setAllVendorNames] = useState<string[]>([]);
    const [formMode, setFormMode] = useState<'Add Vendor' | 'Add Item'>('Add Vendor');
    const [master, setMaster] = useState<any>(null);
    const [searchTermGroupHead, setSearchTermGroupHead] = useState('');

    function handleEdit(row: MasterRow) {
        setForm({
            vendor_name: row.vendor_name || '',
            vendor_gstin: row.vendor_gstin || '',
            vendor_address: row.vendor_address || '',
            vendor_email: row.vendor_email || '',
            payment_term: row.payment_term || '',
            department: row.department || '',
            group_head: row.group_head || '',
            item_name: row.item_name || '',
            uom: row.uom || '',
        });
        setFormMode(row.item_name ? 'Add Item' : 'Add Vendor');
        setEditingId(row.id);
        setDialogOpen(true);
    }

    const vendorColumns: ColumnDef<MasterRow>[] = [
        {
            accessorKey: 'vendor_name',
            header: 'Vendor Name',
            cell: ({ row }) => (
                <div className="flex items-center gap-2 group">
                    <TruncCell value={row.original.vendor_name} width={200} />
                    <Button variant="outline" size="icon" className="h-6 w-6 shrink-0 opacity-100" onClick={() => handleEdit(row.original)}>
                        <Edit className="h-3 w-3" />
                    </Button>
                </div>
            ),
        },
        {
            accessorKey: 'vendor_gstin',
            header: 'GSTIN',
            cell: ({ getValue }) => <TruncCell value={getValue() as string | null} width={150} />,
        },
        {
            accessorKey: 'vendor_email',
            header: 'Email',
            cell: ({ getValue }) => <TruncCell value={getValue() as string | null} width={180} />,
        },
        {
            accessorKey: 'vendor_address',
            header: 'Address',
            cell: ({ getValue }) => <TruncCell value={getValue() as string | null} width={250} />,
        },
        {
            accessorKey: 'payment_term',
            header: 'Payment Term',
            cell: ({ getValue }) => <TruncCell value={getValue() as string | null} width={130} />,
        },
    ];

    const itemColumns: ColumnDef<MasterRow>[] = [
        {
            accessorKey: 'item_name',
            header: 'Product Name',
            cell: ({ row }) => (
                <div className="flex items-center gap-2 group">
                    <div className="whitespace-normal break-words min-w-[150px] max-w-[300px] text-sm font-medium">
                        {row.original.item_name}
                    </div>
                    <Button variant="outline" size="icon" className="h-6 w-6 shrink-0 opacity-100" onClick={() => handleEdit(row.original)}>
                        <Edit className="h-3 w-3" />
                    </Button>
                </div>
            ),
        },
        {
            accessorKey: 'department',
            header: 'Department',
            cell: ({ getValue }) => <TruncCell value={getValue() as string | null} width={140} />,
        },
        {
            accessorKey: 'group_head',
            header: 'Group Head',
            cell: ({ getValue }) => <TruncCell value={getValue() as string | null} width={140} />,
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ getValue }) => <TruncCell value={getValue() as string | null} width={100} />,
        },
    ];

    /* fetch */
    const fetchVendorsList = async () => {
        const { data, error } = await supabase
            .from('master_data')
            .select('vendor_name');
        
        if (!error && data) {
            const names = Array.from(new Set(data.map(r => r.vendor_name).filter(Boolean))).sort();
            setAllVendorNames(names);
        }
    };

    /* fetch */
    async function fetchData(isInitial = false) {
        setDataLoading(true);
        try {
            const currentPage = isInitial ? 0 : pageIndex;
            const from = currentPage * pageSize;
            const to = from + pageSize - 1;

            const { data, count } = (await fetchFromSupabaseWithCount(
                'master_data',
                '*',
                { from, to },
                { column: 'id', options: { ascending: false } },
                (q) => {
                    let query = q;
                    if (viewMode === 'Vendors') {
                        if (vendorFilter !== 'All') {
                            query = query.eq('vendor_name', vendorFilter);
                        } else {
                            query = query.not('vendor_name', 'is', null).neq('vendor_name', '').neq('vendor_name', '-');
                        }
                    } else {
                        if (deptFilter !== 'All') query = query.eq('department', deptFilter);
                        if (groupHeadFilter !== 'All') query = query.eq('group_head', groupHeadFilter);
                        query = query.not('item_name', 'is', null).neq('item_name', '');
                    }
                    return query;
                }
            )) as unknown as { data: MasterRow[], count: number };

            if (data) {
                if (isInitial) {
                    setTableData(data);
                    setPageIndex(1);
                } else {
                    setTableData(prev => [...prev, ...data]);
                    setPageIndex(prev => prev + 1);
                }

                const total = count || 0;
                setTotalCount(total);
                setHasMore((isInitial ? data.length : tableData.length + data.length) < total);
            }
        } catch (err: any) {
            console.error('Master data fetch exception:', err);
            toast.error('An unexpected error occurred while fetching data');
        } finally {
            setDataLoading(false);
        }
    }


    const fetchMasterData = async () => {
        const m = await fetchIndentMasterData();
        setMaster(m);
    };

    useEffect(() => {
        fetchVendorsList();
        fetchMasterData();
    }, []);

    useEffect(() => {
        fetchData(true);
    }, [vendorFilter, deptFilter, groupHeadFilter, viewMode]);

    // Reset filters when switching tabs to ensure a fresh view
    useEffect(() => {
        setVendorFilter('All');
        setDeptFilter('All');
        setGroupHeadFilter('All');
    }, [viewMode]);

    /* reset form when sheet closes */
    useEffect(() => {
        if (!dialogOpen) {
            setForm(emptyForm);
            setEditingId(null);
            setFormMode('Add Vendor');
        }
    }, [dialogOpen]);

    function setField(key: keyof MasterForm) {
        return (val: string) => setForm((prev) => ({ ...prev, [key]: val }));
    }

    /* submit */
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.vendor_name.trim()) {
            toast.error('Vendor Name is required');
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                vendor_name: form.vendor_name.trim() || (formMode === 'Add Item' ? '-' : ''),
                vendor_gstin: form.vendor_gstin.trim() || null,
                vendor_address: form.vendor_address.trim() || null,
                vendor_email: form.vendor_email.trim() || null,
                payment_term: form.payment_term.trim() || null,
                department: form.department.trim() || null,
                group_head: form.group_head.trim() || null,
                item_name: form.item_name.trim() || null,
                uom: form.uom.trim() || null,
            };

            if (formMode === 'Add Vendor' && !payload.vendor_name && payload.vendor_name !== '-') {
                toast.error('Vendor Name is required');
                setSubmitting(false);
                return;
            }

            if (editingId) {
                const { error } = await supabase.from('master_data').update(payload).eq('id', editingId);
                if (error) throw error;
                toast.success('Master data updated successfully!');
            } else {
                const { error } = await supabase.from('master_data').insert([payload]);
                if (error) throw error;
                toast.success('Master data saved successfully!');
            }
            setDialogOpen(false);
            fetchData(true);
        } catch (err: any) {
            toast.error(err?.message ?? 'Failed to save master data');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="w-full flex flex-col h-[calc(100vh-90px)] space-y-4">
            <div className="sticky top-0 z-20 bg-background pb-2 shrink-0">
                <Heading
                    heading="Master Data"
                    subtext="Manage vendor master records"
                >
                    <Database size={50} className="text-primary" />
                </Heading>
            </div>

            {/* ── Table & Toolbar ── */}
            <div className="flex-1 w-full flex flex-col min-h-0 overflow-hidden">
                <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="flex-1 flex flex-col min-h-0">
                    <div className="px-5 mb-2">
                        <TabsList className="grid grid-cols-2 w-[240px]">
                            <TabsTrigger value="Vendors" className="flex items-center gap-2">
                                <UserPlus className="h-3.5 w-3.5" />
                                Vendors
                            </TabsTrigger>
                            <TabsTrigger value="Items" className="flex items-center gap-2">
                                <PackagePlus className="h-3.5 w-3.5" />
                                Items
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 min-h-0">
                        <DataTable
                            data={tableData}
                            columns={viewMode === 'Vendors' ? vendorColumns : itemColumns}
                            searchFields={viewMode === 'Vendors' 
                                ? ['vendor_name', 'vendor_gstin', 'vendor_email', 'payment_term']
                                : ['department', 'group_head', 'item_name', 'uom']
                            }
                            dataLoading={dataLoading}
                            infiniteScroll={true}
                            onLoadMore={() => fetchData(false)}
                            hasMore={hasMore}
                            extraActions={
                                <div className="flex items-center gap-2">
                                    {viewMode === 'Vendors' ? (
                                        <Select value={vendorFilter} onValueChange={setVendorFilter}>
                                            <SelectTrigger className="w-[130px] sm:w-[160px] h-9">
                                                <SelectValue placeholder="All Vendors" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[300px]">
                                                <SelectItem value="All">All Vendors</SelectItem>
                                                {allVendorNames.map(vendor => (
                                                    <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <>
                                            <Select
                                                value={deptFilter}
                                                onValueChange={setDeptFilter}
                                            >
                                                <SelectTrigger className="w-[130px] sm:w-[160px] h-9">
                                                    <SelectValue placeholder="All Departments" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[300px]">
                                                    <SelectItem value="All">All Departments</SelectItem>
                                                    {master?.departments?.map((d: string) => (
                                                        <SelectItem key={d} value={d}>{d}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            <Select
                                                value={groupHeadFilter}
                                                onValueChange={setGroupHeadFilter}
                                            >
                                                <SelectTrigger className="w-[130px] sm:w-[160px] h-9">
                                                    <SelectValue placeholder="All Group Heads" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[300px]">
                                                    <SelectItem value="All">All Group Heads</SelectItem>
                                                    {(master?.createGroupHeads || [])
                                                        .map((gh: string) => (
                                                            <SelectItem key={gh} value={gh}>{gh}</SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                        </>
                                    )}
                                    <Button className="h-9 shrink-0 whitespace-nowrap" onClick={() => { 
                                        setEditingId(null); 
                                        setForm(emptyForm); 
                                        setFormMode(viewMode === 'Vendors' ? 'Add Vendor' : 'Add Item');
                                        setDialogOpen(true); 
                                    }}>
                                        <Plus className="mr-1 sm:mr-2 h-4 w-4" />
                                        <span className="hidden sm:inline">Add {viewMode === 'Vendors' ? 'Vendor' : 'Item'}</span>
                                        <span className="sm:hidden">Add</span>
                                    </Button>
                                </div>
                            }
                        />
                    </div>
                </Tabs>
            </div>

            {/* ── Side Sheet Form ── */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-2xl h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-2 border-b">
                        <DialogTitle className="text-xl flex items-center gap-2">
                            <Plus className="h-5 w-5 text-primary" />
                            {editingId ? 'Edit Master Data' : 'Add New Master Data'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingId
                                ? 'Update the vendor or item information in the master record.'
                                : 'Fill in the details below to add a new vendor or item to the master database.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto pt-6 px-6">
                        <Tabs
                            value={formMode}
                            onValueChange={(v: any) => setFormMode(v)}
                            className="w-full"
                        >
                            <TabsList className="grid w-full grid-cols-2 mb-8 h-12">
                                <TabsTrigger value="Add Vendor" className="flex items-center gap-2 text-sm">
                                    <UserPlus className="h-4 w-4" />
                                    <span>Add Vendor</span>
                                </TabsTrigger>
                                <TabsTrigger value="Add Item" className="flex items-center gap-2 text-sm">
                                    <PackagePlus className="h-4 w-4" />
                                    <span>Add Item</span>
                                </TabsTrigger>
                            </TabsList>

                            <form
                                id="master-data-form"
                                onSubmit={handleSubmit}
                                className="space-y-6 pb-6"
                            >
                                {formMode === 'Add Vendor' ? (
                                    <div className="space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <Field
                                            label="Vendor Name"
                                            id="vendor_name"
                                            value={form.vendor_name}
                                            onChange={setField('vendor_name')}
                                            required
                                            placeholder="Enter vendor's registered name"
                                        />
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <Field
                                                label="Vendor GSTIN"
                                                id="vendor_gstin"
                                                value={form.vendor_gstin}
                                                onChange={setField('vendor_gstin')}
                                                placeholder="e.g. 09AAAAA0000A1ZZ"
                                            />
                                            <Field
                                                label="Vendor Email"
                                                id="vendor_email"
                                                type="email"
                                                value={form.vendor_email}
                                                onChange={setField('vendor_email')}
                                                placeholder="vendor@example.com"
                                            />
                                        </div>
                                        <Field
                                            label="Vendor Address"
                                            id="vendor_address"
                                            value={form.vendor_address}
                                            onChange={setField('vendor_address')}
                                            textarea
                                            placeholder="Enter complete office/warehouse address"
                                        />
                                        <Field
                                            label="Payment Term"
                                            id="payment_term"
                                            value={form.payment_term}
                                            onChange={setField('payment_term')}
                                            placeholder="e.g. Net 30, Advance"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-0.5">Department</label>
                                                <Select
                                                    value={form.department}
                                                    onValueChange={(val) => {
                                                        setField('department')(val);
                                                        setField('group_head')('');
                                                    }}
                                                >
                                                    <SelectTrigger className="h-10">
                                                        <SelectValue placeholder="Select Department" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {master?.departments?.map((d: string) => (
                                                            <SelectItem key={d} value={d}>
                                                                {d}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-0.5">Group Head</label>
                                                <Select
                                                    value={form.group_head}
                                                    onValueChange={setField('group_head')}
                                                >
                                                    <SelectTrigger className="h-10">
                                                        <SelectValue placeholder="Select Group Head" />
                                                    </SelectTrigger>
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
                                                        <div className="max-h-[200px] overflow-y-auto">
                                                            {(master?.createGroupHeads || [])
                                                                .filter((gh: string) =>
                                                                    gh.toLowerCase().includes(searchTermGroupHead.toLowerCase())
                                                                )
                                                                .map((gh: string) => (
                                                                    <SelectItem key={gh} value={gh}>
                                                                        {gh}
                                                                    </SelectItem>
                                                                ))}
                                                        </div>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <Field
                                            label="Product Name"
                                            id="item_name"
                                            value={form.item_name}
                                            onChange={setField('item_name')}
                                            placeholder="e.g. Copper Wire, LED Bulb"
                                        />
                                        <Field
                                            label="UOM"
                                            id="uom"
                                            value={form.uom}
                                            onChange={setField('uom')}
                                            placeholder="e.g. PCS, KGS, MTR"
                                        />
                                    </div>
                                )}
                            </form>
                        </Tabs>
                    </div>

                    <DialogFooter className="p-6 pt-3 border-t flex gap-2">
                        <DialogClose asChild>
                            <Button variant="outline" type="button" className="flex-1">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            form="master-data-form"
                            disabled={submitting}
                            className="flex-1"
                        >
                            {submitting && (
                                <Loader size={16} color="white" aria-label="Loading" className="mr-2" />
                            )}
                            {submitting ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
