"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Card,
    CardContent,
    CardDescription,
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
} from "@/components/ui/dialog";
import {
    FileBarChart,
    Download,
    Loader2,
    FileSpreadsheet,
    Clock,
    Package,
    Pill,
    Calendar,
    Building2,
    Users,
    TrendingUp,
    AlertTriangle,
    ArrowRightLeft,
    DollarSign,
    BarChart3,
    Sparkles,
    Star,
    StarOff,
    Save,
    Trash2,
    Send,
    Lightbulb,
    History,
} from "lucide-react";

interface ReportConfig {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    category: string;
    href?: string;
}

interface SavedReport {
    id: string;
    name: string;
    description?: string;
    type: string;
    reportType?: string;
    query?: string;
    isFavorite: boolean;
}

const REPORTS: ReportConfig[] = [
    // Regulatorios
    { id: "1604", name: "Reporte 1604", description: "Dispensación Supersalud", icon: <FileBarChart className="h-5 w-5" />, category: "Regulatorios" },
    { id: "40", name: "Reporte 40", description: "Entregas detalladas", icon: <FileSpreadsheet className="h-5 w-5" />, category: "Regulatorios" },
    { id: "pendientes", name: "Pendientes", description: "Medicamentos sin entregar", icon: <Clock className="h-5 w-5" />, category: "Regulatorios" },

    // Cierres
    { id: "cierre_diario", name: "Cierre Diario", description: "Resumen diario por bodega", icon: <Calendar className="h-5 w-5" />, category: "Cierres" },
    { id: "arqueo_caja", name: "Arqueo de Caja", description: "Copagos y Cuotas por medio de pago", icon: <DollarSign className="h-5 w-5" />, category: "Cierres" },
    { id: "cierre_mensual", name: "Cierre Mensual", description: "Resumen mensual por bodega", icon: <BarChart3 className="h-5 w-5" />, category: "Cierres" },

    // Inventario
    { id: "inventario_valorizado", name: "Inventario Valorizado", description: "Stock con costos", icon: <DollarSign className="h-5 w-5" />, category: "Inventario" },
    { id: "vencimientos", name: "Vencimientos", description: "Próximos a vencer (90 días)", icon: <AlertTriangle className="h-5 w-5" />, category: "Inventario" },
    { id: "resumen_bodega", name: "Resumen Bodegas", description: "Estadísticas por bodega", icon: <Building2 className="h-5 w-5" />, category: "Inventario" },
    { id: "link_rotacion", name: "Rotación por Molécula", description: "Análisis de consumo promedio", icon: <BarChart3 className="h-5 w-5" />, category: "Inventario", href: "/reportes/rotacion" },

    // Operativos
    { id: "consumo_producto", name: "Consumo Productos", description: "Top productos dispensados", icon: <TrendingUp className="h-5 w-5" />, category: "Operativos" },
    { id: "entregas_paciente", name: "Entregas Paciente", description: "Historial por paciente", icon: <Users className="h-5 w-5" />, category: "Operativos" },
    { id: "traslados", name: "Traslados", description: "Movimientos entre bodegas", icon: <ArrowRightLeft className="h-5 w-5" />, category: "Operativos" },

    // Accesos Directos
    { id: "link_eps", name: "Reportes por EPS", description: "Estadísticas detalladas por EPS", icon: <Building2 className="h-5 w-5" />, category: "Módulos", href: "/reportes-eps" },
    { id: "link_facturacion", name: "Facturación y RIPS", description: "Generación de RIPS, MUV y Siigo", icon: <FileBarChart className="h-5 w-5" />, category: "Módulos", href: "/facturacion" },
    { id: "link_auditoria", name: "Auditoría", description: "Logs de movimientos del sistema", icon: <History className="h-5 w-5" />, category: "Módulos", href: "/auditoria" },
];

const CATEGORIES = ["Módulos", "Regulatorios", "Cierres", "Inventario", "Operativos"];

const AI_EXAMPLES = [
    "Entregas del mes de noviembre por bodega",
    "Productos más vendidos este año",
    "Pacientes atendidos en la última semana",
    "Stock bajo de medicamentos",
    "Productos próximos a vencer",
    "Resumen diario de entregas",
    "Inventario valorizado por bodega",
    "Traslados del último mes"
];

export default function ReportesPage() {
    const [selectedReport, setSelectedReport] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [previewData, setPreviewData] = useState<any>(null);

    // Filtros para inventario valorizado
    const [selectedWarehouse, setSelectedWarehouse] = useState("");
    const [selectedEps, setSelectedEps] = useState("");
    const [warehouses, setWarehouses] = useState<{ id: string, name: string, code: string, epsId?: string }[]>([]);
    const [epsList, setEpsList] = useState<{ id: string, name: string, code: string }[]>([]);

    // IA y Favoritos
    const [aiQuery, setAiQuery] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [saveName, setSaveName] = useState("");
    const [saveDescription, setSaveDescription] = useState("");

    useEffect(() => {
        loadSavedReports();
        loadWarehouses();
        loadEps();
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

    const loadSavedReports = async () => {
        try {
            const response = await fetch('/api/reports/favorites');
            if (response.ok) {
                const data = await response.json();
                setSavedReports(data.reports || []);
            }
        } catch (error) {
            console.error('Error cargando reportes guardados:', error);
        }
    };

    const generateReport = async (download: boolean = false) => {
        if (!selectedReport) return;

        setLoading(true);
        try {
            let url = `/api/reports?type=${selectedReport}`;
            if (startDate) url += `&startDate=${startDate}`;
            if (endDate) url += `&endDate=${endDate}`;
            if (selectedWarehouse) url += `&warehouseId=${selectedWarehouse}`;
            if (selectedEps) url += `&epsId=${selectedEps}`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();

                if (download) {
                    downloadCSV(data.headers, data.data, selectedReport);
                } else {
                    setPreviewData(data);
                }
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            alert('Error generando reporte');
        } finally {
            setLoading(false);
        }
    };

    const generateAIReport = async () => {
        if (!aiQuery.trim()) return;

        setAiLoading(true);
        setSelectedReport(null);
        try {
            const response = await fetch('/api/reports/custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: aiQuery,
                    startDate,
                    endDate
                })
            });

            const data = await response.json();

            if (response.ok) {
                setPreviewData({
                    ...data,
                    isCustom: true,
                    originalQuery: aiQuery
                });
            } else {
                alert(data.error || 'Error procesando consulta');
            }
        } catch (error) {
            alert('Error generando reporte personalizado');
        } finally {
            setAiLoading(false);
        }
    };

    const saveReport = async () => {
        if (!saveName.trim()) return;

        try {
            const response = await fetch('/api/reports/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: saveName,
                    description: saveDescription,
                    type: previewData?.isCustom ? 'custom' : 'favorite',
                    reportType: selectedReport,
                    query: previewData?.originalQuery || aiQuery,
                    sqlQuery: previewData?.sqlQuery,
                    filters: { startDate, endDate },
                    isFavorite: true
                })
            });

            if (response.ok) {
                setSaveDialogOpen(false);
                setSaveName("");
                setSaveDescription("");
                loadSavedReports();
            }
        } catch (error) {
            alert('Error guardando reporte');
        }
    };

    const deleteReport = async (id: string) => {
        if (!confirm('¿Eliminar este reporte guardado?')) return;

        try {
            await fetch(`/api/reports/favorites?id=${id}`, { method: 'DELETE' });
            loadSavedReports();
        } catch (error) {
            alert('Error eliminando reporte');
        }
    };

    const downloadCSV = (headers: string[], data: any[], filename: string) => {
        const csvRows = [
            headers.join(','),
            ...data.map(row =>
                headers.map(h => {
                    const value = row[h] ?? '';
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        URL.revokeObjectURL(url);
    };

    const getReportConfig = (id: string) => REPORTS.find(r => r.id === id);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileBarChart className="h-6 w-6" />
                        Centro de Reportes
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Reportes estándar, personalizados con IA y favoritos
                    </p>
                </div>
            </div>

            {/* Reporte Personalizado con IA */}
            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-200">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        Reporte Personalizado con IA
                    </CardTitle>
                    <CardDescription>
                        Describe qué información necesitas y la IA generará el reporte
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <Textarea
                            placeholder="Ejemplo: Muéstrame las entregas del mes de noviembre agrupadas por bodega..."
                            value={aiQuery}
                            onChange={(e) => setAiQuery(e.target.value)}
                            className="min-h-[80px] bg-white dark:bg-gray-900"
                        />

                        {/* Ejemplos */}
                        <div className="flex flex-wrap gap-2">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Lightbulb className="h-3 w-3" /> Ejemplos:
                            </span>
                            {AI_EXAMPLES.slice(0, 4).map(example => (
                                <Badge
                                    key={example}
                                    variant="secondary"
                                    className="cursor-pointer hover:bg-purple-100 text-xs"
                                    onClick={() => setAiQuery(example)}
                                >
                                    {example}
                                </Badge>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-4 items-end">
                            <div>
                                <Label className="text-xs">Fecha Inicio</Label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-36 bg-white dark:bg-gray-900"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Fecha Fin</Label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-36 bg-white dark:bg-gray-900"
                                />
                            </div>
                            <Button
                                onClick={generateAIReport}
                                disabled={aiLoading || !aiQuery.trim()}
                                className="bg-purple-600 hover:bg-purple-700"
                            >
                                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                Generar con IA
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Reportes Favoritos */}
            {savedReports.length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500" /> Mis Reportes Guardados
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {savedReports.slice(0, 8).map(report => (
                            <Card key={report.id} className="relative group">
                                <CardContent className="pt-4 pb-3 px-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-medium text-sm">{report.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{report.query || report.reportType}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                            onClick={() => deleteReport(report.id)}
                                        >
                                            <Trash2 className="h-3 w-3 text-red-500" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Reportes por categoría */}
            {CATEGORIES.map(category => (
                <div key={category}>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{category}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {REPORTS.filter(r => r.category === category).map(report => (
                            <Card
                                key={report.id}
                                className={`cursor-pointer transition-all hover:shadow-md ${selectedReport === report.id
                                    ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950'
                                    : ''
                                    }`}
                                onClick={() => {
                                    if (report.href) {
                                        window.location.href = report.href;
                                    } else {
                                        setSelectedReport(report.id);
                                        setPreviewData(null);
                                    }
                                }}
                            >
                                <CardContent className="pt-4 pb-3 px-4">
                                    <div className="flex items-center gap-3">
                                        <div className="text-blue-600">{report.icon}</div>
                                        <div>
                                            <p className="font-medium text-sm">{report.name}</p>
                                            <p className="text-xs text-gray-500">{report.description}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            ))}

            {/* Filtros y acciones para reporte seleccionado */}
            {selectedReport && (
                <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            {getReportConfig(selectedReport)?.icon}
                            {getReportConfig(selectedReport)?.name}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-4 items-end">
                            {/* Filtros de EPS y Bodega para reportes de inventario */}
                            {(selectedReport === 'inventario_valorizado' || selectedReport === 'vencimientos' || selectedReport === 'resumen_bodega') && (
                                <>
                                    <div>
                                        <Label className="text-xs">EPS</Label>
                                        <select
                                            value={selectedEps}
                                            onChange={(e) => {
                                                setSelectedEps(e.target.value);
                                                setSelectedWarehouse(""); // Reset bodega al cambiar EPS
                                            }}
                                            className="h-10 rounded-md border border-input bg-background px-3 min-w-[150px]"
                                        >
                                            <option value="">Todas las EPS</option>
                                            {epsList.map(eps => (
                                                <option key={eps.id} value={eps.id}>{eps.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-xs">Bodega</Label>
                                        <select
                                            value={selectedWarehouse}
                                            onChange={(e) => setSelectedWarehouse(e.target.value)}
                                            className="h-10 rounded-md border border-input bg-background px-3 min-w-[180px]"
                                        >
                                            <option value="">Todas las bodegas</option>
                                            {warehouses
                                                .filter(w => !selectedEps || w.epsId === selectedEps)
                                                .map(w => (
                                                    <option key={w.id} value={w.id}>{w.name}</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                </>
                            )}
                            <div>
                                <Label className="text-xs">Fecha Inicio</Label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-36"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Fecha Fin</Label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-36"
                                />
                            </div>
                            <Button variant="outline" onClick={() => generateReport(false)} disabled={loading}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                                Vista Previa
                            </Button>
                            <Button onClick={() => generateReport(true)} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
                                <Download className="h-4 w-4 mr-2" />
                                Descargar CSV
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Vista previa */}
            {previewData && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    {previewData.isCustom && <Sparkles className="h-4 w-4 text-purple-600" />}
                                    Resultados ({previewData.count?.toLocaleString() || 0} registros)
                                </CardTitle>
                                {previewData.originalQuery && (
                                    <CardDescription className="mt-1">
                                        "{previewData.originalQuery}"
                                    </CardDescription>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSaveDialogOpen(true)}
                                >
                                    <Star className="h-4 w-4 mr-1" />
                                    Guardar
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => downloadCSV(previewData.headers, previewData.data, previewData.type || 'reporte')}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <Download className="h-4 w-4 mr-1" />
                                    CSV
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {previewData.count === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p>No hay datos para el período seleccionado</p>
                            </div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gray-50 dark:bg-gray-800">
                                            {previewData.headers?.slice(0, 8).map((header: string) => (
                                                <TableHead key={header} className="text-xs whitespace-nowrap font-semibold">
                                                    {header}
                                                </TableHead>
                                            ))}
                                            {previewData.headers?.length > 8 && (
                                                <TableHead className="text-xs">+{previewData.headers.length - 8}</TableHead>
                                            )}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewData.data?.slice(0, 100).map((row: any, idx: number) => (
                                            <TableRow key={idx}>
                                                {previewData.headers?.slice(0, 8).map((header: string) => (
                                                    <TableCell key={header} className="text-xs whitespace-nowrap">
                                                        {typeof row[header] === 'number'
                                                            ? row[header].toLocaleString()
                                                            : String(row[header] ?? '').substring(0, 25)}
                                                        {String(row[header] ?? '').length > 25 && '...'}
                                                    </TableCell>
                                                ))}
                                                {previewData.headers?.length > 8 && (
                                                    <TableCell className="text-xs text-gray-400">...</TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Dialog para guardar reporte */}
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Star className="h-5 w-5 text-yellow-500" />
                            Guardar Reporte
                        </DialogTitle>
                        <DialogDescription>
                            Guarda este reporte en tus favoritos para acceder rápidamente
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <Label>Nombre del Reporte</Label>
                            <Input
                                value={saveName}
                                onChange={(e) => setSaveName(e.target.value)}
                                placeholder="Ej: Cierre semanal de Sincelejo"
                            />
                        </div>
                        <div>
                            <Label>Descripción (opcional)</Label>
                            <Textarea
                                value={saveDescription}
                                onChange={(e) => setSaveDescription(e.target.value)}
                                placeholder="Notas sobre este reporte..."
                                className="min-h-[60px]"
                            />
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setSaveDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button className="flex-1" onClick={saveReport} disabled={!saveName.trim()}>
                                <Save className="h-4 w-4 mr-2" />
                                Guardar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
