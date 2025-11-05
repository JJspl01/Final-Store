import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import Sidebar from '@/components/element/Sidebar';
import { Outlet } from 'react-router-dom';
import type { RouteAttributes } from './types';

export default ({ routes }: { routes: RouteAttributes[] }) => {
    return (
        <div className="flex w-full h-screen">
                <SidebarProvider>
                    <Sidebar items={routes} />
                    <SidebarInset>
                        <main className="flex-1 overflow-y-auto rounded-md">
                            <div className="h-full">
                                <Outlet />
                            </div>
                        </main>
                    </SidebarInset>
                </SidebarProvider>
        </div>
    );
};
