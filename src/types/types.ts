// In @/types.ts

export interface RouteAttributes {
    path: string;
    name: string;
    icon?: React.ReactNode;
    gateKey?: string;
    notifications?: (indentSheet: any[]) => number;
}

export interface PoMasterSheet {
    timestamp: string;
    partyName: string;
    poNumber: string;
    internalCode: string;
    product: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    gst: number;
    discount: number;
    amount: number;
    totalPoAmount: number;
    pdf: string;
    preparedBy: string;
    approvedBy: string;
    quotationNumber: string;
    quotationDate: string;
    enquiryNumber: string;
    enquiryDate: string;
    term1: string;
    term2: string;
    term3: string;
    term4: string;
    term5: string;
    term6: string;
    term7: string;
    term8: string;
    term9: string;
    term10: string;
    discountPercent?: number;
    gstPercent?: number;
}

export type UserPermissions = {
    rowIndex: number;
    username: string;
    password: string;
    name: string;
    
    administrate: boolean;
    createIndent: boolean;
    createPo: boolean;
    indentApprovalView: boolean;
    indentApprovalAction: boolean;
    updateVendorView: boolean;
    updateVendorAction: boolean;
    threePartyApprovalView: boolean;
    threePartyApprovalAction: boolean;
    receiveItemView: boolean;
    receiveItemAction: boolean;
    storeOutApprovalView: boolean;
    storeOutApprovalAction: boolean;
    pendingIndentsView: boolean;
    ordersView: boolean;
    poMaster: boolean;
    getPurchase: boolean;
    
    // New permissions for Dashboard and Inventory
    dashboardView: boolean;
    inventoryView: boolean;
};