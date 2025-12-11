"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    History,
    Search,
    Loader2,
    Plus,
    Edit,
    Trash2,
    Eye,
    User,
    Calendar,
} from "lucide-react";

interface AuditLog {
    id: string;
    action: string;
    entity: string;
    entityId: string;
    oldValues: any;
    newValues: any;
    createdAt: string;
    user: { id: string; name: string; email: string } | null;
}

interface Stats {
    total: number;
    creates: number;
    updates: number;
    deletes: number;
}

export default function AuditoriaPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<Stats>({ total: 0, creates: 0, updates: 0, deletes: 0 });
    const [entities, setEntities] = useState<{ name: string; count: number }[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    // Filtros
    const [filterEntity, setFilterEntity] = useState("");
    const [filterAction, setFilterAction] = useState("");
    const [filterUser, setFilterUser] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Modal detalle
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    useEffect(() => {
        loadLogs();
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const response = await fetch('/api/users');
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const loadLogs = async () => {
        setLoading(true);
        try {
            let url = '/api/audit?';
            if (filterEntity) url += `entity=${filterEntity}&`;
            if (filterAction) url += `action=${filterAction}&`;
            if (filterUser) url += `userId=${filterUser}&`;
            if (startDate) url += `startDate=${startDate}&`;
            if (endDate) url += `endDate=${endDate}&`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setLogs(data.logs || []);
                setStats(data.stats || { total: 0, creates: 0, updates: 0, deletes: 0 });
                setEntities(data.entities || []);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'CREATE':
                return <Plus className="h-4 w-4 text-green-500" />;
            case 'UPDATE':
                return <Edit className="h-4 w-4 text-blue-500" />;
            case 'DELETE':
                return <Trash2 className="h-4 w-4 text-red-500" />;
            default:
                return <History className="h-4 w-4" />;
        }
    };

    const getActionBadge = (action: string) => {
        const styles: Record<string, string> = {
            'CREATE': 'bg-green-100 text-green-700',
            'UPDATE': 'bg-blue-100 text-blue-700',
            'DELETE': 'bg-red-100 text-red-700'
        };
        const labels: Record<string, string> = {
            'CREATE': 'Crear',
            'UPDATE': 'Editar',
            'DELETE': 'Eliminar'
        };
        return (
            <Badge className={styles[action] || ''}>
                {labels[action] || action}
            </Badge>
        );
    };

    const getEntityLabel = (entity: string) => {
        const labels: Record<string, string> = {
            'users': 'Usuarios',
            'products': 'Productos',
            'inventory': 'Inventario',
            'deliveries': 'Entregas',
            'transfers': 'Traslados',
            'warehouses': 'Bodegas',
            'patients': 'Pacientes',
            'pending_items': 'Pendientes',
            'inventory_returns': 'Devoluciones',
            'receipts': 'Entradas'
        };
        return labels[entity] || entity;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderJsonDiff = (oldVal: any, newVal: any) => {
        if (!oldVal && !newVal) return null;

        return (
            <div className="grid grid-cols-2 gap-4">
                {oldVal && (
                    <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">Valores Anteriores</p>
                        <pre className="text-xs bg-red-50 dark:bg-red-900/20 p-3 rounded overflow-auto max-h-60">
                            {JSON.stringify(oldVal, null, 2)}
                        </pre>
                    </div>
                )}
                {newVal && (
                    <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">Valores Nuevos</p>
                        <pre className="text-xs bg-green-50 dark:bg-green-900/20 p-3 rounded overflow-auto max-h-60">
                            {JSON.stringify(newVal, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <History className="h-6 w-6" />
                    Auditoría del Sistema
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Registro de todas las acciones realizadas en el sistema
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                <History className="h-5 w-5 text-gray-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Total Registros</p>
                                <p className="text-xl font-bold">{stats.total.toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <Plus className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Creaciones</p>
                                <p className="text-xl font-bold">{stats.creates.toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Edit className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Ediciones</p>
                                <p className="text-xl font-bold">{stats.updates.toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                                <Trash2 className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Eliminaciones</p>
                                <p className="text-xl font-bold">{stats.deletes.toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filtros */}
            <Card>
                <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                        <div>
                            <Label className="text-xs">Entidad</Label>
                            <select
                                value={filterEntity}
                                onChange={(e) => setFilterEntity(e.target.value)}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="">Todas</option>
                                {entities.map(e => (
                                    <option key={e.name} value={e.name}>
                                        {getEntityLabel(e.name)} ({e.count})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <Label className="text-xs">Acción</Label>
                            <select
                                value={filterAction}
                                onChange={(e) => setFilterAction(e.target.value)}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="">Todas</option>
                                <option value="CREATE">Crear</option>
                                <option value="UPDATE">Editar</option>
                                <option value="DELETE">Eliminar</option>
                            </select>
                        </div>

                        <div>
                            <Label className="text-xs">Usuario</Label>
                            <select
                                value={filterUser}
                                onChange={(e) => setFilterUser(e.target.value)}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="">Todos</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <Label className="text-xs">Desde</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="h-9"
                            />
                        </div>

                        <div>
                            <Label className="text-xs">Hasta</Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="h-9"
                            />
                        </div>

                        <Button onClick={loadLogs} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                            Filtrar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Tabla */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Registros de Auditoría</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No hay registros de auditoría</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                                        <TableHead className="text-xs w-40">Fecha/Hora</TableHead>
                                        <TableHead className="text-xs">Acción</TableHead>
                                        <TableHead className="text-xs">Entidad</TableHead>
                                        <TableHead className="text-xs">ID Registro</TableHead>
                                        <TableHead className="text-xs">Usuario</TableHead>
                                        <TableHead className="text-xs w-20">Detalles</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map(log => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-xs">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-3 w-3 text-gray-400" />
                                                    {formatDate(log.createdAt)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {getActionIcon(log.action)}
                                                    {getActionBadge(log.action)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{getEntityLabel(log.entity)}</Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{log.entityId.slice(0, 8)}...</TableCell>
                                            <TableCell>
                                                {log.user ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                                            <User className="h-3 w-3" />
                                                        </div>
                                                        <span className="text-sm">{log.user.name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">Sistema</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setSelectedLog(log)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal Detalle */}
            <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selectedLog && getActionIcon(selectedLog.action)}
                            Detalle de Auditoría
                        </DialogTitle>
                    </DialogHeader>

                    {selectedLog && (
                        <div className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500">Acción</p>
                                    <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Entidad</p>
                                    <p className="font-medium">{getEntityLabel(selectedLog.entity)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">ID del Registro</p>
                                    <p className="font-mono text-sm">{selectedLog.entityId}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Fecha/Hora</p>
                                    <p>{formatDate(selectedLog.createdAt)}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-xs text-gray-500">Usuario</p>
                                    <p>{selectedLog.user?.name || 'Sistema'} ({selectedLog.user?.email || '-'})</p>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <p className="text-sm font-medium mb-3">Cambios Realizados</p>
                                {renderJsonDiff(selectedLog.oldValues, selectedLog.newValues)}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
