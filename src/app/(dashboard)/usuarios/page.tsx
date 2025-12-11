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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Users,
    Plus,
    Edit,
    Search,
    Loader2,
    Save,
    Shield,
    Building2,
    Mail,
    Phone,
    Key,
    Power,
} from "lucide-react";

// Available roles from MemberRole enum
const ROLES = [
    { value: "ADMIN", label: "Administrador", description: "Acceso total a la organización", color: "bg-purple-500" },
    { value: "OPERATOR", label: "Operador", description: "Módulo de inventario", color: "bg-blue-500" },
    { value: "DISPENSER", label: "Dispensador", description: "Módulo de dispensación", color: "bg-green-500" },
];

interface User {
    id: string;
    email: string;
    name: string;
    phone?: string;
    isActive: boolean;
    createdAt: string;
    role: string; // MemberRole
    warehouses: { id: string; name: string; code: string }[];
}

interface Warehouse {
    id: string;
    name: string;
    code: string;
}

export default function UsuariosPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");

    // Form
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<User | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        email: "",
        password: "",
        name: "",
        phone: "",
        role: "DISPENSER" as string,
        warehouseIds: [] as string[]
    });

    useEffect(() => {
        loadUsers();
        loadWarehouses();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            let url = '/api/users?includeInactive=true';
            if (search) url += `&search=${search}`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            }
        } catch (error) {
            console.error('Error cargando usuarios:', error);
        } finally {
            setLoading(false);
        }
    };

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

    const openNew = () => {
        setEditing(null);
        setForm({
            email: "",
            password: "",
            name: "",
            phone: "",
            role: "DISPENSER",
            warehouseIds: []
        });
        setDialogOpen(true);
    };

    const openEdit = (user: User) => {
        setEditing(user);
        setForm({
            email: user.email,
            password: "",
            name: user.name,
            phone: user.phone || "",
            role: user.role || "DISPENSER",
            warehouseIds: user.warehouses?.map(w => w.id) || []
        });
        setDialogOpen(true);
    };

    const submitForm = async () => {
        if (!form.email || !form.name || (!editing && !form.password)) {
            alert('Email, nombre y contraseña son requeridos');
            return;
        }

        setSubmitting(true);
        try {
            const method = editing ? 'PUT' : 'POST';
            const body = editing
                ? { id: editing.id, ...form, password: form.password || undefined }
                : form;

            const response = await fetch('/api/users', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                setDialogOpen(false);
                loadUsers();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Error guardando usuario');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (user: User) => {
        try {
            const response = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id, isActive: !user.isActive })
            });
            if (response.ok) {
                loadUsers();
            }
        } catch (error) {
            alert('Error actualizando usuario');
        }
    };

    const toggleWarehouse = (warehouseId: string) => {
        setForm(prev => ({
            ...prev,
            warehouseIds: prev.warehouseIds.includes(warehouseId)
                ? prev.warehouseIds.filter(id => id !== warehouseId)
                : [...prev.warehouseIds, warehouseId]
        }));
    };

    const selectAllWarehouses = () => {
        setForm(prev => ({
            ...prev,
            warehouseIds: warehouses.map(w => w.id)
        }));
    };

    const clearWarehouses = () => {
        setForm(prev => ({ ...prev, warehouseIds: [] }));
    };

    const getRoleBadge = (role: string) => {
        const roleInfo = ROLES.find(r => r.value === role);
        if (!roleInfo) return <Badge variant="outline">{role}</Badge>;
        return (
            <Badge className={roleInfo.color}>
                {roleInfo.label}
            </Badge>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="h-6 w-6" />
                        Gestión de Usuarios
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Asigna roles y bodegas a los usuarios de la organización
                    </p>
                </div>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openNew}>
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Usuario
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editing ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
                            <DialogDescription>
                                {editing ? 'Modifica el rol y bodegas del usuario' : 'Crea un nuevo usuario para la organización'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email *</Label>
                                    <Input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        disabled={!!editing}
                                        placeholder="usuario@empresa.com"
                                    />
                                </div>
                                <div>
                                    <Label className="flex items-center gap-1"><Key className="h-3 w-3" /> Contraseña {!editing && '*'}</Label>
                                    <Input
                                        type="password"
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        placeholder={editing ? "Dejar vacío para mantener" : "••••••••"}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Nombre Completo *</Label>
                                    <Input
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="Juan Pérez"
                                    />
                                </div>
                                <div>
                                    <Label className="flex items-center gap-1"><Phone className="h-3 w-3" /> Teléfono</Label>
                                    <Input
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        placeholder="300 123 4567"
                                    />
                                </div>
                            </div>

                            {/* Role Selection */}
                            <div>
                                <Label className="flex items-center gap-1 mb-2"><Shield className="h-3 w-3" /> Rol del Usuario *</Label>
                                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar rol" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ROLES.map(role => (
                                            <SelectItem key={role.value} value={role.value}>
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${role.color}`}></span>
                                                    <span>{role.label}</span>
                                                    <span className="text-xs text-gray-500">- {role.description}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Warehouse Assignment */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Bodegas Asignadas</Label>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="ghost" size="sm" onClick={selectAllWarehouses}>
                                            Seleccionar todas
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" onClick={clearWarehouses}>
                                            Limpiar
                                        </Button>
                                    </div>
                                </div>
                                <div className="max-h-40 overflow-y-auto border rounded-md p-3 bg-gray-50 dark:bg-gray-800">
                                    {warehouses.length === 0 ? (
                                        <p className="text-sm text-gray-500">No hay bodegas disponibles</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {warehouses.map(wh => (
                                                <Badge
                                                    key={wh.id}
                                                    variant={form.warehouseIds.includes(wh.id) ? "default" : "outline"}
                                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                                    onClick={() => toggleWarehouse(wh.id)}
                                                >
                                                    {wh.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {form.warehouseIds.length} de {warehouses.length} bodegas seleccionadas
                                </p>
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

            {/* Search */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex gap-4">
                        <Input
                            placeholder="Buscar por nombre o email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && loadUsers()}
                            className="flex-1"
                        />
                        <Button onClick={loadUsers} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            <span className="ml-2">Buscar</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Users className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Total</p>
                                <p className="text-xl font-bold">{users.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                {ROLES.map(role => (
                    <Card key={role.value}>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg ${role.color} bg-opacity-20 flex items-center justify-center`}>
                                    <Shield className={`h-5 w-5 ${role.color.replace('bg-', 'text-')}`} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{role.label}s</p>
                                    <p className="text-xl font-bold">{users.filter(u => u.role === role.value).length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Users Table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Usuarios ({users.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No se encontraron usuarios</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                                        <TableHead className="text-xs">Usuario</TableHead>
                                        <TableHead className="text-xs">Email</TableHead>
                                        <TableHead className="text-xs">Rol</TableHead>
                                        <TableHead className="text-xs">Bodegas</TableHead>
                                        <TableHead className="text-xs text-center">Estado</TableHead>
                                        <TableHead className="text-xs text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map(user => (
                                        <TableRow key={user.id} className={!user.isActive ? "opacity-50" : ""}>
                                            <TableCell>
                                                <p className="font-medium text-sm">{user.name}</p>
                                                {user.phone && <p className="text-xs text-gray-500">{user.phone}</p>}
                                            </TableCell>
                                            <TableCell className="text-sm">{user.email}</TableCell>
                                            <TableCell>{getRoleBadge(user.role)}</TableCell>
                                            <TableCell>
                                                <span className="text-xs text-gray-500">
                                                    {user.warehouses?.length || 0} bodegas
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={user.isActive ? "default" : "destructive"}>
                                                    {user.isActive ? "Activo" : "Inactivo"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-1 justify-end">
                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(user)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className={`h-7 w-7 p-0 ${user.isActive ? 'text-red-500' : 'text-green-500'}`}
                                                        onClick={() => toggleActive(user)}
                                                        title={user.isActive ? 'Desactivar' : 'Activar'}
                                                    >
                                                        <Power className="h-4 w-4" />
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
        </div>
    );
}
