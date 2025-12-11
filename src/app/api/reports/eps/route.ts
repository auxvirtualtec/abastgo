import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * API para generar reportes por EPS
 * Incluye estadísticas de entregas, valores, pacientes y productos
 */

// GET - Reporte por EPS
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const epsId = searchParams.get('epsId')
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')
        const warehouseId = searchParams.get('warehouseId')

        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: 'startDate y endDate son requeridos' },
                { status: 400 }
            )
        }

        // Filtro base de fechas
        const dateFilter = {
            deliveryDate: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        }

        // Obtener lista de EPS activas
        const epsList = await prisma.ePS.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        })

        // Si se selecciona una EPS específica
        if (epsId) {
            const epsReport = await generateEPSReport(epsId, dateFilter, warehouseId)
            return NextResponse.json(epsReport)
        }

        // Generar resumen para todas las EPS
        const epsReports = await Promise.all(
            epsList.map(async (eps) => {
                const deliveries = await prisma.delivery.findMany({
                    where: {
                        ...dateFilter,
                        ...(warehouseId && { warehouseId }),
                        prescription: { epsId: eps.id }
                    },
                    include: {
                        items: {
                            include: { product: true }
                        },
                        prescription: {
                            include: { patient: true }
                        }
                    }
                })

                const totalEntregas = deliveries.length
                const totalItems = deliveries.reduce((sum, d) => sum + d.items.length, 0)
                const totalUnidades = deliveries.reduce((sum, d) =>
                    sum + d.items.reduce((s, i) => s + i.quantity, 0), 0
                )
                const valorTotal = deliveries.reduce((sum, d) =>
                    sum + d.items.reduce((s, i) => s + (i.quantity * Number(i.product?.price || 0)), 0), 0
                )
                const pacientesUnicos = new Set(deliveries.map(d => d.prescription?.patientId)).size

                return {
                    epsId: eps.id,
                    epsCode: eps.code,
                    epsName: eps.name,
                    totalEntregas,
                    totalItems,
                    totalUnidades,
                    valorTotal,
                    pacientesUnicos
                }
            })
        )

        // Totales globales
        const totales = {
            entregas: epsReports.reduce((s, r) => s + r.totalEntregas, 0),
            items: epsReports.reduce((s, r) => s + r.totalItems, 0),
            unidades: epsReports.reduce((s, r) => s + r.totalUnidades, 0),
            valor: epsReports.reduce((s, r) => s + r.valorTotal, 0),
            pacientes: epsReports.reduce((s, r) => s + r.pacientesUnicos, 0)
        }

        return NextResponse.json({
            periodoInicio: startDate,
            periodoFin: endDate,
            epsList,
            epsReports: epsReports.filter(r => r.totalEntregas > 0),
            totales
        })
    } catch (error) {
        console.error('Error generando reporte por EPS:', error)
        return NextResponse.json(
            { error: 'Error generando reporte', details: String(error) },
            { status: 500 }
        )
    }
}

// Generar reporte detallado para una EPS
async function generateEPSReport(
    epsId: string,
    dateFilter: any,
    warehouseId: string | null
) {
    // Info de la EPS
    const eps = await prisma.ePS.findUnique({ where: { id: epsId } })
    if (!eps) {
        return { error: 'EPS no encontrada' }
    }

    // Entregas del periodo
    const deliveries = await prisma.delivery.findMany({
        where: {
            ...dateFilter,
            ...(warehouseId && { warehouseId }),
            prescription: { epsId }
        },
        include: {
            items: {
                include: { product: true }
            },
            warehouse: true,
            prescription: {
                include: { patient: true }
            }
        },
        orderBy: { deliveryDate: 'desc' }
    })

    // Estadísticas generales
    const totalEntregas = deliveries.length
    const totalItems = deliveries.reduce((sum, d) => sum + d.items.length, 0)
    const totalUnidades = deliveries.reduce((sum, d) =>
        sum + d.items.reduce((s, i) => s + i.quantity, 0), 0
    )
    const valorTotal = deliveries.reduce((sum, d) =>
        sum + d.items.reduce((s, i) => s + (i.quantity * Number(i.product?.price || 0)), 0), 0
    )

    // Pacientes únicos
    const pacientesMap = new Map()
    deliveries.forEach(d => {
        const patient = d.prescription?.patient
        if (patient && !pacientesMap.has(patient.id)) {
            pacientesMap.set(patient.id, {
                id: patient.id,
                documentNumber: patient.documentNumber,
                name: patient.name,
                entregas: 0,
                valor: 0
            })
        }
        if (patient) {
            const p = pacientesMap.get(patient.id)
            p.entregas++
            p.valor += d.items.reduce((s, i) => s + (i.quantity * Number(i.product?.price || 0)), 0)
        }
    })

    // Productos más dispensados
    const productosMap = new Map()
    deliveries.forEach(d => {
        d.items.forEach(item => {
            const product = item.product
            if (product) {
                if (!productosMap.has(product.id)) {
                    productosMap.set(product.id, {
                        id: product.id,
                        code: product.code,
                        name: product.name,
                        cantidad: 0,
                        valor: 0,
                        entregas: 0
                    })
                }
                const p = productosMap.get(product.id)
                p.cantidad += item.quantity
                p.valor += item.quantity * Number(product.price || 0)
                p.entregas++
            }
        })
    })

    // Entregas por día
    const entregasPorDia: Record<string, { cantidad: number; valor: number }> = {}
    deliveries.forEach(d => {
        const fecha = new Date(d.deliveryDate).toISOString().split('T')[0]
        if (!entregasPorDia[fecha]) {
            entregasPorDia[fecha] = { cantidad: 0, valor: 0 }
        }
        entregasPorDia[fecha].cantidad++
        entregasPorDia[fecha].valor += d.items.reduce((s, i) => s + (i.quantity * Number(i.product?.price || 0)), 0)
    })

    // Top 10 productos
    const topProductos = Array.from(productosMap.values())
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10)

    // Top 10 pacientes
    const topPacientes = Array.from(pacientesMap.values())
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10)

    // Detalle de entregas (últimas 100)
    const detalleEntregas = deliveries.slice(0, 100).map(d => ({
        id: d.id,
        fecha: d.deliveryDate,
        paciente: d.prescription?.patient?.name,
        documento: d.prescription?.patient?.documentNumber,
        bodega: d.warehouse?.name,
        items: d.items.length,
        unidades: d.items.reduce((s, i) => s + i.quantity, 0),
        valor: d.items.reduce((s, i) => s + (i.quantity * Number(i.product?.price || 0)), 0)
    }))

    return {
        eps: {
            id: eps.id,
            code: eps.code,
            name: eps.name
        },
        estadisticas: {
            totalEntregas,
            totalItems,
            totalUnidades,
            valorTotal,
            pacientesUnicos: pacientesMap.size,
            productosUnicos: productosMap.size
        },
        topProductos,
        topPacientes,
        entregasPorDia: Object.entries(entregasPorDia)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([fecha, data]) => ({ fecha, ...data })),
        detalleEntregas
    }
}
