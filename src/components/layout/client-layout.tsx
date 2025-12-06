"use client";

import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { AppSidebar, MobileNav } from "@/components/layout/sidebar";

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // No mostrar sidebar en rutas de auth
    const isAuthRoute = pathname?.startsWith("/login");

    if (isAuthRoute) {
        return <SessionProvider>{children}</SessionProvider>;
    }

    return (
        <SessionProvider>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
                {/* Sidebar Desktop */}
                <AppSidebar />

                {/* Main Content */}
                <div className="lg:pl-64">
                    {/* Top Bar Mobile */}
                    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-4 lg:hidden">
                        <MobileNav />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
                                <svg
                                    className="w-5 h-5 text-white"
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
                            <span className="font-bold text-lg">AbastGo</span>
                        </div>
                    </header>

                    {/* Page Content */}
                    <main className="p-4 lg:p-6">{children}</main>
                </div>
            </div>
        </SessionProvider>
    );
}
