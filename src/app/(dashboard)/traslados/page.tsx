"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
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
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Search,
    ArrowRightLeft,
    Plus,
    Minus,
    Trash2,
    Send,
    CheckCircle,
    XCircle,
    Loader2,
    Package,
    Warehouse,
    Truck,
} from "lucide-react";

interface WarehouseOption {
    id: string;
    code: string;
    name: string;
    type: string;
}

interface InventoryItem {
    productId: string;
    productCode: string;
    productName: string;
    molecule?: string;
    warehouseId: string;
    warehouseName: string;
    totalQuantity: number;
    lots: {
        inventoryId: string;
        lotNumber: string;
        quantity: number;
        unitCost: number;
    }[];
}

interface TransferItem {
    inventoryId: string;
    productId: string;
    productCode: string;
    productName: string;
    lotNumber: string;
    availableQty: number;
    quantity: number;
}

interface Transfer {
    id: string;
    transferNumber: string;
    status: string;
    createdAt: string;
    fromWarehouse: { name: string };
    toWarehouse: { name: string };
    createdBy: { name: string };
    items: { product: { name: string }; quantity: number }[];
}

const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    IN_TRANSIT: "bg-blue-100 text-blue-800",
    RECEIVED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800"
};

const STATUS_LABELS: Record<string, string> = {
    PENDING: "Pendiente",
    IN_TRANSIT: "En Tránsito",
    RECEIVED: "Recibido",
    CANCELLED: "Cancelado"
};

export default function TrasladosPage() {
    const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    // Nuevo traslado
    const [dialogOpen, setDialogOpen] = useState(false);
    const [fromWarehouse, setFromWarehouse] = useState("");
    const [toWarehouse, setToWarehouse] = useState("");
    const [productSearch, setProductSearch] = useState("");
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [searchingInventory, setSearchingInventory] = useState(false);
    const [items, setItems] = useState<TransferItem[]>([]);
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Filtro de listado
    const [statusFilter, setStatusFilter] = useState("");

    useEffect(() => {
        loadWarehouses();
        loadTransfers();
    }, []);

    const loadWarehouses = async () => {
        try {
            const response = await fetch('/api/warehouses');
            if (response.ok) {
                const data = await response.json();
                setWarehouses(data.warehouses || []);
            }
        } catch (error) {
            console.error('Error cargando bodegas:', error);
        }
    };

    const loadTransfers = async () => {
        setLoading(true);
        try {
            let url = '/api/transfers?limit=100';
            if (statusFilter) url += `&status=${statusFilter}`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setTransfers(data.transfers || []);
            }
        } catch (error) {
            console.error('Error cargando traslados:', error);
        } finally {
            setLoading(false);
        }
    };

    const searchProducts = async () => {
        if (!productSearch.trim() || !fromWarehouse) return;

        setSearchingInventory(true);
        try {
            const response = await fetch(`/api/inventory?search=${productSearch}&warehouseId=${fromWarehouse}`);
            if (response.ok) {
                const data = await response.json();
                setInventory(data.items || []);
            }
        } catch (error) {
            console.error('Error buscando inventario:', error);
        } finally {
            setSearchingInventory(false);
        }
    };

    const addItem = (inv: InventoryItem) => {
        const lot = inv.lots[0];
        if (!lot) return;

        const exists = items.find(i => i.inventoryId === lot.inventoryId);
        if (exists) {
            setItems(items.map(i =>
                i.inventoryId === lot.inventoryId
                    ? { ...i, quantity: Math.min(i.quantity + 1, i.availableQty) }
                    : i
            ));
        } else {
            setItems([...items, {
                inventoryId: lot.inventoryId,
                productId: inv.productId,
                productCode: inv.productCode,
                productName: inv.productName,
                lotNumber: lot.lotNumber,
                availableQty: lot.quantity,
                quantity: 1
            }]);
        }
    };

    const updateItemQuantity = (inventoryId: string, qty: number) => {
        setItems(items.map(i =>
            i.inventoryId === inventoryId
                ? { ...i, quantity: Math.max(1, Math.min(qty, i.availableQty)) }
                : i
        ));
    };

    const removeItem = (inventoryId: string) => {
        setItems(items.filter(i => i.inventoryId !== inventoryId));
    };

    const submitTransfer = async () => {
        if (!fromWarehouse || !toWarehouse || items.length === 0) return;

        setSubmitting(true);
        try {
            const response = await fetch('/api/transfers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromWarehouseId: fromWarehouse,
                    toWarehouseId: toWarehouse,
                    notes,
                    items: items.map(i => ({
                        productId: i.productId,
                        quantity: i.quantity,
                        lotNumber: i.lotNumber,
                        inventoryId: i.inventoryId
                    }))
                })
            });

            if (response.ok) {
                setDialogOpen(false);
                resetForm();
                loadTransfers();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Error creando traslado');
        } finally {
            setSubmitting(false);
        }
    };

    const updateTransferStatus = async (transferId: string, action: string) => {
        try {
            const response = await fetch('/api/transfers', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transferId, action })
            });

            if (response.ok) {
                loadTransfers();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Error actualizando traslado');
        }
    };

    const resetForm = () => {
        setFromWarehouse("");
        setToWarehouse("");
        setProductSearch("");
        setInventory([]);
        setItems([]);
        setNotes("");
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Traslados entre Bodegas</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Gestiona el movimiento de productos entre ubicaciones
                    </p>
                </div>

                <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Traslado
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Crear Traslado</DialogTitle>
                            <DialogDescription>
                                Selecciona las bodegas y los productos a trasladar
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6 mt-4">
                            {/* Bodegas */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label>Bodega Origen</Label>
                                    <select
                                        value={fromWarehouse}
                                        onChange={(e) => { setFromWarehouse(e.target.value); setInventory([]); }}
                                        className="w-full h-10 rounded-md border border-input bg-background px-3"
                                    >
                                        <option value="">Seleccionar...</option>
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id} disabled={w.id === toWarehouse}>
                                                {w.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label>Bodega Destino</Label>
                                    <select
                                        value={toWarehouse}
                                        onChange={(e) => setToWarehouse(e.target.value)}
                                        className="w-full h-10 rounded-md border border-input bg-background px-3"
                                    >
                                        <option value="">Seleccionar...</option>
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id} disabled={w.id === fromWarehouse}>
                                                {w.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Búsqueda de productos */}
                            {fromWarehouse && (
                                <div>
                                    <Label>Buscar Productos en Origen</Label>
                                    <div className="flex gap-2 mt-1">
                                        <Input
                                            placeholder="Buscar por nombre, código o molécula..."
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && searchProducts()}
                                        />
                                        <Button onClick={searchProducts} disabled={searchingInventory}>
                                            {searchingInventory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                        </Button>
                                    </div>

                                    {inventory.length > 0 && (
                                        <div className="border rounded-lg mt-3 max-h-48 overflow-y-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                                                        <TableHead className="text-xs">Producto</TableHead>
                                                        <TableHead className="text-xs text-right">Disponible</TableHead>
                                                        <TableHead className="w-16"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {inventory.map(inv => (
                                                        <TableRow key={inv.productId} className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => addItem(inv)}>
                                                            <TableCell>
                                                                <p className="font-medium text-sm">{inv.productName}</p>
                                                                {inv.molecule && (
                                                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{inv.molecule}</p>
                                                                )}
                                                                <p className="text-xs text-gray-500">{inv.productCode}</p>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Badge variant="secondary">{inv.totalQuantity}</Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Button size="sm" variant="ghost"><Plus className="h-4 w-4" /></Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Items seleccionados */}
                            {items.length > 0 && (
                                <div>
                                    <Label>Productos a Trasladar ({items.length})</Label>
                                    <div className="border rounded-lg mt-2">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-gray-50 dark:bg-gray-800">
                                                    <TableHead className="text-xs">Producto</TableHead>
                                                    <TableHead className="text-xs">Lote</TableHead>
                                                    <TableHead className="text-xs text-center">Cantidad</TableHead>
                                                    <TableHead className="w-10"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.map(item => (
                                                    <TableRow key={item.inventoryId}>
                                                        <TableCell className="text-sm">{item.productName}</TableCell>
                                                        <TableCell className="text-xs text-gray-500">{item.lotNumber}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center justify-center gap-1">
                                                                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateItemQuantity(item.inventoryId, item.quantity - 1)}>
                                                                    <Minus className="h-3 w-3" />
                                                                </Button>
                                                                <Input
                                                                    type="number"
                                                                    value={item.quantity}
                                                                    onChange={(e) => updateItemQuantity(item.inventoryId, Number(e.target.value))}
                                                                    className="w-16 h-7 text-center"
                                                                />
                                                                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateItemQuantity(item.inventoryId, item.quantity + 1)}>
                                                                    <Plus className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => removeItem(item.inventoryId)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {/* Notas */}
                            <div>
                                <Label>Observaciones</Label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full h-16 rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                                    placeholder="Notas adicionales del traslado..."
                                />
                            </div>

                            {/* Botones */}
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={submitTransfer}
                                    disabled={submitting || !fromWarehouse || !toWarehouse || items.length === 0}
                                >
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                                    Crear Traslado
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filtros */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-4">
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setTimeout(loadTransfers, 100); }}
                            className="h-10 rounded-md border border-input bg-background px-3 min-w-[200px]"
                        >
                            <option value="">Todos los estados</option>
                            <option value="PENDING">Pendientes</option>
                            <option value="IN_TRANSIT">En Tránsito</option>
                            <option value="RECEIVED">Recibidos</option>
                            <option value="CANCELLED">Cancelados</option>
                        </select>
                        <Button variant="outline" onClick={loadTransfers} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            <span className="ml-2">Actualizar</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Lista de traslados */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Traslados ({transfers.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : transfers.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No hay traslados registrados</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                                        <TableHead className="text-xs">N° Traslado</TableHead>
                                        <TableHead className="text-xs">Origen</TableHead>
                                        <TableHead className="text-xs">Destino</TableHead>
                                        <TableHead className="text-xs text-center">Items</TableHead>
                                        <TableHead className="text-xs">Estado</TableHead>
                                        <TableHead className="text-xs">Fecha</TableHead>
                                        <TableHead className="text-xs text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transfers.map(t => (
                                        <TableRow key={t.id}>
                                            <TableCell className="font-mono text-sm">{t.transferNumber}</TableCell>
                                            <TableCell className="text-sm">{t.fromWarehouse.name}</TableCell>
                                            <TableCell className="text-sm">{t.toWarehouse.name}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary">{t.items.length}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={STATUS_COLORS[t.status]}>
                                                    {STATUS_LABELS[t.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-gray-500">
                                                {new Date(t.createdAt).toLocaleDateString('es-CO')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {t.status === 'PENDING' && (
                                                    <div className="flex gap-1 justify-end">
                                                        <Button size="sm" variant="outline" className="h-7" onClick={() => updateTransferStatus(t.id, 'SEND')}>
                                                            <Send className="h-3 w-3 mr-1" /> Enviar
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-7 text-red-500" onClick={() => updateTransferStatus(t.id, 'CANCEL')}>
                                                            <XCircle className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                )}
                                                {t.status === 'IN_TRANSIT' && (
                                                    <div className="flex gap-1 justify-end">
                                                        <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => updateTransferStatus(t.id, 'RECEIVE')}>
                                                            <CheckCircle className="h-3 w-3 mr-1" /> Recibir
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-7 text-red-500" onClick={() => updateTransferStatus(t.id, 'CANCEL')}>
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
        </div>
    );
}
