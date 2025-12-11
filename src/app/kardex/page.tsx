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
    History,
    Search,
    Loader2,
    ArrowDownCircle,
    ArrowUpCircle,
    ArrowRightLeft,
    Download,
    Package,
    Calendar,
    FileText,
} from "lucide-react";
import { exportKardexPDF } from "@/lib/export-pdf";

interface Movement {
    id: string;
    date: string;
    type: string;
    reference: string;
    description: string;
    productCode: string;
    productName: string;
    warehouseName: string;
    lotNumber?: string;
    quantityIn: number;
    quantityOut: number;
    unitCost: number;
    balance: number;
}

interface Product {
    id: string;
    code: string;
    name: string;
}

export default function KardexPage() {
    const [movements, setMovements] = useState<Movement[]>([]);
    const [loading, setLoading] = useState(false);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // Filtros
    const [selectedWarehouse, setSelectedWarehouse] = useState("");
    const [selectedProduct, setSelectedProduct] = useState("");
    const [productSearch, setProductSearch] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    useEffect(() => {
        loadWarehouses();
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

    const searchProducts = async () => {
        if (!productSearch.trim()) return;
        try {
            const response = await fetch(`/api/products?search=${productSearch}`);
            if (response.ok) {
                const data = await response.json();
                setProducts(data.products || []);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const selectProduct = (product: Product) => {
        setSelectedProduct(product.id);
        setProductSearch(product.name);
        setProducts([]);
    };

    const loadKardex = async () => {
        setLoading(true);
        try {
            let url = '/api/kardex?';
            if (selectedWarehouse) url += `warehouseId=${selectedWarehouse}&`;
            if (selectedProduct) url += `productId=${selectedProduct}&`;
            if (startDate) url += `startDate=${startDate}&`;
            if (endDate) url += `endDate=${endDate}&`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setMovements(data.movements || []);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'ENTRADA':
                return <ArrowDownCircle className="h-4 w-4 text-green-500" />;
            case 'SALIDA':
                return <ArrowUpCircle className="h-4 w-4 text-red-500" />;
            case 'TRASLADO_ENTRADA':
                return <ArrowRightLeft className="h-4 w-4 text-blue-500" />;
            case 'TRASLADO_SALIDA':
                return <ArrowRightLeft className="h-4 w-4 text-orange-500" />;
            default:
                return <History className="h-4 w-4" />;
        }
    };

    const getTypeBadge = (type: string) => {
        const styles: Record<string, string> = {
            'ENTRADA': 'bg-green-100 text-green-700',
            'SALIDA': 'bg-red-100 text-red-700',
            'TRASLADO_ENTRADA': 'bg-blue-100 text-blue-700',
            'TRASLADO_SALIDA': 'bg-orange-100 text-orange-700'
        };
        const labels: Record<string, string> = {
            'ENTRADA': 'Entrada',
            'SALIDA': 'Salida',
            'TRASLADO_ENTRADA': 'Traslado +',
            'TRASLADO_SALIDA': 'Traslado -'
        };
        return (
            <Badge className={styles[type] || ''}>
                {labels[type] || type}
            </Badge>
        );
    };

    const exportCSV = () => {
        const headers = ['Fecha', 'Tipo', 'Referencia', 'Producto', 'Bodega', 'Lote', 'Entrada', 'Salida', 'Saldo'];
        const rows = movements.map(m => [
            new Date(m.date).toLocaleDateString('es-CO'),
            m.type,
            m.reference,
            `${m.productCode} - ${m.productName}`,
            m.warehouseName,
            m.lotNumber || '',
            m.quantityIn,
            m.quantityOut,
            m.balance
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kardex_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    // Estadísticas
    const stats = {
        totalIn: movements.reduce((sum, m) => sum + m.quantityIn, 0),
        totalOut: movements.reduce((sum, m) => sum + m.quantityOut, 0),
        entries: movements.filter(m => m.type === 'ENTRADA').length,
        exits: movements.filter(m => m.type === 'SALIDA').length
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <History className="h-6 w-6" />
                        Kardex de Movimientos
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Historial de entradas, salidas y traslados de inventario
                    </p>
                </div>
                {movements.length > 0 && (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={exportCSV}>
                            <Download className="h-4 w-4 mr-2" />
                            CSV
                        </Button>
                        <Button variant="outline" onClick={() => exportKardexPDF(movements, productSearch || undefined)}>
                            <FileText className="h-4 w-4 mr-2" />
                            PDF
                        </Button>
                    </div>
                )}
            </div>

            {/* Filtros */}
            <Card>
                <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div>
                            <Label className="text-xs">Bodega</Label>
                            <select
                                value={selectedWarehouse}
                                onChange={(e) => setSelectedWarehouse(e.target.value)}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="">Todas</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="relative">
                            <Label className="text-xs">Producto</Label>
                            <div className="flex gap-1">
                                <Input
                                    placeholder="Buscar producto..."
                                    value={productSearch}
                                    onChange={(e) => { setProductSearch(e.target.value); setSelectedProduct(""); }}
                                    onKeyDown={(e) => e.key === "Enter" && searchProducts()}
                                    className="h-9"
                                />
                                <Button size="sm" variant="outline" onClick={searchProducts}>
                                    <Search className="h-3 w-3" />
                                </Button>
                            </div>
                            {products.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                    {products.map(p => (
                                        <div
                                            key={p.id}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-sm"
                                            onClick={() => selectProduct(p)}
                                        >
                                            <span className="font-mono">{p.code}</span> - {p.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <Label className="text-xs">Desde</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="h-9"
                            />
                        </div>

                        <div>
                            <Label className="text-xs">Hasta</Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="h-9"
                            />
                        </div>

                        <Button onClick={loadKardex} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                            Consultar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            {movements.length > 0 && (
                <div className="grid grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <History className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Movimientos</p>
                                    <p className="text-xl font-bold">{movements.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                    <ArrowDownCircle className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Total Entradas</p>
                                    <p className="text-xl font-bold">{stats.totalIn.toLocaleString()}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                                    <ArrowUpCircle className="h-5 w-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Total Salidas</p>
                                    <p className="text-xl font-bold">{stats.totalOut.toLocaleString()}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                    <Package className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Saldo Final</p>
                                    <p className="text-xl font-bold">
                                        {movements.length > 0 ? movements[0].balance.toLocaleString() : 0}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Tabla */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Movimientos</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : movements.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>Selecciona filtros y haz clic en Consultar</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                                        <TableHead className="text-xs">Fecha</TableHead>
                                        <TableHead className="text-xs">Tipo</TableHead>
                                        <TableHead className="text-xs">Referencia</TableHead>
                                        <TableHead className="text-xs">Producto</TableHead>
                                        <TableHead className="text-xs">Bodega</TableHead>
                                        <TableHead className="text-xs">Lote</TableHead>
                                        <TableHead className="text-xs text-right text-green-600">Entrada</TableHead>
                                        <TableHead className="text-xs text-right text-red-600">Salida</TableHead>
                                        <TableHead className="text-xs text-right">Saldo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {movements.map(movement => (
                                        <TableRow key={movement.id}>
                                            <TableCell className="text-sm">
                                                {new Date(movement.date).toLocaleDateString('es-CO')}
                                            </TableCell>
                                            <TableCell>{getTypeBadge(movement.type)}</TableCell>
                                            <TableCell className="font-mono text-xs">{movement.reference}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="text-sm font-medium">{movement.productName}</p>
                                                    <p className="text-xs text-gray-500">{movement.productCode}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">{movement.warehouseName}</TableCell>
                                            <TableCell className="text-xs font-mono">{movement.lotNumber || '-'}</TableCell>
                                            <TableCell className="text-right text-green-600 font-medium">
                                                {movement.quantityIn > 0 ? `+${movement.quantityIn}` : ''}
                                            </TableCell>
                                            <TableCell className="text-right text-red-600 font-medium">
                                                {movement.quantityOut > 0 ? `-${movement.quantityOut}` : ''}
                                            </TableCell>
                                            <TableCell className="text-right font-bold">
                                                {movement.balance}
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
