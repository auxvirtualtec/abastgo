"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Package,
    Warehouse,
    Pill,
    Clock,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    ArrowUpRight,
    Loader2,
    DollarSign,
    Calendar,
} from "lucide-react";

interface DashboardStats {
    totalProducts: number;
    totalWarehouses: number;
    totalInventoryValue: number;
    deliveriesToday: number;
    deliveriesMonth: number;
    pendingItems: number;
    expiringItems: number;
    lowStockItems: number;
}

interface Alert {
    type: string;
    message: string;
    href: string;
}

interface RecentDelivery {
    id: string;
    patientName: string;
    warehouse: string;
    itemsCount: number;
    date: string;
    status: string;
}

export default function DashboardPage() {
    const { data: session } = useSession();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [recentDeliveries, setRecentDeliveries] = useState<RecentDelivery[]>([]);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            const response = await fetch('/api/dashboard');
            if (response.ok) {
                const data = await response.json();
                setStats(data.stats);
                setAlerts(data.alerts || []);
                setRecentDeliveries(data.recentDeliveries || []);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = stats ? [
        {
            title: "Productos",
            value: stats.totalProducts.toLocaleString(),
            icon: Package,
            color: "from-blue-500 to-blue-600",
            href: "/productos"
        },
        {
            title: "Valor Inventario",
            value: `$${stats.totalInventoryValue.toLocaleString()}`,
            icon: DollarSign,
            color: "from-emerald-500 to-emerald-600",
            href: "/inventario"
        },
        {
            title: "Entregas Hoy",
            value: stats.deliveriesToday.toString(),
            icon: Pill,
            color: "from-purple-500 to-purple-600",
            href: "/dispensacion"
        },
        {
            title: "Pendientes",
            value: stats.pendingItems.toString(),
            icon: Clock,
            color: "from-amber-500 to-amber-600",
            href: "/pendientes"
        },
    ] : [];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Dashboard
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Bienvenido, {session?.user?.name || "Usuario"}. Aquí tienes un resumen del día.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => (
                    <Link key={stat.title} href={stat.href}>
                        <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            {stat.title}
                                        </p>
                                        <p className="text-2xl font-bold mt-1">{stat.value}</p>
                                    </div>
                                    <div
                                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}
                                    >
                                        <stat.icon className="h-6 w-6 text-white" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Secondary Stats */}
            {stats && (
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Warehouse className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Bodegas Activas</p>
                                <p className="text-lg font-bold">{stats.totalWarehouses}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <Calendar className="h-5 w-5 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Por Vencer (30d)</p>
                                <p className="text-lg font-bold">{stats.expiringItems}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <TrendingUp className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Stock Bajo</p>
                                <p className="text-lg font-bold">{stats.lowStockItems}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Two Column Layout */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Alerts */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Alertas
                        </CardTitle>
                        <CardDescription>Notificaciones importantes del sistema</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {alerts.length === 0 ? (
                            <div className="text-center py-6 text-gray-500">
                                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                                <p>Sin alertas pendientes</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {alerts.map((alert, index) => (
                                    <Link key={index} href={alert.href}>
                                        <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                                            <div
                                                className={`w-2 h-2 rounded-full mt-2 ${alert.type === "warning" ? "bg-amber-500" :
                                                        alert.type === "danger" ? "bg-red-500" : "bg-blue-500"
                                                    }`}
                                            />
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{alert.message}</p>
                                            </div>
                                            <ArrowUpRight className="h-4 w-4 text-gray-400" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Deliveries */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Pill className="h-5 w-5 text-emerald-500" />
                            Entregas Recientes
                        </CardTitle>
                        <CardDescription>Últimas dispensaciones del día</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {recentDeliveries.length === 0 ? (
                            <div className="text-center py-6 text-gray-500">
                                <Pill className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                <p>No hay entregas recientes</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {recentDeliveries.map((delivery) => (
                                    <div
                                        key={delivery.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                                                    {delivery.patientName.charAt(0)}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{delivery.patientName}</p>
                                                <p className="text-xs text-gray-500">
                                                    {delivery.itemsCount} items • {delivery.warehouse}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge
                                            variant={delivery.status === "COMPLETED" ? "default" : "secondary"}
                                            className={
                                                delivery.status === "COMPLETED"
                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                    : ""
                                            }
                                        >
                                            {delivery.status === "COMPLETED" ? (
                                                <CheckCircle className="h-3 w-3 mr-1" />
                                            ) : (
                                                <Clock className="h-3 w-3 mr-1" />
                                            )}
                                            {delivery.status === "COMPLETED" ? "Entregado" : "Pendiente"}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
