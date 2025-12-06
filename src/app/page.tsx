"use client";

import { useSession } from "next-auth/react";
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
    Users,
    Pill,
    Clock,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    ArrowUpRight,
} from "lucide-react";

// Datos de ejemplo para el dashboard
const stats = [
    {
        title: "Productos",
        value: "1,284",
        change: "+12%",
        trend: "up",
        icon: Package,
        color: "from-blue-500 to-blue-600",
    },
    {
        title: "Pacientes Activos",
        value: "4,532",
        change: "+8%",
        trend: "up",
        icon: Users,
        color: "from-emerald-500 to-emerald-600",
    },
    {
        title: "Entregas Hoy",
        value: "127",
        change: "+23%",
        trend: "up",
        icon: Pill,
        color: "from-purple-500 to-purple-600",
    },
    {
        title: "Pendientes",
        value: "45",
        change: "-5%",
        trend: "down",
        icon: Clock,
        color: "from-amber-500 to-amber-600",
    },
];

const alerts = [
    {
        type: "warning",
        message: "15 productos con stock bajo",
        time: "Hace 2 horas",
    },
    {
        type: "info",
        message: "Traslado #TR-2024-089 recibido",
        time: "Hace 3 horas",
    },
    {
        type: "warning",
        message: "8 medicamentos próximos a vencer",
        time: "Hace 5 horas",
    },
];

const recentDeliveries = [
    { patient: "María González", items: 3, eps: "Nueva EPS", status: "completed" },
    { patient: "Carlos Rodríguez", items: 2, eps: "Sura", status: "completed" },
    { patient: "Ana Martínez", items: 5, eps: "Sanitas", status: "pending" },
    { patient: "Juan Pérez", items: 1, eps: "Compensar", status: "completed" },
];

export default function DashboardPage() {
    const { data: session } = useSession();

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
                {stats.map((stat) => (
                    <Card key={stat.title} className="relative overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        {stat.title}
                                    </p>
                                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                                    <div className="flex items-center gap-1 mt-2">
                                        <TrendingUp
                                            className={`h-4 w-4 ${stat.trend === "up" ? "text-emerald-500" : "text-red-500"
                                                }`}
                                        />
                                        <span
                                            className={`text-sm font-medium ${stat.trend === "up" ? "text-emerald-500" : "text-red-500"
                                                }`}
                                        >
                                            {stat.change}
                                        </span>
                                        <span className="text-xs text-gray-500">vs mes anterior</span>
                                    </div>
                                </div>
                                <div
                                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}
                                >
                                    <stat.icon className="h-6 w-6 text-white" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

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
                        <div className="space-y-4">
                            {alerts.map((alert, index) => (
                                <div
                                    key={index}
                                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                                >
                                    <div
                                        className={`w-2 h-2 rounded-full mt-2 ${alert.type === "warning" ? "bg-amber-500" : "bg-blue-500"
                                            }`}
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{alert.message}</p>
                                        <p className="text-xs text-gray-500 mt-1">{alert.time}</p>
                                    </div>
                                    <ArrowUpRight className="h-4 w-4 text-gray-400" />
                                </div>
                            ))}
                        </div>
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
                        <div className="space-y-4">
                            {recentDeliveries.map((delivery, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                                            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                                                {delivery.patient.charAt(0)}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{delivery.patient}</p>
                                            <p className="text-xs text-gray-500">
                                                {delivery.items} items • {delivery.eps}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge
                                        variant={delivery.status === "completed" ? "default" : "secondary"}
                                        className={
                                            delivery.status === "completed"
                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                : ""
                                        }
                                    >
                                        {delivery.status === "completed" ? (
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                        ) : (
                                            <Clock className="h-3 w-3 mr-1" />
                                        )}
                                        {delivery.status === "completed" ? "Entregado" : "Pendiente"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
