import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchFromSupabaseWithCount } from '@/lib/fetchers';

interface UseInfiniteSupabaseQueryOptions {
    tableName: string;
    select?: string;
    orderBy?: { column: string; options?: { ascending?: boolean } };
    queryBuilder?: (query: any) => any;
    pageSize?: number;
}

export function useInfiniteSupabaseQuery(
    queryKey: any[],
    {
        tableName,
        select = '*',
        orderBy = { column: 'created_at', options: { ascending: false } },
        queryBuilder,
        pageSize = 10,
    }: UseInfiniteSupabaseQueryOptions
) {
    return useInfiniteQuery({
        queryKey,
        queryFn: async ({ pageParam = 0 }) => {
            const from = pageParam * pageSize;
            const to = from + pageSize - 1;

            const result = await fetchFromSupabaseWithCount(
                tableName,
                select,
                { from, to },
                orderBy,
                queryBuilder
            );

            return {
                data: result.data,
                count: result.count,
                nextPage: pageParam + 1,
            };
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            const totalLoaded = allPages.reduce((acc, page) => acc + page.data.length, 0);
            return totalLoaded < lastPage.count ? lastPage.nextPage : undefined;
        },
    });
}
