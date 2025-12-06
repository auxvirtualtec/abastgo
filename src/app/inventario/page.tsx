"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    Search,
    Package,
    Warehouse,
    Filter,
    Download,
    Loader2,
    AlertTriangle,
} from "lucide-react";

interface InventoryItem {
    productId: string;
    productCode: string;
    productName: string;
    molecule?: string;
    warehouseId: string;
    warehouseName: string;
    warehouseCode: string;
    totalQuantity: number;
    lots: {
        inventoryId: string;
        lotNumber: string;
        quantity: number;
        unitCost: number;
        expiryDate?: string;
    }[];
}

interface WarehouseOption {
    id: string;
    code: string;
    name: string;
    type: string;
}

export default function InventarioPage() {
    const [loading, setLoading] = useState(false);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
    const [search, setSearch] = useState("");
    const [selectedWarehouse, setSelectedWarehouse] = useState("");
    const [showLowStock, setShowLowStock] = useState(false);

    // Estadísticas
    const [stats, setStats] = useState({
        totalProducts: 0,
        totalItems: 0,
        lowStock: 0,
        expiringSoon: 0
    });

    useEffect(() => {
        loadWarehouses();
        loadInventory();
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

    const loadInventory = async () => {
        setLoading(true);
        try {
            let url = '/api/inventory?';
            if (search) url += `search=${search}&`;
            if (selectedWarehouse) url += `warehouseId=${selectedWarehouse}&`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                const items = data.items || [];
                setInventory(items);

                // Calcular estadísticas
                const lowStockCount = items.filter((i: InventoryItem) => i.totalQuantity <= 10).length;
                const expiringCount = items.filter((i: InventoryItem) => {
                    const soon = new Date();
                    soon.setMonth(soon.getMonth() + 3);
                    return i.lots.some(l => l.expiryDate && new Date(l.expiryDate) <= soon);
                }).length;

                setStats({
                    totalProducts: items.length,
                    totalItems: items.reduce((sum: number, i: InventoryItem) => sum + i.totalQuantity, 0),
                    lowStock: lowStockCount,
                    expiringSoon: expiringCount
                });
            }
        } catch (error) {
            console.error('Error cargando inventario:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        loadInventory();
    };

    const filteredInventory = showLowStock
        ? inventory.filter(i => i.totalQuantity <= 10)
        : inventory;

    const exportCSV = () => {
        const headers = ['Código', 'Producto', 'Bodega', 'Cantidad', 'Lotes'];
        const rows = inventory.map(item => [
            item.productCode,
            item.productName,
            item.warehouseName,
            item.totalQuantity.toString(),
            item.lots.map(l => l.lotNumber).join('; ')
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Inventario / Existencias</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Consulta el stock disponible en todas las bodegas
                    </p>
                </div>
                <Button variant="outline" onClick={exportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Package className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Productos</p>
                                <p className="text-xl font-bold">{stats.totalProducts.toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                <Warehouse className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Unidades</p>
                                <p className="text-xl font-bold">{stats.totalItems.toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:ring-2 ring-amber-500" onClick={() => setShowLowStock(!showLowStock)}>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Stock Bajo</p>
                                <p className="text-xl font-bold">{stats.lowStock}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Por Vencer</p>
                                <p className="text-xl font-bold">{stats.expiringSoon}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filtros */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <Input
                                placeholder="Buscar por nombre, código o molécula..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            />
                        </div>
                        <select
                            value={selectedWarehouse}
                            onChange={(e) => setSelectedWarehouse(e.target.value)}
                            className="h-10 rounded-md border border-input bg-background px-3 min-w-[200px]"
                        >
                            <option value="">Todas las bodegas</option>
                            {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                        <Button onClick={handleSearch} disabled={loading}>
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Search className="h-4 w-4" />
                            )}
                            <span className="ml-2">Buscar</span>
                        </Button>
                        {showLowStock && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                                <Filter className="h-3 w-3" />
                                Solo Stock Bajo
                                <button onClick={() => setShowLowStock(false)} className="ml-1">×</button>
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Tabla de inventario */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                        Existencias ({filteredInventory.length} productos)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : filteredInventory.length === 0 ? (
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
                                        <TableHead className="text-xs">Producto</TableHead>
                                        <TableHead className="text-xs">Bodega</TableHead>
                                        <TableHead className="text-xs text-center">Cantidad</TableHead>
                                        <TableHead className="text-xs">Lotes</TableHead>
                                        <TableHead className="text-xs text-right">Valor Unit.</TableHead>
                                        <TableHead className="text-xs text-right">Valor Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredInventory.map((item) => {
                                        const avgCost = item.lots.reduce((sum, l) => sum + l.unitCost, 0) / item.lots.length;
                                        const totalValue = item.lots.reduce((sum, l) => sum + (l.quantity * l.unitCost), 0);

                                        return (
                                            <TableRow key={`${item.productId}-${item.warehouseId}`}>
                                                <TableCell className="font-mono text-xs">{item.productCode}</TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium text-sm">{item.productName}</p>
                                                        {item.molecule && (
                                                            <p className="text-xs text-gray-500">{item.molecule}</p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm">{item.warehouseName}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={item.totalQuantity > 10 ? "default" : "destructive"}>
                                                        {item.totalQuantity}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {item.lots.slice(0, 2).map(l => (
                                                        <div key={l.inventoryId} className="text-gray-500">
                                                            {l.lotNumber} ({l.quantity})
                                                        </div>
                                                    ))}
                                                    {item.lots.length > 2 && (
                                                        <span className="text-blue-500">+{item.lots.length - 2} más</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    ${avgCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
