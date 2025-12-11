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
    Warehouse,
    Plus,
    Search,
    Loader2,
    Save,
    Edit,
    Trash2,
    Package,
    Users,
    MapPin,
    Building,
} from "lucide-react";

interface WarehouseData {
    id: string;
    code: string;
    name: string;
    type: string;
    address?: string;
    city?: string;
    phone?: string;
    isActive: boolean;
    inventoryCount: number;
    usersCount: number;
    epsId?: string | null;
    epsName?: string | null;
}

const warehouseTypes = [
    { value: 'BODEGA_CENTRAL', label: 'Bodega Central' },
    { value: 'DISPENSARIO', label: 'Dispensario' },
    { value: 'PUNTO_ENTREGA', label: 'Punto de Entrega' },
    { value: 'FARMACIA', label: 'Farmacia' },
];

export default function BodegasPage() {
    const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState("");
    const [showInactive, setShowInactive] = useState(false);

    // Modal
    const [dialogOpen, setDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        code: "",
        name: "",
        type: "DISPENSARIO",
        address: "",
        city: "",
        phone: "",
        epsId: ""
    });

    const [epsList, setEpsList] = useState<any[]>([]);

    useEffect(() => {
        loadWarehouses();
        loadEps();
    }, [filterType, showInactive]);

    const loadEps = async () => {
        try {
            const res = await fetch('/api/eps');
            if (res.ok) {
                const data = await res.json();
                setEpsList(data.eps || []);
            }
        } catch (e) {
            console.error("Error loading EPS", e);
        }
    };

    const loadWarehouses = async () => {
        setLoading(true);
        try {
            let url = '/api/warehouses?';
            if (filterType) url += `type=${filterType}&`;
            if (showInactive) url += 'includeInactive=true&';
            if (search) url += `search=${encodeURIComponent(search)}&`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setWarehouses(data.warehouses || []);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        loadWarehouses();
    };

    const openCreate = () => {
        setEditingId(null);
        setForm({ code: "", name: "", type: "DISPENSARIO", address: "", city: "", phone: "", epsId: "" });
        setDialogOpen(true);
    };

    const openEdit = (warehouse: WarehouseData) => {
        setEditingId(warehouse.id);
        setForm({
            code: warehouse.code,
            name: warehouse.name,
            type: warehouse.type,
            address: warehouse.address || "",
            city: warehouse.city || "",
            phone: warehouse.phone || "",
            epsId: warehouse.epsId || ""
        });
        setDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!form.code || !form.name || !form.type) {
            alert('Código, nombre y tipo son requeridos');
            return;
        }

        setSubmitting(true);
        try {
            const response = await fetch('/api/warehouses', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingId ? { id: editingId, ...form } : form)
            });

            if (response.ok) {
                setDialogOpen(false);
                loadWarehouses();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Error guardando bodega');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (warehouse: WarehouseData) => {
        if (!warehouse.isActive) {
            // Reactivar
            const response = await fetch('/api/warehouses', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: warehouse.id, isActive: true })
            });
            if (response.ok) loadWarehouses();
        } else {
            // Desactivar
            const response = await fetch(`/api/warehouses?id=${warehouse.id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                loadWarehouses();
            } else {
                const error = await response.json();
                alert(error.error);
            }
        }
    };

    const stats = {
        total: warehouses.length,
        active: warehouses.filter(w => w.isActive).length,
        dispensarios: warehouses.filter(w => w.type === 'DISPENSARIO').length,
        central: warehouses.filter(w => w.type === 'BODEGA_CENTRAL').length
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Warehouse className="h-6 w-6" />
                        Gestión de Bodegas
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Administra bodegas, dispensarios y puntos de entrega
                    </p>
                </div>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openCreate}>
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva Bodega
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingId ? 'Editar' : 'Nueva'} Bodega</DialogTitle>
                            <DialogDescription>
                                {editingId ? 'Modifica los datos de la bodega' : 'Registra una nueva bodega o dispensario'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Código *</Label>
                                    <Input
                                        value={form.code}
                                        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                        placeholder="EPS-BOD-001"
                                    />
                                </div>
                                <div>
                                    <Label>Tipo *</Label>
                                    <select
                                        value={form.type}
                                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                    >
                                        {warehouseTypes.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <Label>Nombre *</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Dispensario Norte"
                                />
                            </div>

                            <div>
                                <Label>Dirección</Label>
                                <Input
                                    value={form.address}
                                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                                    placeholder="Calle 123 #45-67"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Ciudad</Label>
                                    <Input
                                        value={form.city}
                                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                                        placeholder="Bogotá"
                                    />
                                </div>
                                <div>
                                    <Label>Teléfono</Label>
                                    <Input
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        placeholder="(1) 234-5678"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-4">
                                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                >
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    Guardar
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Warehouse className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Total</p>
                                <p className="text-xl font-bold">{stats.total}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <Building className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Activas</p>
                                <p className="text-xl font-bold">{stats.active}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                <MapPin className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Dispensarios</p>
                                <p className="text-xl font-bold">{stats.dispensarios}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                <Package className="h-5 w-5 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Bodegas Centrales</p>
                                <p className="text-xl font-bold">{stats.central}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filtros */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <Label className="text-xs">Buscar</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Nombre, código o ciudad..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                    className="flex-1"
                                />
                                <Button onClick={handleSearch}>
                                    <Search className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs">Tipo</Label>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-40 h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="">Todos</option>
                                {warehouseTypes.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="showInactive"
                                checked={showInactive}
                                onChange={(e) => setShowInactive(e.target.checked)}
                            />
                            <Label htmlFor="showInactive" className="text-xs cursor-pointer">
                                Mostrar inactivas
                            </Label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabla */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Bodegas y Dispensarios</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : warehouses.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Warehouse className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No hay bodegas registradas</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                                        <TableHead className="text-xs">Código</TableHead>
                                        <TableHead className="text-xs">Nombre</TableHead>
                                        <TableHead className="text-xs">Tipo</TableHead>
                                        <TableHead className="text-xs">Ciudad</TableHead>
                                        <TableHead className="text-xs text-center">Productos</TableHead>
                                        <TableHead className="text-xs text-center">Usuarios</TableHead>
                                        <TableHead className="text-xs text-center">Estado</TableHead>
                                        <TableHead className="text-xs w-24">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {warehouses.map(warehouse => (
                                        <TableRow key={warehouse.id} className={!warehouse.isActive ? 'opacity-50' : ''}>
                                            <TableCell className="font-mono text-sm">{warehouse.code}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{warehouse.name}</p>
                                                    {warehouse.address && (
                                                        <p className="text-xs text-gray-500">{warehouse.address}</p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {warehouseTypes.find(t => t.value === warehouse.type)?.label || warehouse.type}
                                                </Badge>
                                                {warehouse.epsName && (
                                                    <div className="mt-1">
                                                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                                            EPS: {warehouse.epsName}
                                                        </Badge>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm">{warehouse.city || '-'}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary">{warehouse.inventoryCount}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary">{warehouse.usersCount}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={warehouse.isActive ? "default" : "secondary"}>
                                                    {warehouse.isActive ? 'Activa' : 'Inactiva'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => openEdit(warehouse)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => toggleActive(warehouse)}
                                                        className={warehouse.isActive ? "text-red-500" : "text-green-500"}
                                                    >
                                                        {warehouse.isActive ? <Trash2 className="h-4 w-4" /> : <Building className="h-4 w-4" />}
                                                    </Button>
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
        </div >
    );
}
