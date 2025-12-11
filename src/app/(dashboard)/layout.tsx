"use client";

// Dashboard layout - just passes children through
// The actual sidebar is provided by ClientLayout in the root layout
export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
