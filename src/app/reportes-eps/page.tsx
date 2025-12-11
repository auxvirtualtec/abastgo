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
    Building2,
    Search,
    Loader2,
    Users,
    Package,
    DollarSign,
    TrendingUp,
    Download,
    ArrowLeft,
    FileText,
} from "lucide-react";
import { exportToPDF } from "@/lib/export-pdf";

interface EPSReport {
    epsId: string;
    epsCode: string;
    epsName: string;
    totalEntregas: number;
    totalItems: number;
    totalUnidades: number;
    valorTotal: number;
    pacientesUnicos: number;
}

interface EPSDetail {
    eps: { id: string; code: string; name: string };
    estadisticas: {
        totalEntregas: number;
        totalItems: number;
        totalUnidades: number;
        valorTotal: number;
        pacientesUnicos: number;
        productosUnicos: number;
    };
    topProductos: { id: string; code: string; name: string; cantidad: number; valor: number }[];
    topPacientes: { id: string; documentNumber: string; name: string; entregas: number; valor: number }[];
    entregasPorDia: { fecha: string; cantidad: number; valor: number }[];
    detalleEntregas: any[];
}

export default function ReportesEPSPage() {
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [epsList, setEpsList] = useState<{ id: string; code: string; name: string }[]>([]);
    const [selectedEPSId, setSelectedEPSId] = useState("");
    const [epsReports, setEpsReports] = useState<EPSReport[]>([]);
    const [totales, setTotales] = useState<any>(null);
    const [selectedEPS, setSelectedEPS] = useState<EPSDetail | null>(null);

    useEffect(() => {
        // Fechas por defecto: mes actual
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(lastDay.toISOString().split('T')[0]);

        // Cargar lista de EPS
        loadEPSList();
    }, []);

    const loadEPSList = async () => {
        try {
            const response = await fetch('/api/eps/list');
            if (response.ok) {
                const data = await response.json();
                setEpsList(data.eps || []);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const loadReport = async () => {
        if (!startDate || !endDate) return;
        setLoading(true);
        setSelectedEPS(null);
        try {
            // Si se seleccionó una EPS específica, cargar su detalle directamente
            if (selectedEPSId) {
                const response = await fetch(`/api/reports/eps?epsId=${selectedEPSId}&startDate=${startDate}&endDate=${endDate}`);
                if (response.ok) {
                    const data = await response.json();
                    setSelectedEPS(data);
                    setEpsReports([]);
                    setTotales(null);
                }
            } else {
                // Si no, cargar resumen general
                const response = await fetch(`/api/reports/eps?startDate=${startDate}&endDate=${endDate}`);
                if (response.ok) {
                    const data = await response.json();
                    setEpsReports(data.epsReports || []);
                    setTotales(data.totales);
                }
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadEPSDetail = async (epsId: string) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/reports/eps?epsId=${epsId}&startDate=${startDate}&endDate=${endDate}`);
            if (response.ok) {
                const data = await response.json();
                setSelectedEPS(data);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportReportPDF = () => {
        const headers = ['EPS', 'Entregas', 'Items', 'Unidades', 'Pacientes', 'Valor Total'];
        const data = epsReports.map(r => [
            r.epsName,
            r.totalEntregas.toString(),
            r.totalItems.toString(),
            r.totalUnidades.toString(),
            r.pacientesUnicos.toString(),
            `$${r.valorTotal.toLocaleString()}`
        ]);

        exportToPDF({
            title: 'Reporte por EPS',
            subtitle: `Periodo: ${startDate} - ${endDate}`,
            headers,
            data,
            filename: 'reporte_eps',
            orientation: 'landscape'
        });
    };

    const exportEPSDetailPDF = () => {
        if (!selectedEPS) return;

        const headers = ['Fecha', 'Paciente', 'Documento', 'Bodega', 'Items', 'Unidades', 'Valor'];
        const data = selectedEPS.detalleEntregas.map((e: any) => [
            new Date(e.fecha).toLocaleDateString('es-CO'),
            e.paciente || '',
            e.documento || '',
            e.bodega || '',
            e.items.toString(),
            e.unidades.toString(),
            `$${e.valor.toLocaleString()}`
        ]);

        exportToPDF({
            title: `Reporte ${selectedEPS.eps.name}`,
            subtitle: `Periodo: ${startDate} - ${endDate} | Entregas: ${selectedEPS.estadisticas.totalEntregas} | Valor: $${selectedEPS.estadisticas.valorTotal.toLocaleString()}`,
            headers,
            data,
            filename: `reporte_${selectedEPS.eps.code}`,
            orientation: 'landscape'
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Building2 className="h-6 w-6" />
                        Reportes por EPS
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Estadísticas de entregas y valores por cada EPS
                    </p>
                </div>
                {selectedEPS && (
                    <Button variant="outline" onClick={() => setSelectedEPS(null)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Volver al resumen
                    </Button>
                )}
            </div>

            {/* Filtros */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex gap-4 items-end">
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
                        <div>
                            <Label className="text-xs">EPS</Label>
                            <select
                                value={selectedEPSId}
                                onChange={(e) => setSelectedEPSId(e.target.value)}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[200px]"
                            >
                                <option value="">Todas las EPS</option>
                                {epsList.map(eps => (
                                    <option key={eps.id} value={eps.id}>{eps.name}</option>
                                ))}
                            </select>
                        </div>
                        <Button onClick={loadReport} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            <span className="ml-2">Generar Reporte</span>
                        </Button>
                        {epsReports.length > 0 && !selectedEPS && (
                            <Button variant="outline" onClick={exportReportPDF}>
                                <FileText className="h-4 w-4 mr-2" />
                                PDF Resumen
                            </Button>
                        )}
                        {selectedEPS && (
                            <Button variant="outline" onClick={exportEPSDetailPDF}>
                                <FileText className="h-4 w-4 mr-2" />
                                PDF {selectedEPS.eps.name}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {loading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            )}

            {/* Vista de Detalle de EPS */}
            {selectedEPS && !loading && (
                <div className="space-y-6">
                    {/* Header EPS */}
                    <Card className="bg-gradient-to-r from-blue-50 to-emerald-50 dark:from-blue-900/20 dark:to-emerald-900/20">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                                    <Building2 className="h-7 w-7 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">{selectedEPS.eps.name}</h2>
                                    <p className="text-gray-500">Código: {selectedEPS.eps.code}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-4 text-center">
                                <p className="text-xs text-gray-500">Entregas</p>
                                <p className="text-2xl font-bold">{selectedEPS.estadisticas.totalEntregas}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4 text-center">
                                <p className="text-xs text-gray-500">Pacientes</p>
                                <p className="text-2xl font-bold">{selectedEPS.estadisticas.pacientesUnicos}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4 text-center">
                                <p className="text-xs text-gray-500">Unidades</p>
                                <p className="text-2xl font-bold">{selectedEPS.estadisticas.totalUnidades.toLocaleString()}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-emerald-50 dark:bg-emerald-900/20">
                            <CardContent className="pt-4 text-center">
                                <p className="text-xs text-gray-500">Valor Total</p>
                                <p className="text-2xl font-bold text-emerald-600">
                                    ${selectedEPS.estadisticas.valorTotal.toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Top Productos */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    Top 10 Productos
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {selectedEPS.topProductos.map((p, i) => (
                                        <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                            <div className="flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                                    {i + 1}
                                                </span>
                                                <div>
                                                    <p className="text-sm font-medium">{p.name}</p>
                                                    <p className="text-xs text-gray-500">{p.code}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-medium">{p.cantidad} uds</p>
                                                <p className="text-xs text-gray-500">${p.valor.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Top Pacientes */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Top 10 Pacientes
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {selectedEPS.topPacientes.map((p, i) => (
                                        <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                            <div className="flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">
                                                    {i + 1}
                                                </span>
                                                <div>
                                                    <p className="text-sm font-medium">{p.name}</p>
                                                    <p className="text-xs text-gray-500">{p.documentNumber}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-medium">{p.entregas} entregas</p>
                                                <p className="text-xs text-gray-500">${p.valor.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detalle Entregas */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Detalle de Entregas</CardTitle>
                            <CardDescription>Últimas 100 entregas del periodo</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gray-50 dark:bg-gray-800">
                                            <TableHead className="text-xs">Fecha</TableHead>
                                            <TableHead className="text-xs">Paciente</TableHead>
                                            <TableHead className="text-xs">Documento</TableHead>
                                            <TableHead className="text-xs">Bodega</TableHead>
                                            <TableHead className="text-xs text-right">Items</TableHead>
                                            <TableHead className="text-xs text-right">Unidades</TableHead>
                                            <TableHead className="text-xs text-right">Valor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedEPS.detalleEntregas.map(e => (
                                            <TableRow key={e.id}>
                                                <TableCell className="text-xs">
                                                    {new Date(e.fecha).toLocaleDateString('es-CO')}
                                                </TableCell>
                                                <TableCell className="text-sm">{e.paciente}</TableCell>
                                                <TableCell className="font-mono text-xs">{e.documento}</TableCell>
                                                <TableCell className="text-xs">{e.bodega}</TableCell>
                                                <TableCell className="text-right">{e.items}</TableCell>
                                                <TableCell className="text-right">{e.unidades}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    ${e.valor.toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Vista Resumen */}
            {!selectedEPS && !loading && epsReports.length > 0 && (
                <>
                    {/* Totales */}
                    {totales && (
                        <div className="grid grid-cols-5 gap-4">
                            <Card>
                                <CardContent className="pt-4 text-center">
                                    <p className="text-xs text-gray-500">Total Entregas</p>
                                    <p className="text-2xl font-bold">{totales.entregas}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-4 text-center">
                                    <p className="text-xs text-gray-500">Total Items</p>
                                    <p className="text-2xl font-bold">{totales.items}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-4 text-center">
                                    <p className="text-xs text-gray-500">Total Unidades</p>
                                    <p className="text-2xl font-bold">{totales.unidades.toLocaleString()}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-4 text-center">
                                    <p className="text-xs text-gray-500">Pacientes Atendidos</p>
                                    <p className="text-2xl font-bold">{totales.pacientes}</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-emerald-50 dark:bg-emerald-900/20">
                                <CardContent className="pt-4 text-center">
                                    <DollarSign className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
                                    <p className="text-xs text-gray-500">Valor Total</p>
                                    <p className="text-xl font-bold text-emerald-600">
                                        ${totales.valor.toLocaleString()}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Tabla de EPS */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Resumen por EPS</CardTitle>
                            <CardDescription>Haz clic en una EPS para ver el detalle</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gray-50 dark:bg-gray-800">
                                            <TableHead className="text-xs">Código</TableHead>
                                            <TableHead className="text-xs">EPS</TableHead>
                                            <TableHead className="text-xs text-right">Entregas</TableHead>
                                            <TableHead className="text-xs text-right">Items</TableHead>
                                            <TableHead className="text-xs text-right">Unidades</TableHead>
                                            <TableHead className="text-xs text-right">Pacientes</TableHead>
                                            <TableHead className="text-xs text-right">Valor Total</TableHead>
                                            <TableHead className="text-xs text-center">Acción</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {epsReports.map(eps => (
                                            <TableRow key={eps.epsId} className="cursor-pointer hover:bg-gray-50">
                                                <TableCell className="font-mono text-xs">{eps.epsCode}</TableCell>
                                                <TableCell className="font-medium">{eps.epsName}</TableCell>
                                                <TableCell className="text-right">{eps.totalEntregas}</TableCell>
                                                <TableCell className="text-right">{eps.totalItems}</TableCell>
                                                <TableCell className="text-right">{eps.totalUnidades.toLocaleString()}</TableCell>
                                                <TableCell className="text-right">{eps.pacientesUnicos}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    ${eps.valorTotal.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button size="sm" variant="ghost" onClick={() => loadEPSDetail(eps.epsId)}>
                                                        <TrendingUp className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {!loading && epsReports.length === 0 && !selectedEPS && (
                <Card>
                    <CardContent className="py-12 text-center text-gray-500">
                        <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Selecciona un periodo y haz clic en Generar Reporte</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
