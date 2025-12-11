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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    FileJson,
    FileSpreadsheet,
    Download,
    Loader2,
    Search,
    Building2,
    AlertCircle,
    CheckCircle2,
    Eye,
    Send,
    CloudUpload,
} from "lucide-react";

interface RIPSPreview {
    stats: {
        totalEntregas: number;
        totalUsuarios: number;
        totalMedicamentos: number;
        periodoInicio: string;
        periodoFin: string;
    };
    rips: any;
}

interface SiigoPreview {
    stats: {
        totalEntregas: number;
        totalEPS: number;
        totalLineas: number;
        valorTotal: number;
        periodoInicio: string;
        periodoFin: string;
    };
    lineas: any[];
    facturasPorEPS: { eps: string; entregas: number; items: number }[];
}

export default function FacturacionPage() {
    const [loading, setLoading] = useState(false);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [epsList, setEpsList] = useState<any[]>([]);

    // Filtros
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selectedWarehouse, setSelectedWarehouse] = useState("");
    const [selectedEPS, setSelectedEPS] = useState("");

    // Previews
    const [ripsPreview, setRipsPreview] = useState<RIPSPreview | null>(null);
    const [siigoPreview, setSiigoPreview] = useState<SiigoPreview | null>(null);
    const [error, setError] = useState("");

    // MUV
    const [muvConfigured, setMuvConfigured] = useState(false);
    const [muvResult, setMuvResult] = useState<any>(null);
    const [muvSending, setMuvSending] = useState(false);

    useEffect(() => {
        loadWarehouses();
        loadEPS();
        checkMUVStatus();
        // Establecer fechas por defecto (mes actual)
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(lastDay.toISOString().split('T')[0]);
    }, []);

    const checkMUVStatus = async () => {
        try {
            const response = await fetch('/api/muv?action=status');
            if (response.ok) {
                const data = await response.json();
                setMuvConfigured(data.configurado);
            }
        } catch (error) {
            console.error('Error:', error);
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
            console.error('Error:', error);
        }
    };

    const loadEPS = async () => {
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

    const previewRIPS = async () => {
        if (!startDate || !endDate) {
            setError('Selecciona las fechas del periodo');
            return;
        }
        setLoading(true);
        setError("");
        try {
            let url = `/api/rips?startDate=${startDate}&endDate=${endDate}&preview=true`;
            if (selectedWarehouse) url += `&warehouseId=${selectedWarehouse}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.error && !data.rips) {
                setError(data.error);
                setRipsPreview(null);
            } else {
                setRipsPreview(data);
            }
        } catch (error) {
            setError('Error cargando preview de RIPS');
        } finally {
            setLoading(false);
        }
    };

    const previewSiigo = async () => {
        if (!startDate || !endDate) {
            setError('Selecciona las fechas del periodo');
            return;
        }
        setLoading(true);
        setError("");
        try {
            let url = `/api/siigo?startDate=${startDate}&endDate=${endDate}&preview=true`;
            if (selectedWarehouse) url += `&warehouseId=${selectedWarehouse}`;
            if (selectedEPS) url += `&epsId=${selectedEPS}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.error && !data.lineas) {
                setError(data.error);
                setSiigoPreview(null);
            } else {
                setSiigoPreview(data);
            }
        } catch (error) {
            setError('Error cargando preview de Siigo');
        } finally {
            setLoading(false);
        }
    };

    const downloadRIPS = () => {
        let url = `/api/rips?startDate=${startDate}&endDate=${endDate}`;
        if (selectedWarehouse) url += `&warehouseId=${selectedWarehouse}`;
        window.open(url, '_blank');
    };

    const downloadSiigo = () => {
        let url = `/api/siigo?startDate=${startDate}&endDate=${endDate}&format=csv`;
        if (selectedWarehouse) url += `&warehouseId=${selectedWarehouse}`;
        if (selectedEPS) url += `&epsId=${selectedEPS}`;
        window.open(url, '_blank');
    };

    const enviarAlMUV = async () => {
        if (!ripsPreview?.rips) {
            setError('Primero genera el preview de RIPS');
            return;
        }
        setMuvSending(true);
        setMuvResult(null);
        try {
            const response = await fetch('/api/muv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ripsJson: ripsPreview.rips })
            });
            const data = await response.json();
            setMuvResult(data);
        } catch (error) {
            setMuvResult({ success: false, mensaje: 'Error de conexión' });
        } finally {
            setMuvSending(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <FileSpreadsheet className="h-6 w-6" />
                    Facturación
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Genera RIPS JSON y facturas proforma para Siigo
                </p>
            </div>

            {/* Filtros */}
            <Card>
                <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div>
                            <Label className="text-xs">Desde *</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Hasta *</Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="h-9"
                            />
                        </div>
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
                        <div>
                            <Label className="text-xs">EPS (solo Siigo)</Label>
                            <select
                                value={selectedEPS}
                                onChange={(e) => setSelectedEPS(e.target.value)}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="">Todas</option>
                                {epsList.map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={previewRIPS} disabled={loading} variant="outline" className="flex-1">
                                <Eye className="h-4 w-4 mr-1" />
                                RIPS
                            </Button>
                            <Button onClick={previewSiigo} disabled={loading} variant="outline" className="flex-1">
                                <Eye className="h-4 w-4 mr-1" />
                                Siigo
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
                    <CardContent className="pt-4 flex items-center gap-2 text-red-600">
                        <AlertCircle className="h-5 w-5" />
                        {error}
                    </CardContent>
                </Card>
            )}

            {loading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            )}

            {/* Tabs de resultados */}
            <Tabs defaultValue="rips" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="rips" className="flex items-center gap-2">
                        <FileJson className="h-4 w-4" />
                        RIPS JSON
                    </TabsTrigger>
                    <TabsTrigger value="siigo" className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Factura Siigo
                    </TabsTrigger>
                    <TabsTrigger value="muv" className="flex items-center gap-2">
                        <CloudUpload className="h-4 w-4" />
                        Enviar MUV
                    </TabsTrigger>
                </TabsList>

                {/* Tab RIPS */}
                <TabsContent value="rips" className="space-y-4">
                    {ripsPreview ? (
                        <>
                            {/* Stats RIPS */}
                            <div className="grid grid-cols-4 gap-4">
                                <Card>
                                    <CardContent className="pt-4 text-center">
                                        <p className="text-xs text-gray-500">Entregas</p>
                                        <p className="text-2xl font-bold">{ripsPreview.stats.totalEntregas}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-4 text-center">
                                        <p className="text-xs text-gray-500">Usuarios (Pacientes)</p>
                                        <p className="text-2xl font-bold">{ripsPreview.stats.totalUsuarios}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-4 text-center">
                                        <p className="text-xs text-gray-500">Medicamentos</p>
                                        <p className="text-2xl font-bold">{ripsPreview.stats.totalMedicamentos}</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-green-50 dark:bg-green-900/20">
                                    <CardContent className="pt-4 text-center">
                                        <CheckCircle2 className="h-6 w-6 mx-auto text-green-600 mb-1" />
                                        <p className="text-sm text-green-600">Listo para descargar</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Preview JSON */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">Preview RIPS JSON</CardTitle>
                                        <Button onClick={downloadRIPS} className="bg-blue-600 hover:bg-blue-700">
                                            <Download className="h-4 w-4 mr-2" />
                                            Descargar JSON
                                        </Button>
                                    </div>
                                    <CardDescription>
                                        Archivo compatible con Resolución 2275/2023 MinSalud
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-xs overflow-auto max-h-96">
                                        {JSON.stringify(ripsPreview.rips, null, 2)}
                                    </pre>
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <Card>
                            <CardContent className="py-12 text-center text-gray-500">
                                <FileJson className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p>Selecciona un periodo y haz clic en "RIPS" para previsualizar</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Tab Siigo */}
                <TabsContent value="siigo" className="space-y-4">
                    {siigoPreview ? (
                        <>
                            {/* Stats Siigo */}
                            <div className="grid grid-cols-5 gap-4">
                                <Card>
                                    <CardContent className="pt-4 text-center">
                                        <p className="text-xs text-gray-500">Entregas</p>
                                        <p className="text-2xl font-bold">{siigoPreview.stats.totalEntregas}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-4 text-center">
                                        <p className="text-xs text-gray-500">EPS</p>
                                        <p className="text-2xl font-bold">{siigoPreview.stats.totalEPS}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-4 text-center">
                                        <p className="text-xs text-gray-500">Líneas</p>
                                        <p className="text-2xl font-bold">{siigoPreview.stats.totalLineas}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-4 text-center">
                                        <p className="text-xs text-gray-500">Valor Total</p>
                                        <p className="text-xl font-bold">
                                            ${siigoPreview.stats.valorTotal.toLocaleString()}
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-green-50 dark:bg-green-900/20">
                                    <CardContent className="pt-4 text-center">
                                        <CheckCircle2 className="h-6 w-6 mx-auto text-green-600 mb-1" />
                                        <p className="text-sm text-green-600">Listo para descargar</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Facturas por EPS */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Facturas por EPS</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2">
                                        {siigoPreview.facturasPorEPS.map(f => (
                                            <Badge key={f.eps} variant="outline" className="py-2 px-4">
                                                <Building2 className="h-3 w-3 mr-2" />
                                                {f.eps}: {f.entregas} entregas, {f.items} items
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Preview Tabla */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">Preview Factura CSV</CardTitle>
                                        <Button onClick={downloadSiigo} className="bg-emerald-600 hover:bg-emerald-700">
                                            <Download className="h-4 w-4 mr-2" />
                                            Descargar CSV
                                        </Button>
                                    </div>
                                    <CardDescription>
                                        Formato compatible con importación masiva de Siigo
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="border rounded-lg overflow-auto max-h-96">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-gray-50 dark:bg-gray-800 text-xs">
                                                    <TableHead className="text-xs">Fecha</TableHead>
                                                    <TableHead className="text-xs">Tercero</TableHead>
                                                    <TableHead className="text-xs">Código</TableHead>
                                                    <TableHead className="text-xs">Producto</TableHead>
                                                    <TableHead className="text-xs text-right">Cant.</TableHead>
                                                    <TableHead className="text-xs text-right">V. Unit</TableHead>
                                                    <TableHead className="text-xs text-right">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {siigoPreview.lineas.map((l, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell className="text-xs">{l.fechaElaboracion}</TableCell>
                                                        <TableCell className="text-xs">{l.nombreTercero}</TableCell>
                                                        <TableCell className="font-mono text-xs">{l.codigoProducto}</TableCell>
                                                        <TableCell className="text-xs max-w-[200px] truncate">
                                                            {l.descripcionProducto}
                                                        </TableCell>
                                                        <TableCell className="text-right">{l.cantidad}</TableCell>
                                                        <TableCell className="text-right">
                                                            ${l.valorUnitario.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            ${l.valorTotal.toLocaleString()}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    {siigoPreview.stats.totalLineas > 50 && (
                                        <p className="text-xs text-gray-500 mt-2 text-center">
                                            Mostrando 50 de {siigoPreview.stats.totalLineas} líneas
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <Card>
                            <CardContent className="py-12 text-center text-gray-500">
                                <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p>Selecciona un periodo y haz clic en "Siigo" para previsualizar</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Tab MUV */}
                <TabsContent value="muv" className="space-y-4">
                    {/* Estado de configuración */}
                    <Card className={muvConfigured ? "border-green-200" : "border-amber-200 bg-amber-50 dark:bg-amber-900/20"}>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                {muvConfigured ? (
                                    <>
                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                        <div>
                                            <p className="font-medium text-green-600">MUV Configurado</p>
                                            <p className="text-sm text-gray-500">Listo para enviar RIPS al MinSalud</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="h-5 w-5 text-amber-600" />
                                        <div>
                                            <p className="font-medium text-amber-600">MUV No Configurado</p>
                                            <p className="text-sm text-gray-500">
                                                Configure las variables: MUV_API_URL, MUV_USERNAME, MUV_PASSWORD, PRESTADOR_NIT
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Info */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Mecanismo Único de Validación (MUV)</CardTitle>
                            <CardDescription>
                                Envía los RIPS JSON al MinSalud para obtener el Código Único de Validación (CUV)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm">
                                <p className="font-medium mb-2">Proceso de validación:</p>
                                <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400">
                                    <li>Genera el preview de RIPS (pestaña anterior)</li>
                                    <li>El sistema valida la estructura localmente</li>
                                    <li>Se envía al MUV del MinSalud</li>
                                    <li>Si es exitoso, se obtiene el CUV</li>
                                </ol>
                            </div>

                            {ripsPreview ? (
                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div>
                                        <p className="font-medium">RIPS Listos para enviar</p>
                                        <p className="text-sm text-gray-500">
                                            {ripsPreview.stats.totalUsuarios} usuarios, {ripsPreview.stats.totalMedicamentos} medicamentos
                                        </p>
                                    </div>
                                    <Button
                                        onClick={enviarAlMUV}
                                        disabled={muvSending || !muvConfigured}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        {muvSending ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <Send className="h-4 w-4 mr-2" />
                                        )}
                                        Enviar al MUV
                                    </Button>
                                </div>
                            ) : (
                                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center text-gray-500">
                                    <p>Primero genera el preview de RIPS en la pestaña anterior</p>
                                </div>
                            )}

                            {/* Resultado del envío */}
                            {muvResult && (
                                <Card className={muvResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                                    <CardContent className="pt-4">
                                        <div className="flex items-start gap-3">
                                            {muvResult.success ? (
                                                <CheckCircle2 className="h-6 w-6 text-green-600 mt-0.5" />
                                            ) : (
                                                <AlertCircle className="h-6 w-6 text-red-600 mt-0.5" />
                                            )}
                                            <div className="flex-1">
                                                <p className={`font-medium ${muvResult.success ? 'text-green-600' : 'text-red-600'}`}>
                                                    {muvResult.success ? 'Validación Exitosa' : 'Error en Validación'}
                                                </p>
                                                <p className="text-sm mt-1">{muvResult.mensaje}</p>
                                                {muvResult.cuv && (
                                                    <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded border">
                                                        <p className="text-xs text-gray-500">Código Único de Validación (CUV)</p>
                                                        <p className="font-mono text-lg font-bold">{muvResult.cuv}</p>
                                                    </div>
                                                )}
                                                {muvResult.errores && muvResult.errores.length > 0 && (
                                                    <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
                                                        {muvResult.errores.map((e: string, i: number) => (
                                                            <li key={i}>{e}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
