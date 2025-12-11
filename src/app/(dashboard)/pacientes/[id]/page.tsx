"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation"; // Correcto hook
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Calendar, FileText, Pill, AlertCircle, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PatientDetail {
    id: string;
    name: string;
    documentType: string;
    documentNumber: string;
    phone: string;
    address: string;
    city: string;
    diagnosis: string;
    contracts: any[];
    prescriptions: any[];
}

interface DeliveryHistory {
    id: string;
    deliveryDate: string;
    status: string;
    warehouse: { name: string };
    items: { product: { name: string }; quantity: number }[];
}

interface PendingItem {
    id: string;
    quantity: number;
    status: string;
    createdAt: string;
    warehouse: { name: string; id: string };
    prescriptionItem: {
        product: { id: string; name: string; code: string };
        prescription: { prescriptionNumber: string; prescriptionDate: string };
    };
}

export default function DetallePacientePage() {
    // useParams devuelve { id: string } directamente en client components
    const params = useParams();
    const id = params?.id as string;

    const [patient, setPatient] = useState<PatientDetail | null>(null);
    const [deliveries, setDeliveries] = useState<DeliveryHistory[]>([]);
    const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    const fetchData = async () => {
        try {
            const res = await fetch(`/api/patients/${id}`);
            if (res.ok) {
                const data = await res.json();
                setPatient(data.patient);
                setDeliveries(data.deliveries);
                setPendingItems(data.pendingItems);
            }
        } catch (error) {
            console.error("Error", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl font-semibold">Paciente no encontrado</h2>
                <Button asChild className="mt-4">
                    <Link href="/pacientes">Volver al Directorio</Link>
                </Button>
            </div>
        );
    }

    const activeContract = patient.contracts.find((c: any) => c.isActive);

    return (
        <div className="space-y-6">
            <Link href="/pacientes" className="flex items-center text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors w-fit">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver al Directorio
            </Link>

            {/* Encabezado Paciente */}
            <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-3xl font-bold text-blue-600 dark:text-blue-400 shrink-0">
                    {patient.name.charAt(0)}
                </div>
                <div className="flex-1 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <h1 className="text-3xl font-bold tracking-tight">{patient.name}</h1>
                        <Badge variant={activeContract ? "default" : "destructive"} className={activeContract ? "bg-emerald-600" : ""}>
                            {activeContract ? "Activo" : "Inactivo"}
                        </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{patient.documentType}:</span>
                            {patient.documentNumber}
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">EPS:</span>
                            {activeContract?.eps.name || "Sin contrato"}
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">Tel:</span>
                            {patient.phone || "No registrado"}
                        </div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="history" className="w-full">
                <TabsList>
                    <TabsTrigger value="history">Historial Clínico</TabsTrigger>
                    <TabsTrigger value="pending" className="relative">
                        Pendientes
                        {pendingItems.length > 0 && (
                            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">
                                {pendingItems.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="info">Información Personal</TabsTrigger>
                </TabsList>

                <TabsContent value="history" className="mt-6 space-y-6">
                    {/* Prescripciones y Entregas Mezcladas o Separadas? Timeline es mejor */}
                    {/* Mostraremos dos tarjetas: Últimas Entregas y Historial de Prescripciones */}

                    <div className="grid lg:grid-cols-2 gap-6">
                        {/* Dispensaciones Recientes */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Pill className="h-5 w-5 text-emerald-500" />
                                    Entregas Realizadas
                                </CardTitle>
                                <CardDescription>Historial de medicamentos dispensados</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {deliveries.length === 0 ? (
                                    <div className="text-center py-6 text-gray-500">No hay entregas registradas</div>
                                ) : (
                                    <div className="space-y-6">
                                        {deliveries.map((delivery) => (
                                            <div key={delivery.id} className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-800 last:border-0 pb-6 last:pb-0">
                                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-950" />
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <p className="font-semibold text-sm">
                                                            Punto: {delivery.warehouse.name}
                                                        </p>
                                                        <span className="text-xs text-gray-500">
                                                            {format(new Date(delivery.deliveryDate), "PPP", { locale: es })}
                                                        </span>
                                                    </div>
                                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md p-3 text-sm">
                                                        <ul className="space-y-1">
                                                            {delivery.items.map((item, i) => (
                                                                <li key={i} className="flex justify-between text-xs">
                                                                    <span>{item.product.name}</span>
                                                                    <span className="font-medium">x{item.quantity}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Prescripciones */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-blue-500" />
                                    Prescripciones (Fórmulas)
                                </CardTitle>
                                <CardDescription>Órdenes médicas registradas</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {patient.prescriptions.length === 0 ? (
                                    <div className="text-center py-6 text-gray-500">No hay fórmulas registradas</div>
                                ) : (
                                    <div className="space-y-4">
                                        {patient.prescriptions.map((script: any) => (
                                            <div key={script.id} className="border rounded-lg p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <div className="font-medium text-sm">Fórmula {script.prescriptionNumber}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {format(new Date(script.prescriptionDate), "PPP", { locale: es })}
                                                        </div>
                                                    </div>
                                                    <Badge variant={script.status === 'PENDING' ? 'outline' : 'secondary'}>
                                                        {script.status === 'PENDING' ? <Clock className="h-3 w-3 mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                                                        {script.status}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300">
                                                    {script.productsCount} items • Dr. {script.prescribingDoctor || 'N/A'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                </TabsContent>

                <TabsContent value="pending">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-amber-500" />
                                Medicamentos Pendientes por Entregar
                            </CardTitle>
                            <CardDescription>
                                Items que quedaron pendientes en dispensaciones anteriores.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {pendingItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                    <CheckCircle className="h-12 w-12 text-emerald-100 mb-3" />
                                    <p>No hay medicamentos pendientes para este paciente.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {pendingItems.map((item) => (
                                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/50 gap-4">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                                                    {item.prescriptionItem.product.name}
                                                </div>
                                                <div className="text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                                                    <span>Cant. Pendiente: <strong className="text-amber-600">{item.quantity}</strong></span>
                                                    <span>• Rx: {item.prescriptionItem.prescription.prescriptionNumber}</span>
                                                    <span>• Desde: {format(new Date(item.createdAt), "dd/MM/yyyy", { locale: es })}</span>
                                                    <span>• Bodega: {item.warehouse.name}</span>
                                                </div>
                                            </div>
                                            <Button
                                                asChild
                                                className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                                            >
                                                <Link
                                                    href={`/dispensacion?patientDoc=${patient?.documentNumber}&pendingProduct=${item.prescriptionItem.product.code}&pendingQty=${item.quantity}&pendingId=${item.id}&warehouseId=${item.warehouse.id}`}
                                                >
                                                    Dispensar Ahora
                                                </Link>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="info">
                    <Card>
                        <CardHeader>
                            <CardTitle>Datos Demográficos</CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4">
                            <div>
                                <h4 className="font-medium text-sm text-gray-500">Dirección</h4>
                                <p>{patient.address || 'No registrada'}</p>
                            </div>
                            <div>
                                <h4 className="font-medium text-sm text-gray-500">Ciudad</h4>
                                <p>{patient.city || 'No registrada'}</p>
                            </div>
                            <div>
                                <h4 className="font-medium text-sm text-gray-500">Diagnóstico Principal</h4>
                                <p>{patient.diagnosis || 'No registrado'}</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
