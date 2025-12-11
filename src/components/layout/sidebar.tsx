"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
    LayoutDashboard,
    Package,
    Warehouse,
    Users,
    ShoppingCart,
    ArrowRightLeft,
    ClipboardList,
    UserRound,
    Pill,
    Clock,
    FileBarChart,
    History,
    RotateCcw,
    Menu,
    LogOut,
    Settings,
    ChevronDown,
    PanelLeftClose,
    Shield,
} from "lucide-react";

interface NavItem {
    title: string;
    href: string;
    icon: React.ReactNode;
    allowedRoles?: string[]; // Roles que pueden ver este item
    superAdminOnly?: boolean;
}

interface NavGroup {
    title: string;
    items: NavItem[];
    superAdminOnly?: boolean;
    allowedRoles?: string[]; // Roles que pueden ver este grupo
}

// Roles: OWNER, ADMIN, OPERATOR, DISPENSER
const ADMIN_ROLES = ['OWNER', 'ADMIN'];
const OPERATOR_ROLES = ['OWNER', 'ADMIN', 'OPERATOR'];
const DISPENSER_ROLES = ['OWNER', 'ADMIN', 'DISPENSER'];
const ALL_ROLES = ['OWNER', 'ADMIN', 'OPERATOR', 'DISPENSER'];

const navigation: NavGroup[] = [
    {
        title: "Super Admin",
        superAdminOnly: true,
        items: [
            { title: "Panel Admin", href: "/admin", icon: <Shield className="h-4 w-4" />, superAdminOnly: true },
        ],
    },
    {
        title: "Principal",
        items: [
            { title: "Dashboard", href: "/", icon: <LayoutDashboard className="h-4 w-4" />, allowedRoles: ALL_ROLES },
        ],
    },
    {
        title: "Catálogo",
        allowedRoles: ADMIN_ROLES,
        items: [
            { title: "Catálogo", href: "/catalogo", icon: <Package className="h-4 w-4" />, allowedRoles: ADMIN_ROLES },
            { title: "Bodegas", href: "/bodegas", icon: <Warehouse className="h-4 w-4" />, allowedRoles: ADMIN_ROLES },
            { title: "Usuarios", href: "/usuarios", icon: <Users className="h-4 w-4" />, allowedRoles: ADMIN_ROLES },
        ],
    },
    {
        title: "Inventario",
        allowedRoles: OPERATOR_ROLES,
        items: [
            { title: "Entradas", href: "/entradas", icon: <ShoppingCart className="h-4 w-4" />, allowedRoles: OPERATOR_ROLES },
            { title: "Traslados", href: "/traslados", icon: <ArrowRightLeft className="h-4 w-4" />, allowedRoles: OPERATOR_ROLES },
            { title: "Devoluciones", href: "/devoluciones", icon: <RotateCcw className="h-4 w-4" />, allowedRoles: OPERATOR_ROLES },
            { title: "Existencias", href: "/inventario", icon: <Package className="h-4 w-4" />, allowedRoles: OPERATOR_ROLES },
            { title: "Kardex", href: "/kardex", icon: <History className="h-4 w-4" />, allowedRoles: OPERATOR_ROLES },
        ],
    },
    {
        title: "Compras",
        allowedRoles: ADMIN_ROLES,
        items: [
            { title: "Compras", href: "/compras", icon: <ClipboardList className="h-4 w-4" />, allowedRoles: ADMIN_ROLES },
        ],
    },
    {
        title: "Dispensación",
        allowedRoles: DISPENSER_ROLES,
        items: [
            { title: "Pacientes", href: "/pacientes", icon: <UserRound className="h-4 w-4" />, allowedRoles: DISPENSER_ROLES },
            { title: "Entregas", href: "/dispensacion", icon: <Pill className="h-4 w-4" />, allowedRoles: DISPENSER_ROLES },
            { title: "Pendientes", href: "/pendientes", icon: <Clock className="h-4 w-4" />, allowedRoles: DISPENSER_ROLES },
        ],
    },
    {
        title: "Reportes",
        allowedRoles: ADMIN_ROLES,
        items: [
            { title: "Informes", href: "/reportes", icon: <FileBarChart className="h-4 w-4" />, allowedRoles: ADMIN_ROLES },
            { title: "Por EPS", href: "/reportes-eps", icon: <FileBarChart className="h-4 w-4" />, allowedRoles: ADMIN_ROLES },
            { title: "Facturación", href: "/facturacion", icon: <FileBarChart className="h-4 w-4" />, allowedRoles: ADMIN_ROLES },
            { title: "Auditoría", href: "/auditoria", icon: <History className="h-4 w-4" />, allowedRoles: ADMIN_ROLES },
        ],
    },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const isSuperAdmin = session?.user?.isSuperAdmin || false;
    const userRole = session?.user?.orgRole || 'DISPENSER'; // Default to lowest access

    const hasRoleAccess = (allowedRoles?: string[]) => {
        if (!allowedRoles) return true; // No restriction
        if (isSuperAdmin) return true; // Super Admin sees everything
        return allowedRoles.includes(userRole);
    };

    return (
        <nav className="flex-1 space-y-6 py-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
            {navigation.map((group) => {
                // Skip superAdminOnly groups if not super admin
                if (group.superAdminOnly && !isSuperAdmin) return null;

                // Skip groups user doesn't have access to
                if (group.allowedRoles && !hasRoleAccess(group.allowedRoles)) return null;

                const visibleItems = group.items.filter((item) => {
                    // Check superAdminOnly items
                    if (item.superAdminOnly && !isSuperAdmin) return false;
                    return hasRoleAccess(item.allowedRoles);
                });
                if (visibleItems.length === 0) return null;

                return (
                    <div key={group.title}>
                        <h3 className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                            {group.title}
                        </h3>
                        <ul className="space-y-1">
                            {visibleItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            onClick={onNavigate}
                                            className={cn(
                                                "flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg mx-2 transition-all",
                                                isActive
                                                    ? "bg-gradient-to-r from-blue-500/10 to-emerald-500/10 text-blue-600 dark:text-blue-400 border-l-2 border-blue-500"
                                                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                            )}
                                        >
                                            {item.icon}
                                            {item.title}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                );
            })}
        </nav>
    );
}

function UserMenu() {
    const { data: session } = useSession();

    if (!session?.user) return null;

    const initials = session.user.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "U";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 px-4 py-6">
                    <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-emerald-500 text-white text-sm font-semibold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                        <p className="text-sm font-medium">{session.user.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {session.user.roles?.[0] || "Usuario"}
                        </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/perfil" className="cursor-pointer w-full flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        Configuración
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-red-600 dark:text-red-400 focus:text-red-600"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesión
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

import { OrganizationSwitcher } from "@/components/layout/organization-switcher";

// ... existing imports ...

export function AppSidebar({ className, onClose }: { className?: string; onClose?: () => void }) {
    return (
        <aside className={cn("hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-transform duration-300", className)}>
            {/* Logo */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg">
                        <svg
                            className="w-6 h-6 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                            />
                        </svg>
                    </div>
                    <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
                        DispenzaBot
                    </span>
                </div>
                {onClose && (
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <PanelLeftClose className="h-5 w-5" />
                    </Button>
                )}
            </div>

            {/* Organization Switcher */}
            <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-center">
                <OrganizationSwitcher />
            </div>

            {/* Navigation */}
            <NavLinks />

            {/* User Menu */}
            <div className="border-t border-gray-200 dark:border-gray-800">
                <UserMenu />
            </div>
        </aside>
    );
}

export function MobileNav() {
    const [open, setOpen] = useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-6 w-6" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
                {/* Logo */}
                <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
                        <svg
                            className="w-6 h-6 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                            />
                        </svg>
                    </div>
                    <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
                        DispenzaBot
                    </span>
                </div>

                <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-center">
                    <OrganizationSwitcher />
                </div>

                {/* Navigation */}
                <NavLinks onNavigate={() => setOpen(false)} />

                {/* User Menu */}
                <div className="border-t border-gray-200 dark:border-gray-800">
                    <UserMenu />
                </div>
            </SheetContent>
        </Sheet>
    );
}
