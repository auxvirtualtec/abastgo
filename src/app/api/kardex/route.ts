import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET - Obtener kardex de movimientos
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const organizationId = session?.user?.organizationId

        if (!organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const productId = searchParams.get('productId')
        const warehouseId = searchParams.get('warehouseId')
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')

        const movements: any[] = []

        // Construir filtros de fecha
        const dateFilter: any = {}
        if (startDate) dateFilter.gte = new Date(startDate)
        if (endDate) dateFilter.lte = new Date(endDate)

        // 1. Entradas (Receipts)
        const receipts = await prisma.purchaseReceipt.findMany({
            where: {
                ...(warehouseId && { warehouseId }),
                ...(Object.keys(dateFilter).length && { receiptDate: dateFilter }),
                warehouse: { organizationId } // Validar organización
            },
            include: {
                items: {
                    where: productId ? { inventory: { productId } } : undefined,
                    include: {
                        inventory: {
                            include: { product: true }
                        }
                    }
                },
                warehouse: true
            },
            orderBy: { receiptDate: 'desc' },
            take: 50
        })

        for (const receipt of receipts) {
            for (const item of receipt.items) {
                // Skip if filtered out by partial match (though where clause above should handle it)
                if (!item.inventory) continue

                movements.push({
                    id: item.id,
                    date: receipt.receiptDate,
                    type: 'ENTRADA',
                    reference: receipt.invoiceNumber || 'SIN-REF',
                    description: `Entrada: ${receipt.notes || 'Sin notas'}`,
                    productCode: item.inventory.product.code,
                    productName: item.inventory.product.name,
                    warehouseName: receipt.warehouse.name,
                    lotNumber: item.inventory.lotNumber,
                    quantityIn: item.quantity,
                    quantityOut: 0,
                    unitCost: Number(item.inventory.unitCost),
                    warehouseId: receipt.warehouseId,
                    productId: item.inventory.productId
                })
            }
        }


        // 2. Salidas (Deliveries)
        const deliveries = await prisma.delivery.findMany({
            where: {
                ...(warehouseId && { warehouseId }),
                ...(Object.keys(dateFilter).length && { deliveryDate: dateFilter }),
                organizationId // Validar organización
            },
            include: {
                items: {
                    where: productId ? { productId } : undefined,
                    include: { product: true }
                },
                warehouse: true,
                prescription: { include: { patient: true } }
            },
            orderBy: { deliveryDate: 'desc' },
            take: 50
        })

        for (const delivery of deliveries) {
            for (const item of delivery.items) {
                movements.push({
                    id: item.id,
                    date: delivery.deliveryDate,
                    type: 'SALIDA',
                    reference: `DEL-${delivery.id.slice(0, 8)}`,
                    description: `Entrega: ${delivery.prescription?.patient?.name || 'Paciente'}`,
                    productCode: item.product.code,
                    productName: item.product.name,
                    warehouseName: delivery.warehouse.name,
                    lotNumber: item.lotNumber,
                    quantityIn: 0,
                    quantityOut: item.quantity,
                    unitCost: 0,
                    warehouseId: delivery.warehouseId,
                    productId: item.productId
                })
            }
        }

        // 3. Traslados
        const transfers = await prisma.transfer.findMany({
            where: {
                status: { in: ['IN_TRANSIT', 'RECEIVED'] },
                ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
                organizationId // Validar organización
            },
            include: {
                items: {
                    where: productId ? { productId } : undefined,
                    include: { product: true }
                },
                fromWarehouse: true,
                toWarehouse: true
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        })

        for (const transfer of transfers) {
            for (const item of transfer.items) {
                // Salida desde origen
                if (!warehouseId || warehouseId === transfer.fromWarehouseId) {
                    movements.push({
                        id: `${item.id}-out`,
                        date: transfer.createdAt,
                        type: 'TRASLADO_SALIDA',
                        reference: transfer.transferNumber,
                        description: `Traslado a ${transfer.toWarehouse.name}`,
                        productCode: item.product.code,
                        productName: item.product.name,
                        warehouseName: transfer.fromWarehouse.name,
                        lotNumber: item.lotNumber,
                        quantityIn: 0,
                        quantityOut: item.quantity,
                        unitCost: 0,
                        warehouseId: transfer.fromWarehouseId,
                        productId: item.productId
                    })
                }

                // Entrada en destino (solo si está recibido)
                if (transfer.status === 'RECEIVED' && (!warehouseId || warehouseId === transfer.toWarehouseId)) {
                    movements.push({
                        id: `${item.id}-in`,
                        date: transfer.receivedAt || transfer.createdAt,
                        type: 'TRASLADO_ENTRADA',
                        reference: transfer.transferNumber,
                        description: `Traslado desde ${transfer.fromWarehouse.name}`,
                        productCode: item.product.code,
                        productName: item.product.name,
                        warehouseName: transfer.toWarehouse.name,
                        lotNumber: item.lotNumber,
                        quantityIn: item.quantity,
                        quantityOut: 0,
                        unitCost: 0,
                        warehouseId: transfer.toWarehouseId,
                        productId: item.productId
                    })
                }
            }
        }

        // Ordenar por fecha descendente
        movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        // Calcular saldo acumulado
        let balance = 0
        const movementsWithBalance = [...movements].reverse().map(m => {
            balance += m.quantityIn - m.quantityOut
            return { ...m, balance }
        }).reverse()

        return NextResponse.json({
            movements: movementsWithBalance.slice(0, 100),
            totalMovements: movements.length
        })
    } catch (error) {
        console.error('Error obteniendo kardex:', error)
        return NextResponse.json(
            { error: 'Error obteniendo kardex', details: String(error) },
            { status: 500 }
        )
    }
}
