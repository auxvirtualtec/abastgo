import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * API para generar Factura Proforma exportable a Siigo
 * Formato: CSV compatible con importación masiva de Siigo
 */

interface LineaSiigo {
    tipoComprobante: string
    consecutivo: number
    fechaElaboracion: string
    identificacionTercero: string
    nombreTercero: string
    sucursal: number
    codigoProducto: string
    descripcionProducto: string
    bodega: string
    cantidad: number
    valorUnitario: number
    valorDescuento: number
    valorBase: number
    porcentajeIVA: number
    valorIVA: number
    valorTotal: number
    centrosCosto: string
    observacion: string
}

// GET - Generar factura proforma
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')
        const warehouseId = searchParams.get('warehouseId')
        const epsId = searchParams.get('epsId')
        const format = searchParams.get('format') || 'csv'
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

        // Filtrar por EPS si se especifica
        const filteredDeliveries = epsId
            ? deliveries.filter(d => d.prescription?.epsId === epsId)
            : deliveries

        if (filteredDeliveries.length === 0) {
            return NextResponse.json({
                error: 'No hay entregas en el periodo seleccionado',
                lineas: null
            })
        }

        // Agrupar por EPS
        const facturasPorEPS = agruparPorEPS(filteredDeliveries)

        // Generar líneas para Siigo
        const lineasSiigo = generarLineasSiigo(facturasPorEPS, startDate)

        const stats = {
            totalEntregas: filteredDeliveries.length,
            totalEPS: Object.keys(facturasPorEPS).length,
            totalLineas: lineasSiigo.length,
            valorTotal: lineasSiigo.reduce((sum, l) => sum + l.valorTotal, 0),
            periodoInicio: startDate,
            periodoFin: endDate
        }

        if (preview) {
            return NextResponse.json({
                preview: true,
                stats,
                lineas: lineasSiigo.slice(0, 50),
                facturasPorEPS: Object.keys(facturasPorEPS).map(epsName => ({
                    eps: epsName,
                    entregas: facturasPorEPS[epsName].length,
                    items: facturasPorEPS[epsName].reduce((s: number, d: any) => s + d.items.length, 0)
                }))
            })
        }

        if (format === 'json') {
            return NextResponse.json({ stats, lineas: lineasSiigo })
        }

        const csvContent = generarCSVSiigo(lineasSiigo)
        const filename = `Factura_Siigo_${startDate}_${endDate}.csv`

        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        })
    } catch (error) {
        console.error('Error generando factura:', error)
        return NextResponse.json(
            { error: 'Error generando factura', details: String(error) },
            { status: 500 }
        )
    }
}

function agruparPorEPS(deliveries: any[]): Record<string, any[]> {
    const grupos: Record<string, any[]> = {}

    for (const delivery of deliveries) {
        const epsName = delivery.prescription?.eps?.name || 'SIN_EPS'
        if (!grupos[epsName]) grupos[epsName] = []
        grupos[epsName].push(delivery)
    }

    return grupos
}

function generarLineasSiigo(
    facturasPorEPS: Record<string, any[]>,
    startDate: string
): LineaSiigo[] {
    const lineas: LineaSiigo[] = []
    let consecutivoBase = parseInt(startDate.replace(/-/g, '').slice(-4))

    for (const [epsName, entregas] of Object.entries(facturasPorEPS)) {
        const eps = entregas[0]?.prescription?.eps
        const epsCode = eps?.code || '900000000'
        const consecutivo = consecutivoBase++

        for (const entrega of entregas) {
            for (const item of entrega.items) {
                const valorUnit = Number(item.unitCost || item.product?.price || 0)
                const valorBase = item.quantity * valorUnit

                lineas.push({
                    tipoComprobante: 'FV',
                    consecutivo,
                    fechaElaboracion: formatearFecha(entrega.deliveryDate),
                    identificacionTercero: epsCode,
                    nombreTercero: epsName,
                    sucursal: 1,
                    codigoProducto: item.product?.code || '',
                    descripcionProducto: item.product?.name || '',
                    bodega: entrega.warehouse?.code || 'PRINCIPAL',
                    cantidad: item.quantity,
                    valorUnitario: valorUnit,
                    valorDescuento: 0,
                    valorBase,
                    porcentajeIVA: 0,
                    valorIVA: 0,
                    valorTotal: valorBase,
                    centrosCosto: '',
                    observacion: `Entrega ${entrega.id.slice(0, 8)} - ${entrega.prescription?.patient?.name || ''}`
                })
            }
        }
    }

    return lineas
}

function generarCSVSiigo(lineas: LineaSiigo[]): string {
    const headers = [
        'Tipo Comprobante', 'Consecutivo', 'Fecha Elaboracion', 'Identificacion Tercero',
        'Nombre Tercero', 'Sucursal', 'Codigo Producto', 'Descripcion Producto', 'Bodega',
        'Cantidad', 'Valor Unitario', 'Valor Descuento', 'Valor Base', 'Porcentaje IVA',
        'Valor IVA', 'Valor Total', 'Centro Costo', 'Observacion'
    ]

    const rows = lineas.map(l => [
        l.tipoComprobante, l.consecutivo, l.fechaElaboracion, l.identificacionTercero,
        `"${l.nombreTercero}"`, l.sucursal, l.codigoProducto, `"${l.descripcionProducto}"`,
        l.bodega, l.cantidad, l.valorUnitario.toFixed(2), l.valorDescuento.toFixed(2),
        l.valorBase.toFixed(2), l.porcentajeIVA, l.valorIVA.toFixed(2), l.valorTotal.toFixed(2),
        l.centrosCosto, `"${l.observacion}"`
    ])

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
}

function formatearFecha(date: Date | string): string {
    const d = new Date(date)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
}
