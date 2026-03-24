import type { JSX } from "react";
import type { IndentSheet, PoMasterSheet, ReceivedSheet, UserPermissions } from "./sheets";

export interface NotificationSheets {
    indentSheet: IndentSheet[];
    poMasterSheet: PoMasterSheet[];
    receivedSheet: ReceivedSheet[];
}

export interface RouteAttributes {
    name: string;
    element: JSX.Element;
    path: string;
    icon: JSX.Element;
    gateKey?: keyof UserPermissions;
    notifications: (sheets: NotificationSheets) => number;
}
