import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET - Listar items pendientes
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const organizationId = session.user.organizationId
        const orgRole = session.user.orgRole
        const userWarehouseIds = session.user.warehouseIds || []

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') || 'PENDING'
        const patientId = searchParams.get('patientId')
        const warehouseId = searchParams.get('warehouseId')
        const limit = parseInt(searchParams.get('limit') || '100')

        const whereClause: any = { organizationId }

        // Filtrar por bodegas asignadas al usuario (solo para OPERATOR/DISPENSER)
        const isRestrictedRole = orgRole === 'OPERATOR' || orgRole === 'DISPENSER'
        if (isRestrictedRole && userWarehouseIds.length > 0) {
            whereClause.warehouseId = { in: userWarehouseIds }
        } else if (isRestrictedRole && userWarehouseIds.length === 0) {
            return NextResponse.json({ items: [], stats: {} })
        }

        if (status && status !== 'ALL') {
            whereClause.status = status
        }
        // Relationship filtering: PendingItem -> PrescriptionItem -> Prescription -> Patient
        if (patientId) {
            whereClause.prescriptionItem = {
                prescription: {
                    patientId: patientId
                }
            }
        }
        if (warehouseId) {
            // Verificar acceso a la bodega especificada
            if (isRestrictedRole && !userWarehouseIds.includes(warehouseId)) {
                return NextResponse.json({ error: 'No tiene acceso a esta bodega' }, { status: 403 })
            }
            whereClause.warehouseId = warehouseId
        }

        const pendingItems = await prisma.pendingItem.findMany({
            where: whereClause,
            include: {
                prescriptionItem: {
                    include: {
                        prescription: {
                            include: {
                                patient: true
                            }
                        },
                        product: true
                    }
                },
                warehouse: true
            },
            orderBy: { createdAt: 'desc' },
            take: limit
        })

        // Estadísticas
        const stats = await prisma.pendingItem.groupBy({
            by: ['status'],
            where: { organizationId },
            _count: { id: true },
            _sum: { quantity: true } // Changed from pendingQty (invalid) to quantity (valid)
        })

        // Map result to flatten structure if needed by client, or return as is (client might need updates, but let's return a clean structure)
        const mappedItems = pendingItems.map((item: any) => ({
            ...item,
            patient: item.prescriptionItem?.prescription?.patient,
            product: item.prescriptionItem?.product,
            prescription: item.prescriptionItem?.prescription
        }))

        return NextResponse.json({
            items: mappedItems,
            stats: stats.reduce((acc, s) => {
                acc[s.status] = { count: s._count.id, quantity: s._sum.quantity || 0 }
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
        const session = await getServerSession(authOptions)
        const organizationId = session?.user?.organizationId

        if (!organizationId) {
            return NextResponse.json(
                { error: 'Unauthorized: Missing Organization ID' },
                { status: 401 }
            )
        }

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

        // Validate basic requirements (patientId is not directly used on model but useful for validation/lookup if needed)
        if (!productId || !pendingQty) {
            return NextResponse.json(
                { error: 'productId, prescriptionId y pendingQty son requeridos' },
                { status: 400 }
            )
        }

        // We need a prescriptionItemId. 
        // If prescriptionId is provided, we try to find the item.
        let prescriptionItemId: string | undefined;

        if (prescriptionId && productId) {
            const pItem = await prisma.prescriptionItem.findFirst({
                where: {
                    prescriptionId,
                    productId
                }
            });
            if (pItem) prescriptionItemId = pItem.id;
        }

        if (!prescriptionItemId) {
            return NextResponse.json(
                { error: 'No se encontró el item de prescripción correspondiente (prescriptionId + productId)' },
                { status: 400 }
            )
        }

        const pendingItem = await prisma.pendingItem.create({
            data: {
                organizationId,
                prescriptionItemId,
                warehouseId: warehouseId || '', // Handle optional/missing warehouse carefully
                quantity: pendingQty, // Schema uses 'quantity', not 'pendingQty'
                status: 'PENDING'
                // notes/reason are NOT in the schema for PendingItem! Only quantity, status, dates.
                // If the schema was correct in my read, PendingItem has limited fields.
                // Re-reading schema: yes, PendingItem has NO 'reason' or 'notes'. 
                // PrescriptionItem has 'notes'.
            },
            include: {
                prescriptionItem: {
                    include: {
                        prescription: {
                            include: { patient: true }
                        },
                        product: true
                    }
                },
                warehouse: true
            }
        })

        const mappedItem = {
            ...pendingItem,
            patient: pendingItem.prescriptionItem?.prescription?.patient,
            product: pendingItem.prescriptionItem?.product
        }

        return NextResponse.json({ success: true, pendingItem: mappedItem }, { status: 201 })
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
        const session = await getServerSession(authOptions)
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const organizationId = session.user.organizationId

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
            include: {
                prescriptionItem: {
                    include: {
                        prescription: {
                            include: { patient: true }
                        },
                        product: true
                    }
                },
                warehouse: true
            }
        })

        if (!pendingItem) {
            return NextResponse.json(
                { error: 'Item pendiente no encontrado' },
                { status: 404 }
            )
        }

        // Ensure tenant isolation
        if (pendingItem.organizationId !== organizationId) {
            return NextResponse.json(
                { error: 'Item not found in organization' },
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

                const newPendingQty = pendingItem.quantity - deliveredQty

                // Note: PendingItem schema only has status and quantity.
                // It does NOT have 'deliveredQty' or 'deliveredAt' or 'notes'.
                // We update quantity and status.

                updateData = {
                    quantity: Math.max(0, newPendingQty),
                    status: newPendingQty <= 0 ? 'DELIVERED' : 'PENDING' // Partial concept?
                    // Schema enum: PENDING, NOTIFIED, SHIPPED, DELIVERED, CANCELLED.
                }
                break

            case 'CANCEL':
                updateData = {
                    status: 'CANCELLED'
                }
                break

            case 'NOTIFY': // Marcar como notificado al paciente
                updateData = {
                    status: 'NOTIFIED',
                    notifiedAt: new Date()
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
                prescriptionItem: {
                    include: {
                        prescription: {
                            include: { patient: true }
                        },
                        product: true
                    }
                },
                warehouse: true
            }
        })

        const mappedUpdated = {
            ...updated,
            patient: updated.prescriptionItem?.prescription?.patient,
            product: updated.prescriptionItem?.product
        }

        return NextResponse.json({ success: true, pendingItem: mappedUpdated })
    } catch (error) {
        console.error('Error actualizando pendiente:', error)
        return NextResponse.json(
            { error: 'Error actualizando pendiente', details: String(error) },
            { status: 500 }
        )
    }
}
