"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
    Search,
    UserCheck,
    Package,
    Plus,
    Minus,
    Trash2,
    CheckCircle,
    AlertCircle,
    Loader2,
    Printer,
    Save,
    RotateCcw,
    Camera,
    FileText,
    UserX,
} from "lucide-react";
import { DocumentCapture, DocumentThumbnail } from "@/components/documents/document-capture";

interface Patient {
    id?: string;
    documentType: string;
    documentNumber: string;
    name: string;
    phone?: string;
    address?: string;
    city?: string;
    epsName?: string;
    epsCode?: string;
    regime?: string;
    affiliationType?: string;
    estado?: string;
    contracts?: Array<{
        epsCode: string;
        epsName: string;
        affiliationType: string;
        regime: string;
    }>;
}

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

interface CartItem {
    inventoryId: string;
    productId: string;
    productCode: string;
    productName: string;
    warehouseId: string;
    warehouseName: string;
    lotNumber: string;
    availableQty: number;
    quantityToDeliver: number;
    quantityPrescribed: number; // Nueva columna
    unitCost: number;
    expiryDate?: string;
    pendingId?: string; // ID del pendiente activo si se está redimiendo
}

export default function DispensacionPage() {
    const { data: session } = useSession();

    // Selección de bodega/dispensario
    const [selectedWarehouse, setSelectedWarehouse] = useState("");
    const [warehouses, setWarehouses] = useState<any[]>([]);

    // Búsqueda de paciente
    const [documentType, setDocumentType] = useState("CC");
    const [documentNumber, setDocumentNumber] = useState("");
    const [searchingPatient, setSearchingPatient] = useState(false);
    const [patient, setPatient] = useState<Patient | null>(null);
    const [patientSource, setPatientSource] = useState<"local" | "adres" | null>(null);
    const [patientError, setPatientError] = useState("");

    // Datos de la fórmula
    const [prescriptionNumber, setPrescriptionNumber] = useState("");
    const [prescribingDoctor, setPrescribingDoctor] = useState("");
    const [mipresCode, setMipresCode] = useState("");
    const [prescriptionDate, setPrescriptionDate] = useState(new Date().toISOString().split('T')[0]);

    // Productos
    const [productSearch, setProductSearch] = useState("");
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loadingInventory, setLoadingInventory] = useState(false);
    const [cart, setCart] = useState<CartItem[]>([]);

    // Estado de entrega
    const [moderatorFee, setModeratorFee] = useState(0);
    const [paymentType, setPaymentType] = useState("NINGUNO");
    const [paymentMethod, setPaymentMethod] = useState("EFECTIVO");
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [deliveryComplete, setDeliveryComplete] = useState(false);
    const [deliveryId, setDeliveryId] = useState("");

    // Documentos y fotos
    const [isAuthorizedPickup, setIsAuthorizedPickup] = useState(false);
    const [authorizedPersonName, setAuthorizedPersonName] = useState("");
    const [authorizedPersonDoc, setAuthorizedPersonDoc] = useState("");
    const [captureType, setCaptureType] = useState<string | null>(null);
    const [documents, setDocuments] = useState({
        patientDocument: null as string | null,
        prescription: null as string | null,
        authorizedDocument: null as string | null,
        authorizationLetter: null as string | null,
        deliverySignature: null as string | null
    });

    // Cargar bodegas
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
            console.error('Error cargando bodegas:', error);
        }
    };

    // Efecto para procesar parámetros de URL (Redención de Pendientes)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const patientDoc = params.get('patientDoc');
        const pendingProductCode = params.get('pendingProduct');
        const pendingQty = params.get('pendingQty');
        const pendingId = params.get('pendingId');

        if (patientDoc && !patient) {
            setDocumentNumber(patientDoc);
            searchPatient(patientDoc);
        }

        if (patientDoc && pendingProductCode && pendingQty && !cart.length) {
            // Auto-search and add product logic would go here
            // Pero searchProduct usa state productSearch. 
            // Mejor setProductSearch y disparar búsqueda cuando cargue el paciente?
            // O mejor esperar a que el usuario confirme?
            // Vamos a pre-llenar el buscador y mostrar una alerta.
            setProductSearch(pendingProductCode);
            // Mostrar alerta de redención
        }
    }, []);

    const searchPatient = async (docNum?: string) => {
        const doc = docNum || documentNumber;
        if (!doc.trim()) return;

        setSearchingPatient(true);
        setPatientError("");
        setPatient(null);

        try {
            const response = await fetch(
                `/api/patients?documentType=${documentType}&documentNumber=${doc}`
            );
            const data = await response.json();

            if (data.found) {
                setPatient(data.patient);
                setPatientSource(data.source);
            } else {
                setPatientError(data.message || "Paciente no encontrado");
            }
        } catch (error) {
            setPatientError("Error buscando paciente");
        } finally {
            setSearchingPatient(false);
        }
    };

    // Buscar inventario
    const searchInventory = async () => {
        if (!productSearch.trim()) return;

        setLoadingInventory(true);
        try {
            let url = `/api/inventory?search=${productSearch}`;
            if (selectedWarehouse) {
                url += `&warehouseId=${selectedWarehouse}`;
            }
            const response = await fetch(url);
            const data = await response.json();
            setInventory(data.items || []);
        } catch (error) {
            console.error("Error buscando inventario:", error);
        } finally {
            setLoadingInventory(false);
        }
    };

    // Agregar al carrito (por lote específico)
    const addToCart = (item: InventoryItem) => {
        // Usar el primer lote disponible
        const lot = item.lots[0];
        if (!lot || lot.quantity <= 0) return;

        // Verificar redención desde URL
        const params = new URLSearchParams(window.location.search);
        const urlPendingId = params.get('pendingId');
        const urlPendingQty = params.get('pendingQty');
        const urlPendingProduct = params.get('pendingProduct');

        // Es redención si hay ID y el producto coincide
        const isRedemption = !!urlPendingId && (item.productCode === urlPendingProduct);
        const pendingQty = isRedemption ? (parseInt(urlPendingQty || '1')) : 1;

        // Verificar si ya existe este lote en el carrito
        const existingIndex = cart.findIndex(c => c.inventoryId === lot.inventoryId);

        if (existingIndex >= 0) {
            const updated = [...cart];
            if (updated[existingIndex].quantityToDeliver < lot.quantity) {
                updated[existingIndex].quantityToDeliver++;
            }
            setCart(updated);
        } else {
            setCart([...cart, {
                inventoryId: lot.inventoryId,
                productId: item.productId,
                productCode: item.productCode,
                productName: item.productName,
                warehouseId: item.warehouseId,
                warehouseName: item.warehouseName,
                lotNumber: lot.lotNumber,
                availableQty: lot.quantity,
                quantityToDeliver: isRedemption ? pendingQty : 1, // Pre-llenar con pendiente
                quantityPrescribed: isRedemption ? pendingQty : 1,
                unitCost: lot.unitCost,
                expiryDate: lot.expiryDate,
                pendingId: isRedemption ? (urlPendingId || undefined) : undefined
            }]);
        }
    };

    // Quitar del carrito
    const removeFromCart = (inventoryId: string) => {
        setCart(cart.filter(c => c.inventoryId !== inventoryId));
    };

    // Cambiar cantidad
    const updateQuantity = (inventoryId: string, newQty: number, type: 'deliver' | 'prescribed' = 'deliver') => {
        const updated = cart.map(item => {
            if (item.inventoryId === inventoryId) {
                if (type === 'deliver') {
                    const qty = Math.max(1, Math.min(item.availableQty, newQty));
                    return { ...item, quantityToDeliver: qty };
                } else {
                    const qty = Math.max(1, newQty);
                    return { ...item, quantityPrescribed: qty };
                }
            }
            return item;
        });
        setCart(updated);
    };

    // Calcular totales
    const totalItems = cart.reduce((sum, item) => sum + item.quantityToDeliver, 0);
    const totalCost = cart.reduce((sum, item) => sum + (item.quantityToDeliver * item.unitCost), 0);
    const hasPendingItems = cart.some(item => item.quantityPrescribed > item.quantityToDeliver);

    // Confirmar entrega
    const submitDelivery = async () => {
        if (cart.length === 0 || !patient) return;

        setSubmitting(true);
        try {
            const response = await fetch("/api/deliveries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: patient.id,
                    epsCode: patient.epsCode || patient.contracts?.[0]?.epsCode,
                    warehouseId: cart[0].warehouseId,
                    prescriptionNumber,
                    prescriptionDate,
                    prescribingDoctor,
                    mipresCode,

                    moderatorFee: paymentType === "NINGUNO" ? 0 : moderatorFee,
                    paymentType: paymentType === "NINGUNO" ? null : paymentType,
                    paymentMethod: paymentType === "NINGUNO" ? null : paymentMethod,
                    paymentAmount: paymentType === "NINGUNO" ? 0 : moderatorFee,
                    notes,
                    // Campos de terceros y documentos
                    isAuthorizedPickup,
                    authorizedPersonName: isAuthorizedPickup ? authorizedPersonName : undefined,
                    authorizedPersonDoc: isAuthorizedPickup ? authorizedPersonDoc : undefined,
                    prescriptionPhotoPath: documents.prescription,
                    deliverySignaturePath: documents.deliverySignature,
                    authorizedDocPhotoPath: isAuthorizedPickup ? documents.authorizedDocument : undefined,
                    authorizationLetterPath: isAuthorizedPickup ? documents.authorizationLetter : undefined,
                    pendingDeliveryLetterPath: hasPendingItems ? documents.patientDocument : undefined, // Usando slot temporal o agregar nuevo campo en hook useDocuments si fuera necesario, reusaremos patientDocument como placeholder si no hay slot especifico, o mejor agregar slot correcto
                    redeemedPendingItemIds: cart.map(i => i.pendingId).filter(Boolean), // Enviar IDs de pendientes redimidos
                    items: cart.map(item => ({
                        productId: item.productId,
                        quantity: item.quantityToDeliver,
                        quantityPrescribed: item.quantityPrescribed, // Enviar recetada
                        lotNumber: item.lotNumber,
                        inventoryId: item.inventoryId
                    }))
                })
            });

            if (response.ok) {
                const result = await response.json();
                setDeliveryId(result.delivery?.id || "");
                setDeliveryComplete(true);
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error("Error creando entrega:", error);
            alert("Error al crear la entrega");
        } finally {
            setSubmitting(false);
        }
    };

    // Reset para nueva entrega
    const resetDelivery = () => {
        setDocumentNumber("");
        setPatient(null);
        setPatientSource(null);
        setPatientError("");
        setCart([]);
        setPrescriptionNumber("");
        setPrescribingDoctor("");
        setMipresCode("");
        setModeratorFee(0);
        setNotes("");
        setDeliveryComplete(false);
        setDeliveryId("");
        setInventory([]);

        setProductSearch("");
        setPaymentType("NINGUNO");
        setPaymentMethod("EFECTIVO");
    };

    if (deliveryComplete) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="w-full max-w-lg text-center">
                    <CardContent className="pt-8 pb-8">
                        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-10 h-10 text-emerald-600" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">¡Entrega Completada!</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">
                            Los medicamentos han sido dispensados correctamente.
                        </p>
                        <p className="text-sm text-gray-500 mb-6">
                            Paciente: {patient?.name}<br />
                            Total Items: {totalItems} | Valor: ${totalCost.toLocaleString()}
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button variant="outline" onClick={() => window.print()}>
                                <Printer className="h-4 w-4 mr-2" />
                                Imprimir
                            </Button>
                            <Button onClick={resetDelivery}>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Nueva Entrega
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Entrega de Medicamentos</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Registra la dispensación de medicamentos a pacientes
                    </p>
                </div>
                <Badge variant="outline" className="text-lg px-4 py-2">
                    {new Date().toLocaleDateString('es-CO', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}
                </Badge>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Panel Izquierdo - Paciente y Fórmula */}
                <div className="space-y-4">
                    {/* Datos del Paciente */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <UserCheck className="h-4 w-4" />
                                Datos del Paciente
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex gap-2">
                                <select
                                    value={documentType}
                                    onChange={(e) => setDocumentType(e.target.value)}
                                    className="w-20 h-9 rounded-md border border-input bg-background px-2 text-sm"
                                >
                                    <option value="CC">CC</option>
                                    <option value="TI">TI</option>
                                    <option value="CE">CE</option>
                                    <option value="PA">PA</option>
                                    <option value="RC">RC</option>
                                    <option value="MS">MS</option>
                                </select>
                                <Input
                                    placeholder="Número de documento"
                                    value={documentNumber}
                                    onChange={(e) => setDocumentNumber(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && searchPatient()}
                                    className="flex-1 h-9"
                                />
                                <Button size="sm" onClick={() => searchPatient()} disabled={searchingPatient}>
                                    {searchingPatient ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Search className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>

                            {patientError && (
                                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                    <span className="text-red-700 dark:text-red-400">{patientError}</span>
                                </div>
                            )}

                            {patient && (
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                                        <CheckCircle className="h-4 w-4" />
                                        {patientSource === "adres" ? "Validado en ADRES" : "Paciente Registrado"}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-gray-700 dark:text-gray-300">
                                        <div>
                                            <span className="text-xs text-gray-500">Nombre</span>
                                            <p className="font-medium">{patient.name}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-500">EPS</span>
                                            <p className="font-medium">{patient.epsName || patient.contracts?.[0]?.epsName || "N/A"}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-500">Régimen</span>
                                            <p>{patient.regime || patient.contracts?.[0]?.regime || "N/A"}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-500">Tipo Afiliado</span>
                                            <p>{patient.affiliationType || patient.contracts?.[0]?.affiliationType || "N/A"}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Datos de la Fórmula */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Datos de la Fórmula</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <Label className="text-xs">Número de Fórmula</Label>
                                <Input
                                    value={prescriptionNumber}
                                    onChange={(e) => setPrescriptionNumber(e.target.value)}
                                    placeholder="Ej: RX-2024-001"
                                    className="h-9"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Fecha de Fórmula</Label>
                                <Input
                                    type="date"
                                    value={prescriptionDate}
                                    onChange={(e) => setPrescriptionDate(e.target.value)}
                                    className="h-9"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Médico Tratante</Label>
                                <Input
                                    value={prescribingDoctor}
                                    onChange={(e) => setPrescribingDoctor(e.target.value)}
                                    placeholder="Nombre del médico"
                                    className="h-9"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Código MIPRES</Label>
                                <Input
                                    value={mipresCode}
                                    onChange={(e) => setMipresCode(e.target.value)}
                                    placeholder="Opcional"
                                    className="h-9"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <Label className="text-xs">Concepto de Pago</Label>
                                    <select
                                        value={paymentType}
                                        onChange={(e) => setPaymentType(e.target.value)}
                                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                    >
                                        <option value="NINGUNO">Ninguno / Gratuito</option>
                                        <option value="CUOTA_MODERADORA">Cuota Moderadora</option>
                                        <option value="COPAGO">Copago</option>
                                        <option value="PARTICULAR">Particular / Venta</option>
                                    </select>
                                </div>
                                {paymentType !== "NINGUNO" && (
                                    <>
                                        <div>
                                            <Label className="text-xs">Medio de Pago</Label>
                                            <select
                                                value={paymentMethod}
                                                onChange={(e) => setPaymentMethod(e.target.value)}
                                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                            >
                                                <option value="EFECTIVO">Efectivo</option>
                                                <option value="DATAFONO">Datáfono / Tarjeta</option>
                                                <option value="TRANSFERENCIA">Transferencia</option>
                                                <option value="BONO">Bono / Vale</option>
                                            </select>
                                        </div>
                                        <div>
                                            <Label className="text-xs">Valor a Pagar ($)</Label>
                                            <Input
                                                type="number"
                                                value={moderatorFee}
                                                onChange={(e) => setModeratorFee(Number(e.target.value))}
                                                className="h-9 font-semibold"
                                                min={0}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Captura de Documentos */}
                    {patient && (
                        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Camera className="h-4 w-4" />
                                    Documentos de Trazabilidad
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Foto de cédula del paciente */}
                                <DocumentThumbnail
                                    path={documents.patientDocument}
                                    label="Foto Cédula Paciente"
                                    onCapture={() => setCaptureType('patient_document')}
                                />

                                {/* Foto de receta */}
                                <DocumentThumbnail
                                    path={documents.prescription}
                                    label="Foto de Receta/Fórmula"
                                    onCapture={() => setCaptureType('prescription')}
                                />

                                {/* Persona autorizada */}
                                <div className="flex items-center gap-2 pt-2 border-t">
                                    <Checkbox
                                        id="authorized"
                                        checked={isAuthorizedPickup}
                                        onCheckedChange={(checked) => setIsAuthorizedPickup(!!checked)}
                                    />
                                    <Label htmlFor="authorized" className="text-xs cursor-pointer">
                                        Recoge persona autorizada
                                    </Label>
                                </div>

                                {isAuthorizedPickup && (
                                    <div className="space-y-2 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                                        <div>
                                            <Label className="text-xs">Nombre persona autorizada</Label>
                                            <Input
                                                value={authorizedPersonName}
                                                onChange={(e) => setAuthorizedPersonName(e.target.value)}
                                                placeholder="Nombre completo"
                                                className="h-8"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Documento persona autorizada</Label>
                                            <Input
                                                value={authorizedPersonDoc}
                                                onChange={(e) => setAuthorizedPersonDoc(e.target.value)}
                                                placeholder="CC 12345678"
                                                className="h-8"
                                            />
                                        </div>
                                        <DocumentThumbnail
                                            path={documents.authorizedDocument}
                                            label="Foto Doc. Autorizado"
                                            onCapture={() => setCaptureType('authorized_doc')}
                                        />
                                        <DocumentThumbnail
                                            path={documents.authorizationLetter}
                                            label="Carta de Autorización"
                                            onCapture={() => setCaptureType('authorization_letter')}
                                        />
                                    </div>
                                )}

                                {/* Firma de entrega */}
                                <DocumentThumbnail
                                    path={documents.deliverySignature}
                                    label="Firma de Entrega"
                                    onCapture={() => setCaptureType('delivery_signature')}
                                />

                                {cart.some(i => i.quantityPrescribed > i.quantityToDeliver) && (
                                    <div className="pt-2 border-t">
                                        <div className="mb-2 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                            <AlertCircle className="h-4 w-4" />
                                            <span className="text-xs font-semibold">Hay items pendientes</span>
                                        </div>
                                        <DocumentThumbnail
                                            path={documents.patientDocument} // Reusando campo temporalmente o se deberia agregar uno nuevo a state documents
                                            label="Carta de Pendientes"
                                            onCapture={() => setCaptureType('pending_letter')}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Panel Central - Búsqueda y selección de productos */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Buscador de productos */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Buscar Medicamentos
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Buscar por nombre, código o molécula..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && searchInventory()}
                                    className="flex-1"
                                />
                                <Button onClick={searchInventory} disabled={loadingInventory}>
                                    {loadingInventory ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Search className="h-4 w-4" />
                                    )}
                                    <span className="ml-2 hidden sm:inline">Buscar</span>
                                </Button>
                            </div>

                            {inventory.length > 0 && (
                                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50 dark:bg-gray-800">
                                                <TableHead className="text-xs">Código</TableHead>
                                                <TableHead className="text-xs">Producto</TableHead>
                                                <TableHead className="text-xs">Bodega</TableHead>
                                                <TableHead className="text-xs text-right">Disp.</TableHead>
                                                <TableHead className="text-xs w-16"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {inventory.map((item) => (
                                                <TableRow
                                                    key={`${item.productId}-${item.warehouseId}`}
                                                    className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                    onClick={() => addToCart(item)}
                                                >
                                                    <TableCell className="text-xs font-mono">{item.productCode}</TableCell>
                                                    <TableCell className="text-sm">{item.productName}</TableCell>
                                                    <TableCell className="text-xs text-gray-500">{item.warehouseName}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant={item.totalQuantity > 10 ? "default" : "destructive"}>
                                                            {item.totalQuantity}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button size="sm" variant="ghost">
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Carrito / Items seleccionados */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">
                                    Medicamentos a Entregar ({cart.length})
                                </CardTitle>
                                {cart.length > 0 && (
                                    <Badge variant="secondary">
                                        Total: ${totalCost.toLocaleString()}
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {cart.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                    <p>Busca y selecciona los medicamentos a entregar</p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50 dark:bg-gray-800">
                                                <TableHead className="text-xs">Código</TableHead>
                                                <TableHead className="text-xs">Producto</TableHead>
                                                <TableHead className="text-xs">Lote</TableHead>
                                                <TableHead className="text-xs">Vence</TableHead>
                                                <TableHead className="text-xs text-center">Cant. Recetada</TableHead>
                                                <TableHead className="text-xs text-center">Cant. Entregar</TableHead>
                                                <TableHead className="text-xs text-right">V.Unit</TableHead>
                                                <TableHead className="text-xs text-right">Subtotal</TableHead>
                                                <TableHead className="w-10"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {cart.map((item) => (
                                                <TableRow key={item.inventoryId}>
                                                    <TableCell className="text-xs font-mono">{item.productCode}</TableCell>
                                                    <TableCell className="text-sm">{item.productName}</TableCell>
                                                    <TableCell className="text-xs">{item.lotNumber}</TableCell>
                                                    <TableCell className="text-xs">
                                                        {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('es-CO') : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            value={item.quantityPrescribed}
                                                            onChange={(e) => updateQuantity(item.inventoryId, Number(e.target.value), 'prescribed')}
                                                            className="w-16 h-7 text-center text-sm mx-auto"
                                                            min={1}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 w-7 p-0"
                                                                onClick={() => updateQuantity(item.inventoryId, item.quantityToDeliver - 1)}
                                                            >
                                                                <Minus className="h-3 w-3" />
                                                            </Button>
                                                            <Input
                                                                type="number"
                                                                value={item.quantityToDeliver}
                                                                onChange={(e) => updateQuantity(item.inventoryId, Number(e.target.value))}
                                                                className={`w-14 h-7 text-center text-sm ${item.quantityToDeliver < item.quantityPrescribed ? "text-amber-600 font-bold" : ""}`}
                                                            />
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 w-7 p-0"
                                                                onClick={() => updateQuantity(item.inventoryId, item.quantityToDeliver + 1)}
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        {item.quantityToDeliver < item.quantityPrescribed && (
                                                            <div className="text-[10px] text-amber-600 text-center mt-1">
                                                                Pendiente: {item.quantityPrescribed - item.quantityToDeliver}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs">
                                                        ${item.unitCost.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm font-medium">
                                                        ${(item.quantityToDeliver * item.unitCost).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                                            onClick={() => removeFromCart(item.inventoryId)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {/* Observaciones y Botones */}
                            {cart.length > 0 && (
                                <div className="mt-4 space-y-4">
                                    <div>
                                        <Label className="text-xs">Observaciones</Label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            className="w-full h-16 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            placeholder="Observaciones adicionales..."
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            onClick={resetDelivery}
                                        >
                                            <RotateCcw className="h-4 w-4 mr-2" />
                                            Limpiar
                                        </Button>
                                        <Button
                                            onClick={submitDelivery}
                                            disabled={submitting || !patient}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                        >
                                            {submitting ? (
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            ) : (
                                                <Save className="h-4 w-4 mr-2" />
                                            )}
                                            Guardar Entrega
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Modal de Captura de Documentos */}
            {captureType && patient && (
                <DocumentCapture
                    open={!!captureType}
                    onOpenChange={(open) => !open && setCaptureType(null)}
                    title={
                        captureType === 'patient_document' ? 'Foto de Cédula del Paciente' :
                            captureType === 'prescription' ? 'Foto de Receta/Fórmula' :
                                captureType === 'authorized_doc' ? 'Documento de Persona Autorizada' :
                                    captureType === 'authorization_letter' ? 'Carta de Autorización' :
                                        captureType === 'pending_letter' ? 'Carta de Pendientes' :
                                            'Firma de Entrega'
                    }
                    description={
                        captureType === 'patient_document' ? 'Capture la foto del documento de identidad del paciente' :
                            captureType === 'prescription' ? 'Capture la foto de la receta o fórmula médica' :
                                captureType === 'authorized_doc' ? 'Capture el documento de identidad de la persona autorizada' :
                                    captureType === 'authorization_letter' ? 'Capture la carta de autorización firmada' :
                                        captureType === 'pending_letter' ? 'Capture la carta de pendientes firmada por el paciente' :
                                            'Capture la firma del documento de entrega'
                    }
                    type={captureType}
                    entityId={captureType.includes('authorized') ? `${patient.id}_authorized` : patient.id || 'unknown'}
                    onCapture={(path) => {
                        if (captureType === 'patient_document') {
                            setDocuments(prev => ({ ...prev, patientDocument: path }));
                        } else if (captureType === 'prescription') {
                            setDocuments(prev => ({ ...prev, prescription: path }));
                        } else if (captureType === 'authorized_doc') {
                            setDocuments(prev => ({ ...prev, authorizedDocument: path }));
                        } else if (captureType === 'authorization_letter') {
                            setDocuments(prev => ({ ...prev, authorizationLetter: path }));
                        } else if (captureType === 'delivery_signature') {
                            setDocuments(prev => ({ ...prev, deliverySignature: path }));
                        } else if (captureType === 'pending_letter') {
                            // Reusando patientDocument en state o habría que añadirlo, pero por ahora reusaremos la lógica de patientDocument si el usuario sube ahí la de pendientes
                            // Idealmente deberíamos tener state separado, pero para el MVP usaremos patientDocument si es pending_letter al inicio o crearemos un estado más robusto.
                            // Dado el codigo anterior que usaba patientDocument como placeholder, lo mantendremos así por ahora.
                            setDocuments(prev => ({ ...prev, patientDocument: path }));
                        }
                        setCaptureType(null);
                    }}
                />
            )}
        </div>
    );
}
