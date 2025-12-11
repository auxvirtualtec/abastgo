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
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    RotateCcw,
    Plus,
    Search,
    Loader2,
    Save,
    Trash2,
    Package,
} from "lucide-react";

interface ReturnRecord {
    id: string;
    returnNumber: string;
    returnDate: string;
    warehouse: { id: string; name: string };
    reason: string;
    status: string;
    itemsCount: number;
    totalUnits: number;
    createdBy: string;
}

interface Product {
    id: string;
    code: string;
    name: string;
}

interface CartItem {
    productId: string;
    productCode: string;
    productName: string;
    lotNumber: string;
    expiryDate: string;
    quantity: number;
}

const reasons = [
    { value: 'DEVOLUCION_PACIENTE', label: 'Devolución de Paciente' },
    { value: 'VENCIMIENTO', label: 'Vencimiento' },
    { value: 'AVERIA', label: 'Avería/Daño' },
    { value: 'ERROR_ENTREGA', label: 'Error en Entrega' },
    { value: 'SOBRANTE', label: 'Sobrante' },
    { value: 'OTRO', label: 'Otro' },
];

export default function DevolucionesPage() {
    const [returns, setReturns] = useState<ReturnRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // Filtros
    const [filterWarehouse, setFilterWarehouse] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Modal
    const [dialogOpen, setDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formWarehouse, setFormWarehouse] = useState("");
    const [reason, setReason] = useState("DEVOLUCION_PACIENTE");
    const [notes, setNotes] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);

    // Búsqueda producto
    const [productSearch, setProductSearch] = useState("");
    const [searchingProducts, setSearchingProducts] = useState(false);

    useEffect(() => {
        loadWarehouses();
        loadReturns();
    }, []);

    const loadWarehouses = async () => {
        try {
            const response = await fetch('/api/warehouses');
            if (response.ok) {
                const data = await response.json();
                setWarehouses(data.warehouses || []);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const loadReturns = async () => {
        setLoading(true);
        try {
            let url = '/api/returns?';
            if (filterWarehouse) url += `warehouseId=${filterWarehouse}&`;
            if (startDate) url += `startDate=${startDate}&`;
            if (endDate) url += `endDate=${endDate}&`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setReturns(data.returns || []);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const searchProducts = async () => {
        if (!productSearch.trim()) return;
        setSearchingProducts(true);
        try {
            const response = await fetch(`/api/products?search=${productSearch}`);
            if (response.ok) {
                const data = await response.json();
                setProducts(data.products || []);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setSearchingProducts(false);
        }
    };

    const addToCart = (product: Product) => {
        if (cart.find(c => c.productId === product.id)) return;
        setCart([...cart, {
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            lotNumber: "",
            expiryDate: "",
            quantity: 1
        }]);
        setProducts([]);
        setProductSearch("");
    };

    const updateCartItem = (productId: string, field: string, value: any) => {
        setCart(cart.map(item =>
            item.productId === productId ? { ...item, [field]: value } : item
        ));
    };

    const removeFromCart = (productId: string) => {
        setCart(cart.filter(c => c.productId !== productId));
    };

    const submitReturn = async () => {
        if (!formWarehouse || cart.length === 0) {
            alert('Seleccione bodega y agregue al menos un producto');
            return;
        }

        if (cart.some(item => !item.quantity || item.quantity <= 0)) {
            alert('Todos los productos deben tener cantidad mayor a 0');
            return;
        }

        setSubmitting(true);
        try {
            const response = await fetch('/api/returns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    warehouseId: formWarehouse,
                    reason,
                    notes,
                    items: cart.map(item => ({
                        productId: item.productId,
                        lotNumber: item.lotNumber || null,
                        expiryDate: item.expiryDate || null,
                        quantity: item.quantity
                    }))
                })
            });

            if (response.ok) {
                setDialogOpen(false);
                resetForm();
                loadReturns();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Error guardando devolución');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormWarehouse("");
        setReason("DEVOLUCION_PACIENTE");
        setNotes("");
        setCart([]);
        setProducts([]);
        setProductSearch("");
    };

    const getReasonLabel = (value: string) => {
        return reasons.find(r => r.value === value)?.label || value;
    };

    const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <RotateCcw className="h-6 w-6" />
                        Devoluciones
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Registro de devoluciones de medicamentos al inventario
                    </p>
                </div>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva Devolución
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Nueva Devolución</DialogTitle>
                            <DialogDescription>
                                Registra productos devueltos al inventario
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Bodega Destino *</Label>
                                    <select
                                        value={formWarehouse}
                                        onChange={(e) => setFormWarehouse(e.target.value)}
                                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                    >
                                        <option value="">Seleccionar...</option>
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label>Motivo *</Label>
                                    <select
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                    >
                                        {reasons.map(r => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <Label>Notas</Label>
                                <Input
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Observaciones adicionales..."
                                />
                            </div>

                            {/* Buscar productos */}
                            <div className="border-t pt-4">
                                <Label className="mb-2 block">Agregar Productos</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Buscar por código o nombre..."
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && searchProducts()}
                                        className="flex-1"
                                    />
                                    <Button onClick={searchProducts} disabled={searchingProducts}>
                                        {searchingProducts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    </Button>
                                </div>

                                {products.length > 0 && (
                                    <div className="border rounded mt-2 max-h-32 overflow-y-auto">
                                        {products.map(p => (
                                            <div
                                                key={p.id}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex justify-between items-center"
                                                onClick={() => addToCart(p)}
                                            >
                                                <div>
                                                    <span className="font-mono text-xs">{p.code}</span>
                                                    <span className="ml-2">{p.name}</span>
                                                </div>
                                                <Plus className="h-4 w-4" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Cart */}
                            {cart.length > 0 ? (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50 dark:bg-gray-800">
                                                <TableHead className="text-xs">Producto</TableHead>
                                                <TableHead className="text-xs">Lote</TableHead>
                                                <TableHead className="text-xs">Vencimiento</TableHead>
                                                <TableHead className="text-xs text-center">Cantidad</TableHead>
                                                <TableHead className="w-10"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {cart.map(item => (
                                                <TableRow key={item.productId}>
                                                    <TableCell className="text-sm">
                                                        <p className="font-medium">{item.productName}</p>
                                                        <p className="text-xs text-gray-500">{item.productCode}</p>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            value={item.lotNumber}
                                                            onChange={(e) => updateCartItem(item.productId, 'lotNumber', e.target.value)}
                                                            placeholder="Lote"
                                                            className="h-7 w-24"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="date"
                                                            value={item.expiryDate}
                                                            onChange={(e) => updateCartItem(item.productId, 'expiryDate', e.target.value)}
                                                            className="h-7 w-32"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => updateCartItem(item.productId, 'quantity', Number(e.target.value))}
                                                            className="h-7 w-20 text-center"
                                                            min={1}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => removeFromCart(item.productId)}
                                                            className="h-7 w-7 p-0 text-red-500"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 border rounded-lg">
                                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                    <p>Busca y agrega productos para la devolución</p>
                                </div>
                            )}

                            {cart.length > 0 && (
                                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                                    <div className="text-sm">
                                        <p>{cart.length} productos | {totalUnits} unidades a devolver</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 mt-4">
                                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                    onClick={submitReturn}
                                    disabled={submitting || cart.length === 0}
                                >
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    Guardar Devolución
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
                        <div className="flex-1 min-w-[200px]">
                            <Label className="text-xs">Bodega</Label>
                            <select
                                value={filterWarehouse}
                                onChange={(e) => setFilterWarehouse(e.target.value)}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="">Todas</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs">Desde</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-36 h-9"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Hasta</Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-36 h-9"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={loadReturns} disabled={loading}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                <span className="ml-2">Filtrar</span>
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <RotateCcw className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Total Devoluciones</p>
                                <p className="text-xl font-bold">{returns.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <Package className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Unidades Devueltas</p>
                                <p className="text-xl font-bold">
                                    {returns.reduce((sum, r) => sum + r.totalUnits, 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                <RotateCcw className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Este Mes</p>
                                <p className="text-xl font-bold">
                                    {returns.filter(r => {
                                        const d = new Date(r.returnDate);
                                        const now = new Date();
                                        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                                    }).length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabla */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Devoluciones Registradas</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : returns.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <RotateCcw className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No hay devoluciones registradas</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                                        <TableHead className="text-xs">Nº Devolución</TableHead>
                                        <TableHead className="text-xs">Fecha</TableHead>
                                        <TableHead className="text-xs">Bodega</TableHead>
                                        <TableHead className="text-xs">Motivo</TableHead>
                                        <TableHead className="text-xs text-center">Items</TableHead>
                                        <TableHead className="text-xs text-right">Unidades</TableHead>
                                        <TableHead className="text-xs">Creado Por</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {returns.map(r => (
                                        <TableRow key={r.id}>
                                            <TableCell className="font-mono text-sm">{r.returnNumber}</TableCell>
                                            <TableCell className="text-sm">
                                                {new Date(r.returnDate).toLocaleDateString('es-CO')}
                                            </TableCell>
                                            <TableCell className="text-sm">{r.warehouse.name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{getReasonLabel(r.reason)}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary">{r.itemsCount}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">{r.totalUnits}</TableCell>
                                            <TableCell className="text-sm text-gray-500">{r.createdBy}</TableCell>
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
