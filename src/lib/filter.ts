import type { IndentSheet, ReceivedSheet } from '@/types';

type Filters = {
    startDate?: string; // ISO date string
    endDate?: string; // ISO date string
    vendors?: string[];
    products?: string[];
};

export function analyzeData(
    {
        indentSheet,
        receivedSheet,
    }: {
        indentSheet: IndentSheet[];
        receivedSheet: ReceivedSheet[];
    },
    filters: Filters = {}
) {
    const start = filters.startDate ? new Date(filters.startDate) : null;
    const end = filters.endDate ? new Date(filters.endDate) : null;

    const vendorSet = new Set(filters.vendors ?? []);
    const productSet = new Set(filters.products ?? []);

    const isWithinDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toString() !== 'Invalid Date' && (!start || d >= start) && (!end || d <= end);
    };

    const isVendorMatch = (name: string) => vendorSet.size === 0 || vendorSet.has(name);
    const isProductMatch = (name: string) => productSet.size === 0 || productSet.has(name);

    // Map from indentNumber to productName
    const indentProductMap = new Map<string, string>();
    for (const indent of indentSheet) {
        indentProductMap.set(indent.indentNumber, indent.productName);
    }

    // -------------------------------
    // Approved Indents
    const approvedIndents = indentSheet.filter(
        (i) =>
            ["three party", "regular"].includes(i.vendorType.toLowerCase()) &&
            isWithinDate(i.timestamp) &&
            isProductMatch(i.productName)
    );

    const totalApprovedQuantity = approvedIndents.reduce(
        (sum, i) => sum + (i.approvedQuantity ?? 0),
        0
    );

    // -------------------------------
    // Purchases
    const receivedPurchases = receivedSheet.filter((r) => {
        const productName = indentProductMap.get(r.indentNumber);
        return (
            isWithinDate(r.timestamp) &&
            isVendorMatch(r.vendor) &&
            (!productName || isProductMatch(productName))
        );
    });

    const totalPurchasedQuantity = receivedPurchases.reduce(
        (sum, r) => sum + (r.receivedQuantity ?? 0),
        0
    );

    // -------------------------------
    // Issued Items
    const issuedIndents = indentSheet.filter(
        (i) =>
            i.issueStatus.toLowerCase() === 'issued' &&
            isWithinDate(i.timestamp) &&
            isProductMatch(i.productName)
    );

    const totalIssuedQuantity = issuedIndents.reduce(
        (sum, i) => sum + (i.issuedQuantity ?? 0),
        0
    );

    // -------------------------------
    // Top 10 Products
    const productFrequencyMap = new Map<string, { freq: number; quantity: number }>();

    for (const r of receivedSheet) {
        if (!isWithinDate(r.timestamp)) continue;
        const productName = indentProductMap.get(r.indentNumber);
        if (!productName || !isProductMatch(productName)) continue;

        if (!productFrequencyMap.has(productName)) {
            productFrequencyMap.set(productName, { freq: 0, quantity: 0 });
        }
        const entry = productFrequencyMap.get(productName)!;
        entry.freq += 1;
        entry.quantity += r.receivedQuantity;
    }

    const topProducts = [...productFrequencyMap.entries()]
        .sort((a, b) => b[1].freq - a[1].freq)
        .slice(0, 10)
        .map(([name, data]) => ({ name, ...data }));

    // -------------------------------
    // Top 10 Vendors
    const vendorMap = new Map<string, { orders: number; quantity: number }>();

    for (const r of receivedSheet) {
        if (!isWithinDate(r.timestamp) || !isVendorMatch(r.vendor)) continue;

        if (!vendorMap.has(r.vendor)) {
            vendorMap.set(r.vendor, { orders: 0, quantity: 0 });
        }
        const entry = vendorMap.get(r.vendor)!;
        entry.orders += 1;
        entry.quantity += r.receivedQuantity;
    }

    const topVendors = [...vendorMap.entries()]
        .sort((a, b) => b[1].orders - a[1].orders)
        .slice(0, 10)
        .map(([name, data]) => ({ name, ...data }));

    // -------------------------------
    return {
        approvedIndentCount: approvedIndents.length,
        totalApprovedQuantity,
        receivedPurchaseCount: receivedPurchases.length,
        totalPurchasedQuantity,
        issuedIndentCount: issuedIndents.length,
        totalIssuedQuantity,
        topProducts,
        topVendors,
    };
}
