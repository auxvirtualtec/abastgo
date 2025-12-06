import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Listar traslados
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const fromWarehouseId = searchParams.get('fromWarehouseId')
        const toWarehouseId = searchParams.get('toWarehouseId')
        const limit = parseInt(searchParams.get('limit') || '50')

        const whereClause: any = {}

        if (status) whereClause.status = status
        if (fromWarehouseId) whereClause.fromWarehouseId = fromWarehouseId
        if (toWarehouseId) whereClause.toWarehouseId = toWarehouseId

        const transfers = await prisma.transfer.findMany({
            where: whereClause,
            include: {
                fromWarehouse: true,
                toWarehouse: true,
                createdBy: { select: { name: true, email: true } },
                items: {
                    include: { product: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: limit
        })

        return NextResponse.json({ transfers })
    } catch (error) {
        console.error('Error listando traslados:', error)
        return NextResponse.json(
            { error: 'Error listando traslados', details: String(error) },
            { status: 500 }
        )
    }
}

// POST - Crear nuevo traslado
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            fromWarehouseId,
            toWarehouseId,
            notes,
            items // Array de { productId, quantity, lotNumber, inventoryId }
        } = body

        if (!fromWarehouseId || !toWarehouseId || !items?.length) {
            return NextResponse.json(
                { error: 'fromWarehouseId, toWarehouseId e items son requeridos' },
                { status: 400 }
            )
        }

        if (fromWarehouseId === toWarehouseId) {
            return NextResponse.json(
                { error: 'Las bodegas de origen y destino deben ser diferentes' },
                { status: 400 }
            )
        }

        // Verificar inventario disponible
        for (const item of items) {
            const inventory = await prisma.inventory.findUnique({
                where: { id: item.inventoryId }
            })

            if (!inventory || inventory.quantity < item.quantity) {
                return NextResponse.json(
                    { error: `Inventario insuficiente para el item ${item.productId}` },
                    { status: 400 }
                )
            }
        }

        // Crear traslado
        const firstUser = await prisma.user.findFirst()
        const transferNumber = `TR-${Date.now()}`

        const transfer = await prisma.transfer.create({
            data: {
                transferNumber,
                fromWarehouseId,
                toWarehouseId,
                createdById: firstUser?.id || '',
                status: 'PENDING',
                notes,
                items: {
                    create: items.map((item: any) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        lotNumber: item.lotNumber
                    }))
                }
            },
            include: {
                fromWarehouse: true,
                toWarehouse: true,
                items: { include: { product: true } }
            }
        })

        return NextResponse.json({ success: true, transfer }, { status: 201 })
    } catch (error) {
        console.error('Error creando traslado:', error)
        return NextResponse.json(
            { error: 'Error creando traslado', details: String(error) },
            { status: 500 }
        )
    }
}

// PATCH - Actualizar estado del traslado
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json()
        const { transferId, action, notes } = body

        if (!transferId || !action) {
            return NextResponse.json(
                { error: 'transferId y action son requeridos' },
                { status: 400 }
            )
        }

        const transfer = await prisma.transfer.findUnique({
            where: { id: transferId },
            include: { items: true }
        })

        if (!transfer) {
            return NextResponse.json(
                { error: 'Traslado no encontrado' },
                { status: 404 }
            )
        }

        let newStatus: string
        const firstUser = await prisma.user.findFirst()

        switch (action) {
            case 'SEND': // Enviar (descontar de origen)
                if (transfer.status !== 'PENDING') {
                    return NextResponse.json(
                        { error: 'Solo se pueden enviar traslados pendientes' },
                        { status: 400 }
                    )
                }

                // Descontar inventario de la bodega origen
                for (const item of transfer.items) {
                    await prisma.inventory.updateMany({
                        where: {
                            productId: item.productId,
                            warehouseId: transfer.fromWarehouseId,
                            lotNumber: item.lotNumber || undefined
                        },
                        data: {
                            quantity: { decrement: item.quantity }
                        }
                    })
                }

                newStatus = 'IN_TRANSIT'
                break

            case 'RECEIVE': // Recibir (agregar a destino)
                if (transfer.status !== 'IN_TRANSIT') {
                    return NextResponse.json(
                        { error: 'Solo se pueden recibir traslados en tránsito' },
                        { status: 400 }
                    )
                }

                // Agregar inventario a la bodega destino
                for (const item of transfer.items) {
                    // Buscar si ya existe inventario con ese lote en destino
                    const existingInventory = await prisma.inventory.findFirst({
                        where: {
                            productId: item.productId,
                            warehouseId: transfer.toWarehouseId,
                            lotNumber: item.lotNumber || undefined
                        }
                    })

                    if (existingInventory) {
                        // Incrementar cantidad existente
                        await prisma.inventory.update({
                            where: { id: existingInventory.id },
                            data: { quantity: { increment: item.quantity } }
                        })
                    } else {
                        // Crear nuevo registro de inventario
                        await prisma.inventory.create({
                            data: {
                                productId: item.productId,
                                warehouseId: transfer.toWarehouseId,
                                lotNumber: item.lotNumber || `TR-${transfer.transferNumber}`,
                                quantity: item.quantity,
                                unitCost: 0 // TODO: calcular costo promedio
                            }
                        })
                    }
                }

                newStatus = 'RECEIVED'
                break

            case 'CANCEL':
                if (transfer.status === 'RECEIVED') {
                    return NextResponse.json(
                        { error: 'No se pueden cancelar traslados ya recibidos' },
                        { status: 400 }
                    )
                }

                // Si ya estaba en tránsito, devolver al origen
                if (transfer.status === 'IN_TRANSIT') {
                    for (const item of transfer.items) {
                        await prisma.inventory.updateMany({
                            where: {
                                productId: item.productId,
                                warehouseId: transfer.fromWarehouseId,
                                lotNumber: item.lotNumber || undefined
                            },
                            data: {
                                quantity: { increment: item.quantity }
                            }
                        })
                    }
                }

                newStatus = 'CANCELLED'
                break

            default:
                return NextResponse.json(
                    { error: 'Acción no válida. Use: SEND, RECEIVE, CANCEL' },
                    { status: 400 }
                )
        }

        const updatedTransfer = await prisma.transfer.update({
            where: { id: transferId },
            data: {
                status: newStatus as any,
                receivedById: action === 'RECEIVE' ? firstUser?.id : undefined,
                receivedAt: action === 'RECEIVE' ? new Date() : undefined,
                notes: notes ? `${transfer.notes || ''}\n${notes}` : transfer.notes
            },
            include: {
                fromWarehouse: true,
                toWarehouse: true,
                items: { include: { product: true } }
            }
        })

        return NextResponse.json({ success: true, transfer: updatedTransfer })
    } catch (error) {
        console.error('Error actualizando traslado:', error)
        return NextResponse.json(
            { error: 'Error actualizando traslado', details: String(error) },
            { status: 500 }
        )
    }
}
