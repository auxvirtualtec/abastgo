"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
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
    Search,
    Plus,
    Trash2,
    Loader2,
    ArrowLeft,
    Send,
    Save,
    CheckCircle2,
    Package,
} from "lucide-react";

interface InvimaDrug {
    id: string;
    cum: string;
    producto: string;
    principioActivo?: string;
    concentracion?: string;
    formaFarmaceutica?: string;
    estadoCum?: string;
}

interface QuoteItem {
    id: string;
    invimaDrugId?: string;
    productId?: string;
    description: string;
    cum?: string;
    quantity: number;
}

interface Supplier {
    id: string;
    name: string;
    code: string;
    email?: string;
    phone?: string;
    preferredContact?: string;
}

export default function NuevaCotizacionPage() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Búsqueda de medicamentos
    const [search, setSearch] = useState("");
    const [searchResults, setSearchResults] = useState<InvimaDrug[]>([]);
    const [searching, setSearching] = useState(false);

    // Items de la cotización
    const [items, setItems] = useState<QuoteItem[]>([]);

    // Proveedores
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);

    // Opciones
    const [notes, setNotes] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [sendNow, setSendNow] = useState(false);

    useEffect(() => {
        loadSuppliers();
    }, []);

    // Autocompletar: buscar mientras el usuario escribe
    useEffect(() => {
        if (search.length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(() => {
            searchDrugs();
        }, 300); // Esperar 300ms después de que el usuario deje de escribir

        return () => clearTimeout(timer);
    }, [search]);

    const loadSuppliers = async () => {
        try {
            const res = await fetch('/api/suppliers');
            if (res.ok) {
                const data = await res.json();
                setSuppliers(data.suppliers || []);
            }
        } catch (error) {
            console.error('Error cargando proveedores:', error);
        }
    };

    const searchDrugs = async () => {
        if (search.length < 2) return;

        setSearching(true);
        try {
            const res = await fetch(`/api/invima?q=${encodeURIComponent(search)}&limit=15&estado=Activo`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data.data || []);
            }
        } catch (error) {
            console.error('Error buscando medicamentos:', error);
        } finally {
            setSearching(false);
        }
    };

    const addItem = (drug: InvimaDrug) => {
        // Verificar si ya existe
        if (items.find(i => i.invimaDrugId === drug.id)) {
            return;
        }

        const newItem: QuoteItem = {
            id: crypto.randomUUID(),
            invimaDrugId: drug.id,
            cum: drug.cum,
            description: `${drug.producto}${drug.concentracion ? ` - ${drug.concentracion}` : ''}`,
            quantity: 1
        };

        setItems([...items, newItem]);
        setSearch("");
        setSearchResults([]);
    };

    const addCustomItem = () => {
        const newItem: QuoteItem = {
            id: crypto.randomUUID(),
            description: "",
            quantity: 1
        };
        setItems([...items, newItem]);
    };

    const updateItem = (id: string, field: keyof QuoteItem, value: any) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const removeItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const toggleSupplier = (supplierId: string) => {
        if (selectedSuppliers.includes(supplierId)) {
            setSelectedSuppliers(selectedSuppliers.filter(id => id !== supplierId));
        } else {
            setSelectedSuppliers([...selectedSuppliers, supplierId]);
        }
    };

    const handleSubmit = async () => {
        if (items.length === 0) {
            alert('Agrega al menos un producto a la cotización');
            return;
        }

        if (items.some(i => !i.description.trim())) {
            alert('Completa la descripción de todos los productos');
            return;
        }

        if (sendNow && selectedSuppliers.length === 0) {
            alert('Selecciona al menos un proveedor para enviar la cotización');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/quotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: items.map(item => ({
                        invimaDrugId: item.invimaDrugId,
                        productId: item.productId,
                        description: item.description,
                        quantity: item.quantity
                    })),
                    supplierIds: sendNow ? selectedSuppliers : [],
                    notes,
                    dueDate: dueDate || undefined,
                    sendNow
                })
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => {
                    window.location.href = '/compras';
                }, 2000);
            } else {
                const error = await res.json();
                alert(error.error || 'Error al crear la cotización');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al crear la cotización');
        } finally {
            setSaving(false);
        }
    };

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">¡Cotización Creada!</h2>
                <p className="text-gray-500">Redirigiendo al módulo de compras...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => window.location.href = '/compras'}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Nueva Solicitud de Cotización</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Busca productos en el catálogo INVIMA y solicita cotizaciones
                    </p>
                </div>
            </div>

            {/* Búsqueda de medicamentos */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Buscar Productos INVIMA</CardTitle>
                    <CardDescription>
                        Busca por nombre, principio activo o código CUM
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Input
                                placeholder="Ej: Acetaminofen, Metformina, Losartan..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && searchDrugs()}
                            />
                        </div>
                        <Button onClick={searchDrugs} disabled={searching || search.length < 2}>
                            {searching ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Search className="h-4 w-4" />
                            )}
                            <span className="ml-2">Buscar</span>
                        </Button>
                        <Button variant="outline" onClick={addCustomItem}>
                            <Plus className="h-4 w-4 mr-2" />
                            Personalizado
                        </Button>
                    </div>

                    {/* Resultados de búsqueda */}
                    {searchResults.length > 0 && (
                        <div className="mt-4 border rounded-lg max-h-60 overflow-y-auto">
                            {searchResults.map((drug) => (
                                <div
                                    key={drug.id}
                                    onClick={() => addItem(drug)}
                                    className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                                >
                                    <div>
                                        <p className="font-medium">{drug.producto}</p>
                                        <p className="text-xs text-gray-500">
                                            {drug.principioActivo} | {drug.formaFarmaceutica} | CUM: {drug.cum}
                                        </p>
                                    </div>
                                    <Badge variant={drug.estadoCum === 'Activo' ? 'default' : 'secondary'}>
                                        {drug.estadoCum}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Productos seleccionados */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                        Productos a Cotizar ({items.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {items.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p>Busca y agrega productos para cotizar</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50 dark:bg-gray-800">
                                    <TableHead className="text-xs">CUM</TableHead>
                                    <TableHead className="text-xs">Descripción</TableHead>
                                    <TableHead className="text-xs text-center w-32">Cantidad</TableHead>
                                    <TableHead className="text-xs w-16"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-mono text-xs">
                                            {item.cum || '-'}
                                        </TableCell>
                                        <TableCell>
                                            {item.invimaDrugId ? (
                                                <span className="text-sm">{item.description}</span>
                                            ) : (
                                                <Input
                                                    value={item.description}
                                                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                                    placeholder="Descripción del producto..."
                                                    className="h-8"
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                                className="h-8 text-center"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeItem(item.id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Opciones de envío */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Opciones de Cotización</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">
                                Fecha límite de respuesta
                            </label>
                            <Input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Notas</label>
                            <Textarea
                                placeholder="Instrucciones especiales, condiciones..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="sendNow"
                            checked={sendNow}
                            onChange={(e) => setSendNow(e.target.checked)}
                            className="rounded"
                        />
                        <label htmlFor="sendNow" className="text-sm">
                            Enviar cotización a proveedores ahora
                        </label>
                    </div>

                    {sendNow && (
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                Seleccionar Proveedores ({selectedSuppliers.length})
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {suppliers.map((supplier) => (
                                    <div
                                        key={supplier.id}
                                        onClick={() => toggleSupplier(supplier.id)}
                                        className={`p-3 border rounded-lg cursor-pointer transition-all ${selectedSuppliers.includes(supplier.id)
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                            }`}
                                    >
                                        <p className="font-medium text-sm">{supplier.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {supplier.email || supplier.phone || 'Sin contacto'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            {suppliers.length === 0 && (
                                <p className="text-sm text-gray-500 text-center py-4">
                                    No hay proveedores registrados.
                                    <a href="/compras/proveedores" className="text-blue-500 ml-1">
                                        Agregar proveedor
                                    </a>
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Botones de acción */}
            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => window.location.href = '/compras'}>
                    Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={saving || items.length === 0}>
                    {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : sendNow ? (
                        <Send className="h-4 w-4 mr-2" />
                    ) : (
                        <Save className="h-4 w-4 mr-2" />
                    )}
                    {sendNow ? 'Crear y Enviar' : 'Guardar Cotización'}
                </Button>
            </div>
        </div>
    );
}
