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
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Clock,
    CheckCircle,
    XCircle,
    Bell,
    Package,
    Loader2,
    Search,
    AlertTriangle,
    Phone,
    Pill,
} from "lucide-react";

interface PendingItem {
    id: string;
    createdAt: string;
    pendingQty: number;
    deliveredQty: number;
    status: string;
    reason: string;
    notes?: string;
    patient: {
        id: string;
        name: string;
        documentNumber: string;
        phone?: string;
    };
    product: {
        id: string;
        code: string;
        name: string;
    };
    warehouse?: {
        id: string;
        name: string;
    };
}

interface InventoryItem {
    productId: string;
    productName: string;
    warehouseId: string;
    warehouseName: string;
    totalQuantity: number;
    lots: {
        inventoryId: string;
        lotNumber: string;
        quantity: number;
    }[];
}

const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800 border-yellow-300",
    PARTIAL: "bg-blue-100 text-blue-800 border-blue-300",
    DELIVERED: "bg-green-100 text-green-800 border-green-300",
    CANCELLED: "bg-red-100 text-red-800 border-red-300",
    NOTIFIED: "bg-purple-100 text-purple-800 border-purple-300"
};

const STATUS_LABELS: Record<string, string> = {
    PENDING: "Pendiente",
    PARTIAL: "Parcial",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado",
    NOTIFIED: "Notificado"
};

const REASON_LABELS: Record<string, string> = {
    SIN_STOCK: "Sin Stock",
    AGOTADO: "Agotado",
    NO_DISPONIBLE: "No Disponible",
    OTRO: "Otro"
};

export default function PendientesPage() {
    const [items, setItems] = useState<PendingItem[]>([]);
    const [stats, setStats] = useState<Record<string, { count: number; quantity: number }>>({});
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState("PENDING");
    const [search, setSearch] = useState("");

    // Modal de entrega
    const [deliverDialogOpen, setDeliverDialogOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [selectedInventory, setSelectedInventory] = useState<string>("");
    const [deliverQty, setDeliverQty] = useState(0);
    const [deliverNotes, setDeliverNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadPendingItems();
    }, [statusFilter]);

    const loadPendingItems = async () => {
        setLoading(true);
        try {
            let url = `/api/pending-items?status=${statusFilter}`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setItems(data.items || []);
                setStats(data.stats || {});
            }
        } catch (error) {
            console.error('Error cargando pendientes:', error);
        } finally {
            setLoading(false);
        }
    };

    const openDeliverDialog = async (item: PendingItem) => {
        setSelectedItem(item);
        setDeliverQty(item.pendingQty);
        setDeliverNotes("");
        setSelectedInventory("");
        setDeliverDialogOpen(true);

        // Buscar inventario disponible del producto
        try {
            const response = await fetch(`/api/inventory?search=${item.product.code}`);
            if (response.ok) {
                const data = await response.json();
                setInventory(data.items || []);
            }
        } catch (error) {
            console.error('Error buscando inventario:', error);
        }
    };

    const handleDeliver = async () => {
        if (!selectedItem || deliverQty <= 0) return;

        setSubmitting(true);
        try {
            const lot = inventory.find(i => i.lots.some(l => l.inventoryId === selectedInventory))?.lots.find(l => l.inventoryId === selectedInventory);

            const response = await fetch('/api/pending-items', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedItem.id,
                    action: 'DELIVER',
                    deliveredQty: deliverQty,
                    inventoryId: selectedInventory || undefined,
                    notes: deliverNotes
                })
            });

            if (response.ok) {
                setDeliverDialogOpen(false);
                loadPendingItems();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Error entregando pendiente');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAction = async (id: string, action: string) => {
        const notes = action === 'CANCEL' ? prompt('Motivo de cancelación:') : undefined;
        if (action === 'CANCEL' && !notes) return;

        try {
            const response = await fetch('/api/pending-items', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action, notes })
            });

            if (response.ok) {
                loadPendingItems();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Error actualizando pendiente');
        }
    };

    const filteredItems = search
        ? items.filter(i =>
            i.patient.name.toLowerCase().includes(search.toLowerCase()) ||
            i.patient.documentNumber.includes(search) ||
            i.product.name.toLowerCase().includes(search.toLowerCase())
        )
        : items;

    const totalPending = stats.PENDING?.count || 0;
    const totalPartial = stats.PARTIAL?.count || 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Gestión de Pendientes</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Administra los medicamentos pendientes de entrega a pacientes
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { status: 'PENDING', label: 'Pendientes', icon: Clock, color: 'yellow' },
                    { status: 'PARTIAL', label: 'Parciales', icon: AlertTriangle, color: 'blue' },
                    { status: 'NOTIFIED', label: 'Notificados', icon: Bell, color: 'purple' },
                    { status: 'DELIVERED', label: 'Entregados', icon: CheckCircle, color: 'green' },
                    { status: 'CANCELLED', label: 'Cancelados', icon: XCircle, color: 'red' }
                ].map(({ status, label, icon: Icon, color }) => (
                    <Card
                        key={status}
                        className={`cursor-pointer transition-all ${statusFilter === status ? 'ring-2 ring-offset-2' : ''}`}
                        onClick={() => setStatusFilter(status)}
                    >
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center`}>
                                    <Icon className={`h-5 w-5 text-${color}-600`} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{label}</p>
                                    <p className="text-xl font-bold">{stats[status]?.count || 0}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Búsqueda */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex gap-4">
                        <Input
                            placeholder="Buscar por paciente, documento o producto..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1"
                        />
                        <Button variant="outline" onClick={loadPendingItems} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            <span className="ml-2">Actualizar</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Lista de pendientes */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {STATUS_LABELS[statusFilter]} ({filteredItems.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No hay items {STATUS_LABELS[statusFilter].toLowerCase()}</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                                        <TableHead className="text-xs">Fecha</TableHead>
                                        <TableHead className="text-xs">Paciente</TableHead>
                                        <TableHead className="text-xs">Producto</TableHead>
                                        <TableHead className="text-xs text-center">Pendiente</TableHead>
                                        <TableHead className="text-xs text-center">Entregado</TableHead>
                                        <TableHead className="text-xs">Motivo</TableHead>
                                        <TableHead className="text-xs">Estado</TableHead>
                                        <TableHead className="text-xs text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="text-xs text-gray-500">
                                                {new Date(item.createdAt).toLocaleDateString('es-CO')}
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-sm">{item.patient.name}</p>
                                                    <p className="text-xs text-gray-500">{item.patient.documentNumber}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="text-sm">{item.product.name}</p>
                                                    <p className="text-xs text-gray-500">{item.product.code}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={item.pendingQty > 0 ? "destructive" : "secondary"}>
                                                    {item.pendingQty}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline">{item.deliveredQty || 0}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {REASON_LABELS[item.reason] || item.reason}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={STATUS_COLORS[item.status]}>
                                                    {STATUS_LABELS[item.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {(item.status === 'PENDING' || item.status === 'PARTIAL' || item.status === 'NOTIFIED') && (
                                                    <div className="flex gap-1 justify-end">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-xs"
                                                            onClick={() => openDeliverDialog(item)}
                                                        >
                                                            <Pill className="h-3 w-3 mr-1" />
                                                            Entregar
                                                        </Button>
                                                        {item.status !== 'NOTIFIED' && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 w-7 p-0"
                                                                onClick={() => handleAction(item.id, 'NOTIFY')}
                                                                title="Notificar paciente"
                                                            >
                                                                <Bell className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                        {item.patient.phone && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 w-7 p-0"
                                                                onClick={() => window.open(`tel:${item.patient.phone}`)}
                                                                title="Llamar paciente"
                                                            >
                                                                <Phone className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 w-7 p-0 text-red-500"
                                                            onClick={() => handleAction(item.id, 'CANCEL')}
                                                            title="Cancelar"
                                                        >
                                                            <XCircle className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dialog de Entrega */}
            <Dialog open={deliverDialogOpen} onOpenChange={setDeliverDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Entregar Pendiente</DialogTitle>
                        <DialogDescription>
                            Registra la entrega del medicamento pendiente
                        </DialogDescription>
                    </DialogHeader>

                    {selectedItem && (
                        <div className="space-y-4 mt-4">
                            {/* Info del pendiente */}
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <p className="font-medium">{selectedItem.product.name}</p>
                                <p className="text-sm text-gray-500">
                                    Paciente: {selectedItem.patient.name}
                                </p>
                                <p className="text-sm text-gray-500">
                                    Pendiente: <span className="font-bold text-red-600">{selectedItem.pendingQty}</span> unidades
                                </p>
                            </div>

                            {/* Selección de inventario */}
                            <div>
                                <Label>Seleccionar Lote (opcional)</Label>
                                <select
                                    value={selectedInventory}
                                    onChange={(e) => setSelectedInventory(e.target.value)}
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 mt-1"
                                >
                                    <option value="">Sin descontar inventario</option>
                                    {inventory.flatMap(inv =>
                                        inv.lots.map(lot => (
                                            <option key={lot.inventoryId} value={lot.inventoryId}>
                                                {inv.warehouseName} - Lote: {lot.lotNumber} ({lot.quantity} disp.)
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {/* Cantidad */}
                            <div>
                                <Label>Cantidad a Entregar</Label>
                                <Input
                                    type="number"
                                    value={deliverQty}
                                    onChange={(e) => setDeliverQty(Number(e.target.value))}
                                    max={selectedItem.pendingQty}
                                    min={1}
                                    className="mt-1"
                                />
                            </div>

                            {/* Notas */}
                            <div>
                                <Label>Observaciones</Label>
                                <textarea
                                    value={deliverNotes}
                                    onChange={(e) => setDeliverNotes(e.target.value)}
                                    className="w-full h-16 rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                                    placeholder="Notas de la entrega..."
                                />
                            </div>

                            {/* Botones */}
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setDeliverDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                    onClick={handleDeliver}
                                    disabled={submitting || deliverQty <= 0}
                                >
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                    Confirmar Entrega
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
