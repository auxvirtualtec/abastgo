import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Login - AbastGo",
    description: "Inicia sesión en el sistema de gestión de dispensarios",
};

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
            {children}
        </div>
    );
}
