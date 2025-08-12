import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarHeader,
    SidebarFooter,
    SidebarSeparator,
} from '@/components/ui/sidebar';
import { useAuth } from '@/context/AuthContext';
import { useSheets } from '@/context/SheetsContext';
import type { RouteAttributes } from '@/types';
import { LogOut, RotateCw, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Logo from './Logo';

export default ({ items }: { items: RouteAttributes[] }) => {
    // console.log("items", items);
    const navigate = useNavigate();
    const { indentSheet, updateAll, allLoading } = useSheets();
    const { user, logout } = useAuth();

    // Add Get Purchase item to the existing items
    const allItems = [
        ...items,
    ];

    return (
        <Sidebar side="left" variant="inset" collapsible="offcanvas">
            <SidebarHeader className="p-3 border-b-1">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <Logo />

                        <div>
                            <h2 className="text-xl font-bold">Store App</h2>
                            <p className="text-sm">Management System</p>
                        </div>
                    </div>
                    <Button variant="ghost" className="size-7" onClick={() => updateAll()} disabled={allLoading}>
                        <RotateCw />
                    </Button>
                </div>
                <SidebarSeparator />
                <div className="flex justify-between items-center px-3 text-xs text-muted-foreground">
                    <div>
                        <p>
                            Name: <span className="font-semibold">{user.name}</span>
                        </p>
                        <p>
                            Username: <span className="font-semibold">{user.username}</span>
                        </p>
                    </div>
                    <Button variant="outline" className="size-8" onClick={() => logout()}>
                        <LogOut />
                    </Button>
                </div>
            </SidebarHeader>
            <SidebarContent className="py-1 border-b-1">
                <SidebarGroup>
                    <SidebarMenu>
                        {allItems
                            .filter((item) =>
                                item.gateKey ? user[item.gateKey] !== 'No Access' : true
                            )
                            .map((item, i) => (
                                <SidebarMenuItem key={i}>
                                    <SidebarMenuButton
                                        className="transition-colors duration-200 rounded-md py-5 flex justify-between font-medium text-secondary-foreground"
                                        onClick={() => navigate(item.path)}
                                        isActive={window.location.pathname.slice(1) === item.path}
                                    >
                                        {' '}
                                        <div className="flex gap-2 items-center">
                                            {item.icon}
                                            {item.name}
                                        </div>
                                        {item.notifications(indentSheet) !== 0 && (
                                            <span className="bg-destructive text-secondary  w-[1.3rem] h-[1.3rem] rounded-full text-xs grid place-items-center text-center">
                                                {item.notifications(indentSheet)}
                                            </span>
                                        )}
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <div className="p-2 text-center text-sm">
                    Powered by &#8208;{' '}
                    <a className="text-primary" href="https://botivate.in" target="_blank">
                        Botivate
                    </a>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
};
