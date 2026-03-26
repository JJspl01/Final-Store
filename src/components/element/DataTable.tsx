'use client';

import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    useReactTable,
} from '@tanstack/react-table';

import { Button } from '../ui/button';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Input } from '../ui/input';
import { Package } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    searchFields?: string[];
    dataLoading?: boolean;
    children?: ReactNode;
    className?: string;
    extraActions?: ReactNode;
    footer?: ReactNode;
    pagination?: boolean;
    // Server-side pagination props
    manualPagination?: boolean;
    pageCount?: number;
    pageIndex?: number;
    pageSize?: number;
    onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
    // Infinite Scroll props
    infiniteScroll?: boolean;
    onLoadMore?: () => void;
    hasMore?: boolean;
    searchExtra?: ReactNode;
}

function globalFilterFn<TData>(row: TData, columnIds: string[], filterValue: string) {
    return columnIds.some((columnId) => {
        const value = (row as any)[columnId];
        return String(value ?? '')
            .toLowerCase()
            .includes(filterValue.toLowerCase());
    });
}

export default function DataTable<TData, TValue>({
    columns,
    data,
    searchFields = [],
    dataLoading,
    children: _children, // <-- underscore avoids TS unused variable error
    className,
    extraActions,
    footer,
    pagination = false,
    manualPagination = false,
    pageCount,
    pageIndex = 0,
    pageSize = 50,
    onPaginationChange,
    infiniteScroll = false,
    onLoadMore,
    hasMore = false,
    searchExtra,
}: DataTableProps<TData, TValue>) {
    const [globalFilter, setGlobalFilter] = useState('');
    const observerTarget = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!infiniteScroll || !onLoadMore || !hasMore || dataLoading) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    onLoadMore();
                }
            },
            { threshold: 0.1, rootMargin: '100px' }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [infiniteScroll, onLoadMore, hasMore, dataLoading, data]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: pagination && !manualPagination ? getPaginationRowModel() : undefined,
        globalFilterFn: (row, _, filterValue) =>
            globalFilterFn(row.original, searchFields, filterValue),
        manualPagination,
        pageCount: manualPagination ? pageCount : undefined,
        onPaginationChange: manualPagination ? (updater) => {
            if (onPaginationChange) {
                const nextState = typeof updater === 'function'
                    ? updater({ pageIndex, pageSize })
                    : updater;
                onPaginationChange(nextState);
            }
        } : undefined,
        state: {
            globalFilter,
            ...(manualPagination ? { pagination: { pageIndex, pageSize } } : {}),
        },
        onGlobalFilterChange: setGlobalFilter,
    });

    console.log(table.getRowModel().rows, "tabledata");
    return (
        <div className="p-5 flex flex-col gap-4 h-full w-full overflow-hidden min-h-0">
            <div className="flex justify-between items-center w-full gap-3 shrink-0">
                {searchFields.length !== 0 && (
                    <div className="flex items-center flex-1 max-w-2xl gap-2">
                        <Input
                            placeholder={`Search...`}
                            value={globalFilter}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            className="w-full"
                        />
                        {searchExtra && <div className="shrink-0">{searchExtra}</div>}
                    </div>
                )}
                {extraActions && (
                    <div className="flex items-center overflow-x-auto shrink-0 hide-scrollbar pb-1 -mb-1">
                        {extraActions}
                    </div>
                )}
            </div>

            <div className={cn("relative rounded-md border w-full max-w-full overflow-auto flex-1 bg-background min-h-0", className)}>
                <Table className="w-full caption-bottom text-sm min-w-max" containerClassName="overflow-visible w-full">
                    <TableHeader className="sticky top-0 z-20 bg-background shadow-sm border-b">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {dataLoading && table.getRowModel().rows?.length === 0 ? (
                            Array.from({ length: 15 }).map((_, i) => (
                                <TableRow
                                    key={`skeleton-${i}`}
                                    className="p-1 hover:bg-transparent"
                                >
                                    {columns.map((_, j) => (
                                        <TableCell key={`skeleton-cell-${j}`}>
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className="p-1"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            !dataLoading && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-50 text-center text-xl"
                                    >
                                        <div className="flex flex-col justify-center items-center w-full gap-1">
                                            <Package className="text-gray-400" size={50} />
                                            <p className="text-muted-foreground font-semibold">
                                                No Records Found.
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        )}
                    </TableBody>
                </Table>
                {infiniteScroll && (
                    <div ref={observerTarget} className="h-10 w-full flex items-center justify-center">
                        {dataLoading && <div className="text-xs text-muted-foreground">Loading more...</div>}
                    </div>
                )}
            </div>
            {(pagination && !infiniteScroll) && (
                <div className="flex items-center justify-end space-x-2 mt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (manualPagination && onPaginationChange) {
                                onPaginationChange({ pageIndex: pageIndex - 1, pageSize });
                            } else {
                                table.previousPage();
                            }
                        }}
                        disabled={manualPagination ? pageIndex === 0 : !table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <div className="text-sm font-medium">
                        Page {manualPagination ? pageIndex + 1 : table.getState().pagination.pageIndex + 1} of{' '}
                        {manualPagination ? pageCount : table.getPageCount()}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (manualPagination && onPaginationChange) {
                                onPaginationChange({ pageIndex: pageIndex + 1, pageSize });
                            } else {
                                table.nextPage();
                            }
                        }}
                        disabled={manualPagination ? (pageCount !== undefined && pageIndex >= pageCount - 1) : !table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            )}
            {footer && <div>{footer}</div>}
        </div>
    );
}
