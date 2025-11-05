import type { JSX } from "react";
import type { IndentSheet, UserPermissions } from "./sheets";

export interface RouteAttributes {
    name: string;
    element: JSX.Element;
    path: string;
    icon: JSX.Element;
    gateKey?: keyof UserPermissions;
    notifications: (sheet: IndentSheet[]) => number
}
