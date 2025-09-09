import '@/index.css';

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from '@/context/AuthContext.tsx';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import Login from './components/views/Login';
import CreateIndent from './components/views/CreateIndent';
import Dashboard from './components/views/Dashboard';
import App from './App';
import ApproveIndent from '@/components/views/ApproveIndent';
import { SheetsProvider } from './context/SheetsContext';
import VendorUpdate from './components/views/VendorUpdate';
import RateApproval from './components/views/RateApproval';
import ReceiveItems from './components/views/ReceiveItems';
import StoreOutApproval from './components/views/StoreOutApproval';
import GetPurchase from './components/views/getPurchase';
import type { RouteAttributes } from './types';
import {
    LayoutDashboard,
    ClipboardList,
    UserCheck,
    Users,
    ClipboardCheck,
    Truck,
    PackageCheck,
    ShieldUser,
    FilePlus2,
    ListTodo,
    Package2,
    Store,
} from 'lucide-react';
import type { UserPermissions } from './types/sheets';
import Administration from './components/views/Administration';
import Loading from './components/views/Loading';
import CreatePO from './components/views/CreatePO';
import PendingIndents from './components/views/PendingIndents';
import Order from './components/views/Order';
import Inventory from './components/views/Inventory';
import POMaster from './components/views/POMaster';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { loggedIn, loading } = useAuth();
    if (loading) return <Loading />;
    return loggedIn ? children : <Navigate to="/login" />;
}

function GatedRoute({
    children,
    identifier,
}: {
    children: React.ReactNode;
    identifier?: keyof UserPermissions;
}) {
    const { user } = useAuth();
    console.log("user", user);
    console.log("identifier", identifier);
    if (!identifier) return children;
    if (!user[identifier]) {
        console.log("ram")
        return <Navigate to="/" replace />;
    }
    return children;
}

const routes: RouteAttributes[] = [
    {
        path: '',
        name: 'Dashboard',
        icon: <LayoutDashboard size={20} />,
        element: <Dashboard />,
        notifications: () => 0,
    },
    {
        path: 'inventory',
        name: 'Inventory',
        icon: <Store size={20} />,
        element: <Inventory />,
        notifications: () => 0,
    },
    {
        path: 'create-indent',
        gateKey: 'createIndent',
        name: 'Create Indent',
        icon: <ClipboardList size={20} />,
        element: <CreateIndent />,
        notifications: () => 0,
    },
    {
        path: 'approve-indent',
        gateKey: 'indentApprovalView',
        name: 'Approve Indent',
        icon: <ClipboardCheck size={20} />,
        element: <ApproveIndent />,
        notifications: (sheets) =>
            sheets.filter(
                (sheet) =>
                    sheet.planned1 !== '' &&
                    sheet.vendorType === '' &&
                    sheet.indentType === 'Purchase'
            ).length,
    },
    {
        path: 'vendor-rate-update',
        gateKey: 'updateVendorView',
        name: 'Vendor Rate Update',
        icon: <UserCheck size={20} />,
        element: <VendorUpdate />,
        notifications: (sheets) =>
            sheets.filter((sheet) => sheet.planned2 !== '' && sheet.actual2 === '').length,
    },
    {
        path: 'three-party-approval',
        gateKey: 'threePartyApprovalView',
        name: 'Three Party Approval',
        icon: <Users size={20} />,
        element: <RateApproval />,
        notifications: (sheets) =>
            sheets.filter(
                (sheet) =>
                    sheet.planned3 !== '' &&
                    sheet.actual3 === '' &&
                    sheet.vendorType === 'Three Party'
            ).length,
    },
    {
        path: 'pending-pos',
        gateKey: 'pendingIndentsView',
        name: 'Pending POs',
        icon: <ListTodo size={20} />,
        element: <PendingIndents />,
        notifications: (sheets) =>
            sheets.filter((sheet) => sheet.planned4 !== '' && sheet.actual4 === '').length,
    },
    {
        path: 'create-po',
        gateKey: 'createPo',
        name: 'Create PO',
        icon: <FilePlus2 size={20} />,
        element: <CreatePO />,
        notifications: () => 0,
    },
    {
        path: 'po-master',
        // gateKey: 'poMaster',
        name: 'PO Master',
        icon: <Users size={20} />,
        element: <POMaster />,
        notifications: () => 0,
    },
    {
        path: 'po-history',
        gateKey: 'ordersView',
        name: 'PO History',
        icon: <Package2 size={20} />,
        element: <Order />,
        notifications: () => 0,
    },
    {
        path: 'get-purchase',
        gateKey: 'ordersView',
        name: 'Get Purchase',
        icon: <Package2 size={20} />,
        element: <GetPurchase />,
        notifications: () => 0,
    },
    {
        path: 'receive-items',
        gateKey: 'receiveItemView',
        name: 'Receive Items',
        icon: <Truck size={20} />,
        element: <ReceiveItems />,
        notifications: (sheets) =>
            sheets.filter((sheet) => sheet.planned5 !== '' && sheet.actual5 === '').length,
    },

    {
        path: 'store-out-approval',
        gateKey: 'storeOutApprovalView',
        name: 'Store Out Approval',
        icon: <PackageCheck size={20} />,
        element: <StoreOutApproval />,
        notifications: (sheets) =>
            sheets.filter(
                (sheet) =>
                    sheet.planned6 !== '' &&
                    sheet.actual6 === '' &&
                    sheet.indentType === 'Store Out'
            ).length,
    },
    {
        path: 'administration',
        gateKey: 'administrate',
        name: 'Adminstration',
        icon: <ShieldUser size={20} />,
        element: <Administration />,
        notifications: () => 0,
    },
];

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <SheetsProvider>
                                    <App routes={routes} />
                                </SheetsProvider>
                            </ProtectedRoute>
                        }
                    >
                        {routes.map(({ path, element, gateKey }) => {
                            // console.log("path", path);
                            return <Route
                                path={path}
                                element={<GatedRoute identifier={gateKey}>{element}</GatedRoute>}
                            />
                        })}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    </StrictMode>
);
