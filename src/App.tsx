import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import Sidebar from '@/components/element/Sidebar';
import { Outlet } from 'react-router-dom';
import type { RouteAttributes } from './types';

export default ({ routes }: { routes: RouteAttributes[] }) => {
    return (
        <div className="flex w-full h-screen overflow-hidden">
            <SidebarProvider>
                <Sidebar items={routes} variant="inset" collapsible="icon" />
                <SidebarInset className="min-w-0 overflow-hidden flex flex-col h-screen">
                    <div className="flex-1 overflow-auto p-4 min-w-0">
                        <Outlet />
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </div>
    );
};
