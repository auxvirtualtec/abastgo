"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    ShoppingCart,
    FileText,
    Truck,
    TrendingUp,
    Plus,
    Loader2,
    Star,
    Building2,
    Calendar,
    ChevronRight,
} from "lucide-react";

interface QuoteRequest {
    id: string;
    requestNumber: string;
    status: string;
    createdAt: string;
    dueDate?: string;
    items: any[];
    quotes: any[];
}

interface SupplierRecommendation {
    supplier: {
        id: string;
        name: string;
        code: string;
        email?: string;
        phone?: string;
    };
    scoring: {
        overallScore: number;
        priceScore: number;
        deliveryScore: number;
        qualityScore: number;
    } | null;
    recommendation: string;
    pros: string[];
    cons: string[];
}

interface Stats {
    totalQuoteRequests: number;
    pendingQuotes: number;
    completedQuotes: number;
    totalSuppliers: number;
}

export default function ComprasPage() {
    const [loading, setLoading] = useState(true);
    const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
    const [recommendations, setRecommendations] = useState<SupplierRecommendation[]>([]);
    const [invimaDrugSearch, setInvimaDrugSearch] = useState("");
    const [invimaDrugs, setInvimaDrugs] = useState<any[]>([]);
    const [searchingDrugs, setSearchingDrugs] = useState(false);
    const [stats, setStats] = useState<Stats>({
        totalQuoteRequests: 0,
        pendingQuotes: 0,
        completedQuotes: 0,
        totalSuppliers: 0,
    });

    useEffect(() => {
        loadData();
    }, []);

    // Autocompletar: buscar mientras el usuario escribe
    useEffect(() => {
        if (invimaDrugSearch.length < 2) {
            setInvimaDrugs([]);
            return;
        }

        const timer = setTimeout(() => {
            searchInvimaDrugs();
        }, 300); // Esperar 300ms después de que el usuario deje de escribir

        return () => clearTimeout(timer);
    }, [invimaDrugSearch]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Cargar cotizaciones y recomendaciones en paralelo
            const [quotesRes, recsRes] = await Promise.all([
                fetch('/api/quotes?limit=5'),
                fetch('/api/quotes/recommendations')
            ]);

            if (quotesRes.ok) {
                const data = await quotesRes.json();
                setQuoteRequests(data.data || []);

                // Calcular estadísticas
                const pending = data.data?.filter((q: QuoteRequest) =>
                    ['PENDING', 'SENT', 'PARTIAL'].includes(q.status)
                ).length || 0;
                const completed = data.data?.filter((q: QuoteRequest) =>
                    q.status === 'COMPLETED'
                ).length || 0;

                setStats(prev => ({
                    ...prev,
                    totalQuoteRequests: data.pagination?.total || 0,
                    pendingQuotes: pending,
                    completedQuotes: completed,
                }));
            }

            if (recsRes.ok) {
                const data = await recsRes.json();
                setRecommendations(data.data || []);
                setStats(prev => ({
                    ...prev,
                    totalSuppliers: data.data?.length || 0,
                }));
            }
        } catch (error) {
            console.error('Error cargando datos:', error);
        } finally {
            setLoading(false);
        }
    };

    const searchInvimaDrugs = async () => {
        if (invimaDrugSearch.length < 2) {
            return;
        }

        setSearchingDrugs(true);
        try {
            const res = await fetch(`/api/invima?q=${encodeURIComponent(invimaDrugSearch)}&limit=10`);
            const data = await res.json();

            if (res.ok && data.success) {
                setInvimaDrugs(data.data || []);
            } else {
                console.error('Error en respuesta:', data);
                setInvimaDrugs([]);
            }
        } catch (error) {
            console.error('Error buscando medicamentos:', error);
            setInvimaDrugs([]);
        } finally {
            setSearchingDrugs(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            SENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            PARTIAL: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
            COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
        };
        const labels: Record<string, string> = {
            PENDING: 'Pendiente',
            SENT: 'Enviada',
            PARTIAL: 'Parcial',
            COMPLETED: 'Completada',
            CANCELLED: 'Cancelada',
        };
        return <Badge className={styles[status] || styles.PENDING}>{labels[status] || status}</Badge>;
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-blue-600';
        if (score >= 40) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Módulo de Compras</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Gestiona cotizaciones, proveedores y órdenes de compra
                    </p>
                </div>
                <Button onClick={() => window.location.href = '/compras/nueva'}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Cotización
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <FileText className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Cotizaciones</p>
                                <p className="text-xl font-bold">{stats.totalQuoteRequests}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                                <ShoppingCart className="h-5 w-5 text-yellow-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Pendientes</p>
                                <p className="text-xl font-bold">{stats.pendingQuotes}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <TrendingUp className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Completadas</p>
                                <p className="text-xl font-bold">{stats.completedQuotes}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Proveedores</p>
                                <p className="text-xl font-bold">{stats.totalSuppliers}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Búsqueda rápida de medicamentos INVIMA */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Buscar Medicamentos INVIMA</CardTitle>
                    <CardDescription>
                        Busca en el catálogo de 159,840 medicamentos aprobados
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Nombre, principio activo o código ATC..."
                            value={invimaDrugSearch}
                            onChange={(e) => setInvimaDrugSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && searchInvimaDrugs()}
                            className="flex-1"
                        />
                        <Button onClick={searchInvimaDrugs} disabled={searchingDrugs}>
                            {searchingDrugs ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Search className="h-4 w-4" />
                            )}
                            <span className="ml-2">Buscar</span>
                        </Button>
                    </div>

                    {invimaDrugs.length > 0 && (
                        <div className="mt-4 border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                                        <TableHead className="text-xs">CUM</TableHead>
                                        <TableHead className="text-xs">Producto</TableHead>
                                        <TableHead className="text-xs">Principio Activo</TableHead>
                                        <TableHead className="text-xs">Forma</TableHead>
                                        <TableHead className="text-xs">Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invimaDrugs.map((drug) => (
                                        <TableRow key={drug.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <TableCell className="font-mono text-xs">{drug.cum}</TableCell>
                                            <TableCell className="text-sm font-medium">{drug.producto}</TableCell>
                                            <TableCell className="text-sm text-gray-600">{drug.principioActivo}</TableCell>
                                            <TableCell className="text-sm text-gray-600">{drug.formaFarmaceutica}</TableCell>
                                            <TableCell>
                                                <Badge variant={drug.estadoCum === 'Activo' ? 'default' : 'secondary'}>
                                                    {drug.estadoCum}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cotizaciones recientes */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Cotizaciones Recientes</CardTitle>
                            <Button variant="outline" size="sm" onClick={() => window.location.href = '/compras/cotizaciones'}>
                                Ver todas <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            </div>
                        ) : quoteRequests.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                <p>No hay cotizaciones</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {quoteRequests.map((quote) => (
                                    <div
                                        key={quote.id}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                                    >
                                        <div>
                                            <p className="font-medium">{quote.requestNumber}</p>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(quote.createdAt).toLocaleDateString('es-CO')}
                                                <span>•</span>
                                                <span>{quote.items?.length || 0} productos</span>
                                                <span>•</span>
                                                <span>{quote.quotes?.length || 0} cotizaciones</span>
                                            </div>
                                        </div>
                                        {getStatusBadge(quote.status)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Mejores proveedores */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Mejores Proveedores</CardTitle>
                            <Button variant="outline" size="sm" onClick={() => window.location.href = '/compras/proveedores'}>
                                Ver todos <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            </div>
                        ) : recommendations.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                <p>No hay proveedores registrados</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {recommendations.slice(0, 5).map((rec, index) => (
                                    <div
                                        key={rec.supplier.id}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${index === 0 ? 'bg-yellow-500' :
                                                index === 1 ? 'bg-gray-400' :
                                                    index === 2 ? 'bg-amber-600' :
                                                        'bg-gray-300'
                                                }`}>
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="font-medium">{rec.supplier.name}</p>
                                                <p className="text-xs text-gray-500">
                                                    {rec.pros.slice(0, 2).join(' • ') || 'Sin historial'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-lg font-bold ${getScoreColor(rec.scoring?.overallScore || 50)}`}>
                                                {rec.scoring?.overallScore || 50}
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                <Star className="h-3 w-3 text-yellow-500" />
                                                Score
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Enlaces rápidos */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                    variant="outline"
                    className="h-auto py-4 flex flex-col items-center gap-2"
                    onClick={() => window.location.href = '/compras/nueva'}
                >
                    <Plus className="h-6 w-6 text-blue-600" />
                    <span>Nueva Cotización</span>
                </Button>
                <Button
                    variant="outline"
                    className="h-auto py-4 flex flex-col items-center gap-2"
                    onClick={() => window.location.href = '/compras/cotizaciones'}
                >
                    <FileText className="h-6 w-6 text-purple-600" />
                    <span>Ver Cotizaciones</span>
                </Button>
                <Button
                    variant="outline"
                    className="h-auto py-4 flex flex-col items-center gap-2"
                    onClick={() => window.location.href = '/compras/proveedores'}
                >
                    <Building2 className="h-6 w-6 text-green-600" />
                    <span>Proveedores</span>
                </Button>
                <Button
                    variant="outline"
                    className="h-auto py-4 flex flex-col items-center gap-2"
                    onClick={() => window.location.href = '/entradas'}
                >
                    <Truck className="h-6 w-6 text-orange-600" />
                    <span>Recepción</span>
                </Button>
            </div>
        </div>
    );
}
