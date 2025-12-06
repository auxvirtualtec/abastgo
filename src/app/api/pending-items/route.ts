import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Listar items pendientes
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') || 'PENDING'
        const patientId = searchParams.get('patientId')
        const warehouseId = searchParams.get('warehouseId')
        const limit = parseInt(searchParams.get('limit') || '100')

        const whereClause: any = {}

        if (status && status !== 'ALL') {
            whereClause.status = status
        }
        if (patientId) whereClause.patientId = patientId
        if (warehouseId) whereClause.warehouseId = warehouseId

        const pendingItems = await prisma.pendingItem.findMany({
            where: whereClause,
            include: {
                patient: true,
                product: true,
                warehouse: true,
                prescription: true
            },
            orderBy: { createdAt: 'desc' },
            take: limit
        })

        // Estadísticas
        const stats = await prisma.pendingItem.groupBy({
            by: ['status'],
            _count: { id: true },
            _sum: { pendingQty: true }
        })

        return NextResponse.json({
            items: pendingItems,
            stats: stats.reduce((acc, s) => {
                acc[s.status] = { count: s._count.id, quantity: s._sum.pendingQty || 0 }
                return acc
            }, {} as Record<string, { count: number; quantity: number }>)
        })
    } catch (error) {
        console.error('Error listando pendientes:', error)
        return NextResponse.json(
            { error: 'Error listando pendientes', details: String(error) },
            { status: 500 }
        )
    }
}

// POST - Crear item pendiente (cuando no hay stock para entregar)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            patientId,
            productId,
            warehouseId,
            prescriptionId,
            pendingQty,
            reason,
            notes
        } = body

        if (!patientId || !productId || !pendingQty) {
            return NextResponse.json(
                { error: 'patientId, productId y pendingQty son requeridos' },
                { status: 400 }
            )
        }

        const pendingItem = await prisma.pendingItem.create({
            data: {
                patientId,
                productId,
                warehouseId,
                prescriptionId,
                pendingQty,
                reason: reason || 'SIN_STOCK',
                notes,
                status: 'PENDING'
            },
            include: {
                patient: true,
                product: true,
                warehouse: true
            }
        })

        return NextResponse.json({ success: true, pendingItem }, { status: 201 })
    } catch (error) {
        console.error('Error creando pendiente:', error)
        return NextResponse.json(
            { error: 'Error creando pendiente', details: String(error) },
            { status: 500 }
        )
    }
}

// PATCH - Actualizar estado de pendiente (entregar, cancelar, etc.)
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json()
        const { id, action, deliveredQty, notes, inventoryId } = body

        if (!id || !action) {
            return NextResponse.json(
                { error: 'id y action son requeridos' },
                { status: 400 }
            )
        }

        const pendingItem = await prisma.pendingItem.findUnique({
            where: { id },
            include: { product: true, patient: true }
        })

        if (!pendingItem) {
            return NextResponse.json(
                { error: 'Item pendiente no encontrado' },
                { status: 404 }
            )
        }

        let updateData: any = {}

        switch (action) {
            case 'DELIVER': // Entregar pendiente
                if (!deliveredQty || deliveredQty <= 0) {
                    return NextResponse.json(
                        { error: 'deliveredQty es requerido para entregar' },
                        { status: 400 }
                    )
                }

                // Verificar stock si se proporciona inventoryId
                if (inventoryId) {
                    const inventory = await prisma.inventory.findUnique({
                        where: { id: inventoryId }
                    })

                    if (!inventory || inventory.quantity < deliveredQty) {
                        return NextResponse.json(
                            { error: 'Stock insuficiente para entregar' },
                            { status: 400 }
                        )
                    }

                    // Descontar inventario
                    await prisma.inventory.update({
                        where: { id: inventoryId },
                        data: { quantity: { decrement: deliveredQty } }
                    })
                }

                const newPendingQty = pendingItem.pendingQty - deliveredQty
                updateData = {
                    pendingQty: Math.max(0, newPendingQty),
                    deliveredQty: (pendingItem.deliveredQty || 0) + deliveredQty,
                    status: newPendingQty <= 0 ? 'DELIVERED' : 'PARTIAL',
                    deliveredAt: newPendingQty <= 0 ? new Date() : undefined,
                    notes: notes ? `${pendingItem.notes || ''}\n${new Date().toISOString()}: ${notes}` : pendingItem.notes
                }
                break

            case 'CANCEL':
                updateData = {
                    status: 'CANCELLED',
                    notes: notes ? `${pendingItem.notes || ''}\nCANCELADO: ${notes}` : pendingItem.notes
                }
                break

            case 'NOTIFY': // Marcar como notificado al paciente
                updateData = {
                    status: 'NOTIFIED',
                    notes: notes ? `${pendingItem.notes || ''}\nNOTIFICADO: ${notes}` : `Paciente notificado el ${new Date().toLocaleDateString()}`
                }
                break

            default:
                return NextResponse.json(
                    { error: 'Acción no válida. Use: DELIVER, CANCEL, NOTIFY' },
                    { status: 400 }
                )
        }

        const updated = await prisma.pendingItem.update({
            where: { id },
            data: updateData,
            include: {
                patient: true,
                product: true,
                warehouse: true
            }
        })

        return NextResponse.json({ success: true, pendingItem: updated })
    } catch (error) {
        console.error('Error actualizando pendiente:', error)
        return NextResponse.json(
            { error: 'Error actualizando pendiente', details: String(error) },
            { status: 500 }
        )
    }
}
