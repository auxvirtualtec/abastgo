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
    PackagePlus,
    Plus,
    Search,
    Loader2,
    Save,
    Trash2,
    Package,
    Calendar,
    Building2,
} from "lucide-react";

interface Receipt {
    id: string;
    receiptNumber: string;
    supplier?: string;
    invoiceNumber?: string;
    receiptDate: string;
    warehouse: { id: string; name: string; code: string };
    itemsCount: number;
    totalUnits: number;
    totalValue: number;
}

interface Product {
    id: string;
    code: string;
    name: string;
    molecule?: string;
}

interface CartItem {
    productId: string;
    productCode: string;
    productName: string;
    lotNumber: string;
    expiryDate: string;
    quantity: number;
    unitCost: number;
}

export default function EntradasPage() {
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [loading, setLoading] = useState(false);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // Filtros
    const [filterWarehouse, setFilterWarehouse] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Modal nuevo
    const [dialogOpen, setDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formWarehouse, setFormWarehouse] = useState("");
    const [supplier, setSupplier] = useState("");
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);

    // Búsqueda producto
    const [productSearch, setProductSearch] = useState("");
    const [searchingProducts, setSearchingProducts] = useState(false);

    useEffect(() => {
        loadWarehouses();
        loadReceipts();
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

    const loadReceipts = async () => {
        setLoading(true);
        try {
            let url = '/api/receipts?';
            if (filterWarehouse) url += `warehouseId=${filterWarehouse}&`;
            if (startDate) url += `startDate=${startDate}&`;
            if (endDate) url += `endDate=${endDate}&`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setReceipts(data.receipts || []);
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
            quantity: 1,
            unitCost: 0
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

    const submitReceipt = async () => {
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
            const response = await fetch('/api/receipts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    warehouseId: formWarehouse,
                    supplier,
                    invoiceNumber,
                    receiptDate,
                    notes,
                    items: cart.map(item => ({
                        productId: item.productId,
                        lotNumber: item.lotNumber || null,
                        expiryDate: item.expiryDate || null,
                        quantity: item.quantity,
                        unitCost: item.unitCost || 0
                    }))
                })
            });

            if (response.ok) {
                setDialogOpen(false);
                resetForm();
                loadReceipts();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Error guardando entrada');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormWarehouse("");
        setSupplier("");
        setInvoiceNumber("");
        setReceiptDate(new Date().toISOString().split('T')[0]);
        setNotes("");
        setCart([]);
        setProducts([]);
        setProductSearch("");
    };

    const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = cart.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <PackagePlus className="h-6 w-6" />
                        Entradas de Almacén
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Registro de compras y recepciones de medicamentos
                    </p>
                </div>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva Entrada
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Nueva Entrada de Almacén</DialogTitle>
                            <DialogDescription>
                                Registra la recepción de medicamentos
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 mt-4">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-2">
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
                                    <Label>Fecha</Label>
                                    <Input
                                        type="date"
                                        value={receiptDate}
                                        onChange={(e) => setReceiptDate(e.target.value)}
                                        className="h-9"
                                    />
                                </div>
                                <div>
                                    <Label>Nº Factura</Label>
                                    <Input
                                        value={invoiceNumber}
                                        onChange={(e) => setInvoiceNumber(e.target.value)}
                                        placeholder="FAC-001"
                                        className="h-9"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Proveedor</Label>
                                <Input
                                    value={supplier}
                                    onChange={(e) => setSupplier(e.target.value)}
                                    placeholder="Nombre del proveedor"
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
                                                <TableHead className="text-xs text-right">Costo Unit.</TableHead>
                                                <TableHead className="text-xs text-right">Subtotal</TableHead>
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
                                                        <Input
                                                            type="number"
                                                            value={item.unitCost}
                                                            onChange={(e) => updateCartItem(item.productId, 'unitCost', Number(e.target.value))}
                                                            className="h-7 w-24 text-right"
                                                            step="0.01"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        ${(item.quantity * item.unitCost).toLocaleString()}
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
                                    <p>Busca y agrega productos para la entrada</p>
                                </div>
                            )}

                            {cart.length > 0 && (
                                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                                    <div className="text-sm">
                                        <p>{cart.length} productos | {totalUnits} unidades</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500">Total Entrada</p>
                                        <p className="text-xl font-bold">${totalValue.toLocaleString()}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 mt-4">
                                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                    onClick={submitReceipt}
                                    disabled={submitting || cart.length === 0}
                                >
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    Guardar Entrada
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
                            <Button onClick={loadReceipts} disabled={loading}>
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
                                <PackagePlus className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Total Entradas</p>
                                <p className="text-xl font-bold">{receipts.length}</p>
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
                                <p className="text-xs text-gray-500">Unidades Recibidas</p>
                                <p className="text-xl font-bold">
                                    {receipts.reduce((sum, r) => sum + r.totalUnits, 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Valor Total</p>
                                <p className="text-xl font-bold">
                                    ${receipts.reduce((sum, r) => sum + r.totalValue, 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabla */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Entradas Registradas</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : receipts.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <PackagePlus className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No hay entradas registradas</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                                        <TableHead className="text-xs">Nº Entrada</TableHead>
                                        <TableHead className="text-xs">Fecha</TableHead>
                                        <TableHead className="text-xs">Bodega</TableHead>
                                        <TableHead className="text-xs">Proveedor</TableHead>
                                        <TableHead className="text-xs text-center">Items</TableHead>
                                        <TableHead className="text-xs text-right">Unidades</TableHead>
                                        <TableHead className="text-xs text-right">Valor</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {receipts.map(receipt => (
                                        <TableRow key={receipt.id}>
                                            <TableCell className="font-mono text-sm">{receipt.receiptNumber}</TableCell>
                                            <TableCell className="text-sm">
                                                {new Date(receipt.receiptDate).toLocaleDateString('es-CO')}
                                            </TableCell>
                                            <TableCell className="text-sm">{receipt.warehouse.name}</TableCell>
                                            <TableCell className="text-sm">{receipt.supplier || '-'}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary">{receipt.itemsCount}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">{receipt.totalUnits.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-medium">${receipt.totalValue.toLocaleString()}</TableCell>
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
