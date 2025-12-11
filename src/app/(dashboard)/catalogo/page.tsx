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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
    Package,
    Plus,
    Search,
    Pencil,
    Trash2,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    X,
} from "lucide-react";

interface Product {
    id: string;
    code: string;
    barcode?: string;
    name: string;
    molecule?: string;
    presentation?: string;
    concentration?: string;
    unit?: string;
    price: number;
    minStock: number;
    isActive: boolean;
}

const emptyProduct: Partial<Product> = {
    code: "",
    barcode: "",
    name: "",
    molecule: "",
    presentation: "",
    concentration: "",
    unit: "UNIDAD",
    price: 0,
    minStock: 0
};

interface Stats {
    total: number;
    active: number;
    inactive: number;
    lowStock: number;
}

export default function CatalogoPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0, lowStock: 0 });
    const [total, setTotal] = useState(0);

    // Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"create" | "edit">("create");
    const [currentProduct, setCurrentProduct] = useState<Partial<Product>>(emptyProduct);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    useEffect(() => {
        loadProducts();
    }, [showInactive]);

    const loadProducts = async () => {
        setLoading(true);
        try {
            let url = '/api/products?limit=500';
            if (search) url += `&search=${search}`;
            if (!showInactive) url += `&isActive=true`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setProducts(data.products || []);
                setTotal(data.total || 0);
                if (data.stats) setStats(data.stats);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        loadProducts();
    };

    const openCreateModal = () => {
        setCurrentProduct(emptyProduct);
        setModalMode("create");
        setError("");
        setModalOpen(true);
    };

    const openEditModal = (product: Product) => {
        setCurrentProduct({ ...product });
        setModalMode("edit");
        setError("");
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!currentProduct.code || !currentProduct.name) {
            setError("Código y nombre son requeridos");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const url = '/api/products';
            const method = modalMode === "create" ? "POST" : "PUT";

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentProduct)
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Error guardando producto');
                return;
            }

            setModalOpen(false);
            setSuccessMsg(modalMode === "create" ? "Producto creado" : "Producto actualizado");
            setTimeout(() => setSuccessMsg(""), 3000);
            loadProducts();
        } catch (error) {
            setError("Error de conexión");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (product: Product) => {
        if (!confirm(`¿Desactivar el producto "${product.name}"?`)) return;

        try {
            const response = await fetch(`/api/products?id=${product.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setSuccessMsg("Producto desactivado");
                setTimeout(() => setSuccessMsg(""), 3000);
                loadProducts();
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const reactivate = async (product: Product) => {
        try {
            await fetch('/api/products', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: product.id, isActive: true })
            });
            loadProducts();
        } catch (error) {
            console.error('Error:', error);
        }
    };

    // Estadísticas del servidor
    // const activeCount = products.filter(p => p.isActive).length; // Deprecado
    // const lowStockCount = products.filter(p => p.minStock > 0).length; // Deprecado

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Package className="h-6 w-6" />
                        Catálogo de Productos
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Gestiona medicamentos, moléculas y presentaciones
                    </p>
                </div>
                <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Producto
                </Button>
            </div>

            {/* Success message */}
            {successMsg && (
                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200">
                    <CheckCircle2 className="h-4 w-4" />
                    {successMsg}
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Package className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Total Productos</p>
                                <p className="text-2xl font-bold">{stats.total}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Activos</p>
                                <p className="text-2xl font-bold">{stats.active}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Con Stock Mínimo</p>
                                <p className="text-2xl font-bold">{stats.lowStock}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filtros */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <Input
                                placeholder="Buscar por código, nombre, molécula o código de barras..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            <span className="ml-2">Buscar</span>
                        </Button>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showInactive}
                                onChange={(e) => setShowInactive(e.target.checked)}
                                className="rounded"
                            />
                            Mostrar inactivos
                        </label>
                    </div>
                </CardContent>
            </Card>

            {/* Tabla */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                        Productos ({products.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : products.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No se encontraron productos</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                                        <TableHead className="text-xs">Código</TableHead>
                                        <TableHead className="text-xs">Nombre</TableHead>
                                        <TableHead className="text-xs">Molécula</TableHead>
                                        <TableHead className="text-xs">Presentación</TableHead>
                                        <TableHead className="text-xs text-right">Precio</TableHead>
                                        <TableHead className="text-xs text-center">Estado</TableHead>
                                        <TableHead className="text-xs text-center">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.map(product => (
                                        <TableRow key={product.id} className={!product.isActive ? "opacity-50" : ""}>
                                            <TableCell className="font-mono text-xs">{product.code}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-sm">{product.name}</p>
                                                    {product.barcode && (
                                                        <p className="text-xs text-gray-500">CB: {product.barcode}</p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">{product.molecule || "-"}</TableCell>
                                            <TableCell className="text-sm">
                                                {product.presentation && (
                                                    <span>{product.presentation}</span>
                                                )}
                                                {product.concentration && (
                                                    <span className="text-gray-500 ml-1">{product.concentration}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                ${Number(product.price).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {product.isActive ? (
                                                    <Badge variant="default" className="bg-green-100 text-green-700">Activo</Badge>
                                                ) : (
                                                    <Badge variant="secondary">Inactivo</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Button size="sm" variant="ghost" onClick={() => openEditModal(product)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    {product.isActive ? (
                                                        <Button size="sm" variant="ghost" onClick={() => handleDelete(product)}>
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    ) : (
                                                        <Button size="sm" variant="ghost" onClick={() => reactivate(product)}>
                                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal Crear/Editar */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {modalMode === "create" ? "Nuevo Producto" : "Editar Producto"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div>
                            <Label className="text-xs">Código *</Label>
                            <Input
                                value={currentProduct.code || ""}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, code: e.target.value })}
                                placeholder="COD001"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Código de Barras</Label>
                            <Input
                                value={currentProduct.barcode || ""}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, barcode: e.target.value })}
                                placeholder="7701234567890"
                            />
                        </div>
                        <div className="col-span-2">
                            <Label className="text-xs">Nombre *</Label>
                            <Input
                                value={currentProduct.name || ""}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                                placeholder="Acetaminofén 500mg Tabletas"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Molécula / Principio Activo</Label>
                            <Input
                                value={currentProduct.molecule || ""}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, molecule: e.target.value })}
                                placeholder="Acetaminofén"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Presentación</Label>
                            <Input
                                value={currentProduct.presentation || ""}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, presentation: e.target.value })}
                                placeholder="Tabletas, Jarabe, Ampolla..."
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Concentración</Label>
                            <Input
                                value={currentProduct.concentration || ""}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, concentration: e.target.value })}
                                placeholder="500mg, 10ml..."
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Unidad</Label>
                            <select
                                value={currentProduct.unit || "UNIDAD"}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, unit: e.target.value })}
                                className="w-full h-10 rounded-md border border-input bg-background px-3"
                            >
                                <option value="UNIDAD">Unidad</option>
                                <option value="CAJA">Caja</option>
                                <option value="FRASCO">Frasco</option>
                                <option value="AMPOLLA">Ampolla</option>
                                <option value="TUBO">Tubo</option>
                                <option value="SOBRE">Sobre</option>
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs">Precio</Label>
                            <Input
                                type="number"
                                value={currentProduct.price || 0}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, price: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Stock Mínimo</Label>
                            <Input
                                type="number"
                                value={currentProduct.minStock || 0}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, minStock: parseInt(e.target.value) })}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg">
                            <AlertTriangle className="h-4 w-4" />
                            {error}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {modalMode === "create" ? "Crear" : "Guardar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
