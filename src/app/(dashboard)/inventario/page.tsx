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
    FileText,
    LayoutGrid,
    List,
} from "lucide-react";
import { exportInventoryPDF } from "@/lib/export-pdf";

interface InventoryItem {
    productId: string;
    productCode: string;
    productName: string;
    molecule?: string;
    warehouseId?: string;
    warehouseName?: string;
    warehouseCode?: string;
    epsName?: string;
    warehouseCount?: number;
    totalQuantity: number;
    lots: {
        inventoryId: string;
        lotNumber: string;
        quantity: number;
        unitCost: number;
        expiryDate?: string;
        warehouseName?: string;
        epsName?: string;
    }[];
}

interface WarehouseOption {
    id: string;
    code: string;
    name: string;
    type: string;
    epsId?: string;
}

interface EPSOption {
    id: string;
    code: string;
    name: string;
}

export default function InventarioPage() {
    const [loading, setLoading] = useState(false);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
    const [epsList, setEpsList] = useState<EPSOption[]>([]);
    const [search, setSearch] = useState("");
    const [selectedWarehouse, setSelectedWarehouse] = useState("");
    const [selectedEps, setSelectedEps] = useState("");
    const [showLowStock, setShowLowStock] = useState(false);
    const [viewMode, setViewMode] = useState<'warehouse' | 'consolidated'>('warehouse');

    // Estadísticas
    const [stats, setStats] = useState({
        totalProducts: 0,
        totalItems: 0,
        lowStock: 0,
        expiringSoon: 0
    });

    useEffect(() => {
        loadWarehouses();
        loadEps();
        loadInventory();
    }, []);

    // Recargar cuando cambia el modo de vista
    useEffect(() => {
        loadInventory();
    }, [viewMode, selectedEps]);

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

    const loadEps = async () => {
        try {
            const response = await fetch('/api/eps');
            if (response.ok) {
                const data = await response.json();
                setEpsList(data.eps || []);
            }
        } catch (error) {
            console.error('Error cargando EPS:', error);
        }
    };

    const loadInventory = async () => {
        setLoading(true);
        try {
            let url = '/api/inventory?';
            if (search) url += `search=${search}&`;
            if (selectedWarehouse) url += `warehouseId=${selectedWarehouse}&`;
            if (selectedEps) url += `epsId=${selectedEps}&`;
            if (viewMode === 'consolidated') url += `groupBy=product&`;

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

    // Filtrar bodegas por EPS seleccionada
    const filteredWarehouses = selectedEps
        ? warehouses.filter(w => w.epsId === selectedEps)
        : warehouses;

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

    const exportPDF = () => {
        // Transformar datos para PDF - incluir warehouseName para agrupación
        const pdfData = inventory.flatMap(item =>
            item.lots.map(lot => ({
                productCode: item.productCode,
                productName: item.productName,
                lotNumber: lot.lotNumber,
                expiryDate: lot.expiryDate,
                quantity: lot.quantity,
                unitCost: lot.unitCost,
                warehouseName: lot.warehouseName || item.warehouseName || 'Sin Bodega'
            }))
        );
        const warehouseName = selectedWarehouse
            ? warehouses.find(w => w.id === selectedWarehouse)?.name
            : undefined;
        exportInventoryPDF(pdfData, warehouseName);
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
                <div className="flex gap-2">
                    <Button variant="outline" onClick={exportCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        CSV
                    </Button>
                    <Button variant="outline" onClick={exportPDF}>
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                    </Button>
                </div>
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
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <Input
                                placeholder="Buscar por nombre, código o molécula..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            />
                        </div>
                        <select
                            value={selectedEps}
                            onChange={(e) => {
                                setSelectedEps(e.target.value);
                                setSelectedWarehouse(""); // Reset warehouse al cambiar EPS
                            }}
                            className="h-10 rounded-md border border-input bg-background px-3 min-w-[150px]"
                        >
                            <option value="">Todas las EPS</option>
                            {epsList.map(eps => (
                                <option key={eps.id} value={eps.id}>{eps.name}</option>
                            ))}
                        </select>
                        <select
                            value={selectedWarehouse}
                            onChange={(e) => setSelectedWarehouse(e.target.value)}
                            className="h-10 rounded-md border border-input bg-background px-3 min-w-[180px]"
                            disabled={viewMode === 'consolidated'}
                        >
                            <option value="">Todas las bodegas</option>
                            {filteredWarehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                        <div className="flex border rounded-md overflow-hidden">
                            <button
                                onClick={() => setViewMode('warehouse')}
                                className={`px-3 py-2 flex items-center gap-1 text-sm ${viewMode === 'warehouse'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-background hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                            >
                                <List className="h-4 w-4" />
                                Por Bodega
                            </button>
                            <button
                                onClick={() => setViewMode('consolidated')}
                                className={`px-3 py-2 flex items-center gap-1 text-sm ${viewMode === 'consolidated'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-background hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                            >
                                <LayoutGrid className="h-4 w-4" />
                                Totales
                            </button>
                        </div>
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
                                        {viewMode === 'warehouse' ? (
                                            <>
                                                <TableHead className="text-xs">Bodega</TableHead>
                                                <TableHead className="text-xs">EPS</TableHead>
                                            </>
                                        ) : (
                                            <TableHead className="text-xs text-center">Bodegas</TableHead>
                                        )}
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
                                        const itemKey = viewMode === 'consolidated'
                                            ? item.productId
                                            : `${item.productId}-${item.warehouseId}`;

                                        return (
                                            <TableRow key={itemKey}>
                                                <TableCell className="font-mono text-xs">{item.productCode}</TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium text-sm">{item.productName}</p>
                                                        {item.molecule && (
                                                            <p className="text-xs text-gray-500">{item.molecule}</p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                {viewMode === 'warehouse' ? (
                                                    <>
                                                        <TableCell className="text-sm">{item.warehouseName}</TableCell>
                                                        <TableCell className="text-sm">
                                                            <Badge variant="outline">{item.epsName}</Badge>
                                                        </TableCell>
                                                    </>
                                                ) : (
                                                    <TableCell className="text-center">
                                                        <Badge variant="secondary">{item.warehouseCount} bodegas</Badge>
                                                    </TableCell>
                                                )}
                                                <TableCell className="text-center">
                                                    <Badge variant={item.totalQuantity > 10 ? "default" : "destructive"}>
                                                        {item.totalQuantity.toLocaleString()}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {item.lots.slice(0, 2).map((l, idx) => (
                                                        <div key={l.inventoryId || idx} className="text-gray-500">
                                                            {l.lotNumber} ({l.quantity})
                                                            {viewMode === 'consolidated' && l.warehouseName && (
                                                                <span className="text-blue-500 ml-1">- {l.warehouseName}</span>
                                                            )}
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
