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
    Menu,
    LogOut,
    Settings,
    ChevronDown,
} from "lucide-react";

interface NavItem {
    title: string;
    href: string;
    icon: React.ReactNode;
    permission?: string;
}

interface NavGroup {
    title: string;
    items: NavItem[];
}

const navigation: NavGroup[] = [
    {
        title: "Principal",
        items: [
            { title: "Dashboard", href: "/", icon: <LayoutDashboard className="h-4 w-4" /> },
        ],
    },
    {
        title: "Catálogo",
        items: [
            { title: "Productos", href: "/productos", icon: <Package className="h-4 w-4" />, permission: "products.view" },
            { title: "Bodegas", href: "/bodegas", icon: <Warehouse className="h-4 w-4" />, permission: "warehouses.view" },
            { title: "Usuarios", href: "/usuarios", icon: <Users className="h-4 w-4" />, permission: "users.view" },
        ],
    },
    {
        title: "Inventario",
        items: [
            { title: "Compras", href: "/compras", icon: <ShoppingCart className="h-4 w-4" />, permission: "purchases.view" },
            { title: "Traslados", href: "/traslados", icon: <ArrowRightLeft className="h-4 w-4" />, permission: "transfers.view" },
            { title: "Existencias", href: "/inventario", icon: <ClipboardList className="h-4 w-4" />, permission: "inventory.view" },
        ],
    },
    {
        title: "Dispensación",
        items: [
            { title: "Pacientes", href: "/pacientes", icon: <UserRound className="h-4 w-4" />, permission: "patients.view" },
            { title: "Entregas", href: "/dispensacion", icon: <Pill className="h-4 w-4" />, permission: "deliveries.view" },
            { title: "Pendientes", href: "/pendientes", icon: <Clock className="h-4 w-4" />, permission: "pending.view" },
        ],
    },
    {
        title: "Reportes",
        items: [
            { title: "Informes", href: "/reportes", icon: <FileBarChart className="h-4 w-4" />, permission: "reports.view" },
            { title: "Auditoría", href: "/auditoria", icon: <History className="h-4 w-4" />, permission: "audit.view" },
        ],
    },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const userPermissions = session?.user?.permissions || [];

    const hasPermission = (permission?: string) => {
        if (!permission) return true;
        if (session?.user?.roles?.includes("admin")) return true;
        return userPermissions.includes(permission);
    };

    return (
        <nav className="flex-1 space-y-6 py-4">
            {navigation.map((group) => {
                const visibleItems = group.items.filter((item) => hasPermission(item.permission));
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
                <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Configuración
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

export function AppSidebar() {
    return (
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-800">
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
                    AbastGo
                </span>
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
                        AbastGo
                    </span>
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
