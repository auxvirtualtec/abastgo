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
    Search,
    Plus,
    Package,
    Edit,
    Trash2,
    Loader2,
    Save,
    X,
} from "lucide-react";

interface Product {
    id: string;
    code: string;
    name: string;
    molecule?: string;
    presentation?: string;
    concentration?: string;
    laboratory?: string;
    price: number;
    requiresPrescription: boolean;
    isControlled: boolean;
    minStock?: number;
    maxStock?: number;
    isActive: boolean;
}

export default function ProductosPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");

    // Form
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Product | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        code: "",
        name: "",
        molecule: "",
        presentation: "",
        concentration: "",
        laboratory: "",
        price: 0,
        requiresPrescription: true,
        isControlled: false,
        minStock: 10,
        maxStock: 1000
    });

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        setLoading(true);
        try {
            let url = '/api/products?limit=100';
            if (search) url += `&search=${search}`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setProducts(data.products || []);
                setTotal(data.total || 0);
            }
        } catch (error) {
            console.error('Error cargando productos:', error);
        } finally {
            setLoading(false);
        }
    };

    const openEdit = (product: Product) => {
        setEditing(product);
        setForm({
            code: product.code,
            name: product.name,
            molecule: product.molecule || "",
            presentation: product.presentation || "",
            concentration: product.concentration || "",
            laboratory: product.laboratory || "",
            price: product.price,
            requiresPrescription: product.requiresPrescription,
            isControlled: product.isControlled,
            minStock: product.minStock || 10,
            maxStock: product.maxStock || 1000
        });
        setDialogOpen(true);
    };

    const openNew = () => {
        setEditing(null);
        setForm({
            code: "",
            name: "",
            molecule: "",
            presentation: "",
            concentration: "",
            laboratory: "",
            price: 0,
            requiresPrescription: true,
            isControlled: false,
            minStock: 10,
            maxStock: 1000
        });
        setDialogOpen(true);
    };

    const submitForm = async () => {
        if (!form.code || !form.name) {
            alert('Código y nombre son requeridos');
            return;
        }

        setSubmitting(true);
        try {
            const url = '/api/products';
            const method = editing ? 'PUT' : 'POST';
            const body = editing ? { id: editing.id, ...form } : form;

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                setDialogOpen(false);
                loadProducts();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Error guardando producto');
        } finally {
            setSubmitting(false);
        }
    };

    const deleteProduct = async (id: string) => {
        if (!confirm('¿Desactivar este producto?')) return;

        try {
            const response = await fetch(`/api/products?id=${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                loadProducts();
            }
        } catch (error) {
            alert('Error desactivando producto');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Catálogo de Productos</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Gestiona el maestro de medicamentos y productos
                    </p>
                </div>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openNew}>
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Producto
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{editing ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
                            <DialogDescription>
                                {editing ? 'Modifica los datos del producto' : 'Ingresa los datos del nuevo producto'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Código *</Label>
                                    <Input
                                        value={form.code}
                                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                                        disabled={!!editing}
                                        placeholder="Ej: MED-001"
                                    />
                                </div>
                                <div>
                                    <Label>Precio</Label>
                                    <Input
                                        type="number"
                                        value={form.price}
                                        onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Nombre Comercial *</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Nombre del producto"
                                />
                            </div>

                            <div>
                                <Label>Principio Activo / Molécula</Label>
                                <Input
                                    value={form.molecule}
                                    onChange={(e) => setForm({ ...form, molecule: e.target.value })}
                                    placeholder="Ej: Acetaminofén"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Presentación</Label>
                                    <Input
                                        value={form.presentation}
                                        onChange={(e) => setForm({ ...form, presentation: e.target.value })}
                                        placeholder="Ej: Tableta, Jarabe"
                                    />
                                </div>
                                <div>
                                    <Label>Concentración</Label>
                                    <Input
                                        value={form.concentration}
                                        onChange={(e) => setForm({ ...form, concentration: e.target.value })}
                                        placeholder="Ej: 500mg"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Laboratorio</Label>
                                <Input
                                    value={form.laboratory}
                                    onChange={(e) => setForm({ ...form, laboratory: e.target.value })}
                                    placeholder="Fabricante"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Stock Mínimo</Label>
                                    <Input
                                        type="number"
                                        value={form.minStock}
                                        onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <Label>Stock Máximo</Label>
                                    <Input
                                        type="number"
                                        value={form.maxStock}
                                        onChange={(e) => setForm({ ...form, maxStock: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-6">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={form.requiresPrescription}
                                        onChange={(e) => setForm({ ...form, requiresPrescription: e.target.checked })}
                                    />
                                    <span className="text-sm">Requiere Fórmula</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={form.isControlled}
                                        onChange={(e) => setForm({ ...form, isControlled: e.target.checked })}
                                    />
                                    <span className="text-sm">Medicamento Controlado</span>
                                </label>
                            </div>

                            <div className="flex gap-3 mt-4">
                                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button className="flex-1" onClick={submitForm} disabled={submitting}>
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    {editing ? 'Actualizar' : 'Crear'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Búsqueda */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex gap-4">
                        <Input
                            placeholder="Buscar por código, nombre o molécula..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && loadProducts()}
                            className="flex-1"
                        />
                        <Button onClick={loadProducts} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            <span className="ml-2">Buscar</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Tabla */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                        Productos ({total})
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
                                        <TableHead className="text-xs text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.map(p => (
                                        <TableRow key={p.id} className={!p.isActive ? "opacity-50" : ""}>
                                            <TableCell className="font-mono text-xs">{p.code}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-sm">{p.name}</p>
                                                    {p.laboratory && (
                                                        <p className="text-xs text-gray-500">{p.laboratory}</p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">{p.molecule || "-"}</TableCell>
                                            <TableCell className="text-sm">
                                                {p.presentation && p.concentration
                                                    ? `${p.presentation} ${p.concentration}`
                                                    : p.presentation || p.concentration || "-"
                                                }
                                            </TableCell>
                                            <TableCell className="text-right">
                                                ${p.price.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex gap-1 justify-center">
                                                    {p.isActive ? (
                                                        <Badge variant="secondary">Activo</Badge>
                                                    ) : (
                                                        <Badge variant="destructive">Inactivo</Badge>
                                                    )}
                                                    {p.isControlled && (
                                                        <Badge variant="outline" className="text-red-500 border-red-500">C</Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-1 justify-end">
                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(p)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    {p.isActive && (
                                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => deleteProduct(p.id)}>
                                                            <Trash2 className="h-4 w-4" />
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
        </div>
    );
}
