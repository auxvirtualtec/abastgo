import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * API para generar RIPS en formato JSON
 * Según Resolución 2275 de 2023 del Ministerio de Salud Colombia
 */

interface RIPSUsuario {
    tipoDocumentoIdentificacion: string
    numDocumentoIdentificacion: string
    tipoUsuario: string
    fechaNacimiento: string
    codSexo: string
    codPaisResidencia: string
    codMunicipioResidencia: string
    codZonaTerritorialResidencia: string
    incapacidad: string
    consecutivo: number
    codPaisOrigen: string
}

interface RIPSMedicamento {
    codPrestador: string
    fechaDispensAdmon: string
    codDiagnosticoPrincipal: string
    codDiagnosticoRelacionado: string
    tipoMedicamento: string
    codMedicamento: string
    nombreMedicamento: string
    formaFarmaceutica: string
    concentracionMedicamento: string
    unidadMedida: string
    numUnidades: number
    diasTratamiento: number
    tipoDocumentoIdentificacion: string
    numDocumentoIdentificacion: string
    vrUnitMedicamento: number
    vrServicio: number
    conceptoRecaudo: string
    valorPagoModerador: number
    numFEVPagoModerador: string
    consecutivo: number
    numAutorizacion?: string
}

// GET - Generar RIPS JSON para un rango de fechas
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')
        const warehouseId = searchParams.get('warehouseId')
        const preview = searchParams.get('preview') === 'true'

        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: 'startDate y endDate son requeridos' },
                { status: 400 }
            )
        }

        // Obtener entregas del periodo
        const deliveries = await prisma.delivery.findMany({
            where: {
                deliveryDate: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                },
                ...(warehouseId && { warehouseId })
            },
            include: {
                items: {
                    include: { product: true }
                },
                warehouse: true,
                prescription: {
                    include: {
                        patient: true,
                        eps: true
                    }
                }
            },
            orderBy: { deliveryDate: 'asc' }
        })

        if (deliveries.length === 0) {
            return NextResponse.json({
                error: 'No hay entregas en el periodo seleccionado',
                rips: null
            })
        }

        // Construir estructura RIPS JSON según Resolución 2275/2023
        const ripsJson = {
            numDocumentoIdObligado: process.env.PRESTADOR_NIT || '900000000',
            numFactura: `FAC-${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`,
            tipoNota: null,
            numNota: null,
            usuarios: getUsuariosUnicos(deliveries),
            medicamentos: getMedicamentos(deliveries)
        }

        const stats = {
            totalEntregas: deliveries.length,
            totalUsuarios: ripsJson.usuarios.length,
            totalMedicamentos: ripsJson.medicamentos.length,
            periodoInicio: startDate,
            periodoFin: endDate
        }

        if (preview) {
            return NextResponse.json({ preview: true, stats, rips: ripsJson })
        }

        const jsonString = JSON.stringify(ripsJson, null, 2)
        const filename = `RIPS_${startDate}_${endDate}.json`

        return new NextResponse(jsonString, {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        })
    } catch (error) {
        console.error('Error generando RIPS:', error)
        return NextResponse.json(
            { error: 'Error generando RIPS', details: String(error) },
            { status: 500 }
        )
    }
}

function getUsuariosUnicos(deliveries: any[]): RIPSUsuario[] {
    const usuariosMap = new Map<string, RIPSUsuario>()
    let consecutivo = 1

    for (const delivery of deliveries) {
        const patient = delivery.prescription?.patient
        if (!patient) continue

        const key = patient.documentNumber

        if (!usuariosMap.has(key)) {
            usuariosMap.set(key, {
                tipoDocumentoIdentificacion: patient.documentType || 'CC',
                numDocumentoIdentificacion: patient.documentNumber,
                tipoUsuario: '01',
                fechaNacimiento: '1990-01-01',
                codSexo: '03',
                codPaisResidencia: '170',
                codMunicipioResidencia: '11001',
                codZonaTerritorialResidencia: '01',
                incapacidad: 'NO',
                consecutivo: consecutivo++,
                codPaisOrigen: '170'
            })
        }
    }

    return Array.from(usuariosMap.values())
}

function getMedicamentos(deliveries: any[]): RIPSMedicamento[] {
    const medicamentos: RIPSMedicamento[] = []
    let consecutivo = 1

    for (const delivery of deliveries) {
        const patient = delivery.prescription?.patient
        if (!patient) continue

        for (const item of delivery.items) {
            medicamentos.push({
                codPrestador: process.env.PRESTADOR_CODIGO || '440010001',
                fechaDispensAdmon: new Date(delivery.deliveryDate).toISOString().split('T')[0],
                codDiagnosticoPrincipal: 'Z000',
                codDiagnosticoRelacionado: '',
                tipoMedicamento: '01',
                codMedicamento: item.product?.code || '',
                nombreMedicamento: item.product?.name || '',
                formaFarmaceutica: '99',
                concentracionMedicamento: item.product?.concentration || '',
                unidadMedida: item.product?.unit || 'UNIDAD',
                numUnidades: item.quantity,
                diasTratamiento: 30,
                tipoDocumentoIdentificacion: patient.documentType || 'CC',
                numDocumentoIdentificacion: patient.documentNumber,
                vrUnitMedicamento: Number(item.unitCost || 0),
                vrServicio: item.quantity * Number(item.unitCost || 0),
                conceptoRecaudo: '05',
                valorPagoModerador: Number(delivery.moderatorFee || 0),
                numFEVPagoModerador: '',
                consecutivo: consecutivo++,
                numAutorizacion: ''
            })
        }
    }

    return medicamentos
}
