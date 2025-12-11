import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET - Listar entregas
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
        const warehouseId = searchParams.get('warehouseId')
        const patientId = searchParams.get('patientId')
        const dateFrom = searchParams.get('dateFrom')
        const dateTo = searchParams.get('dateTo')
        const limit = parseInt(searchParams.get('limit') || '50')

        const whereClause: any = { organizationId }

        // Filtrar por bodegas asignadas al usuario (solo para OPERATOR/DISPENSER)
        const isRestrictedRole = orgRole === 'OPERATOR' || orgRole === 'DISPENSER'
        if (isRestrictedRole && userWarehouseIds.length > 0) {
            whereClause.warehouseId = { in: userWarehouseIds }
        } else if (isRestrictedRole && userWarehouseIds.length === 0) {
            return NextResponse.json({ deliveries: [] })
        }

        if (warehouseId) {
            // Verificar acceso a la bodega especificada
            if (isRestrictedRole && !userWarehouseIds.includes(warehouseId)) {
                return NextResponse.json({ error: 'No tiene acceso a esta bodega' }, { status: 403 })
            }
            whereClause.warehouseId = warehouseId
        }
        if (patientId) whereClause.prescription = { patientId }

        if (dateFrom || dateTo) {
            whereClause.deliveryDate = {}
            if (dateFrom) whereClause.deliveryDate.gte = new Date(dateFrom)
            if (dateTo) whereClause.deliveryDate.lte = new Date(dateTo)
        }

        const deliveries = await prisma.delivery.findMany({
            where: whereClause,
            include: {
                prescription: {
                    include: {
                        patient: true,
                        eps: true
                    }
                },
                warehouse: true,
                deliveredBy: {
                    select: { name: true, email: true }
                },
                items: {
                    include: { product: true }
                }
            },
            orderBy: { deliveryDate: 'desc' },
            take: limit
        })

        return NextResponse.json({ deliveries })
    } catch (error) {
        console.error('Error listando entregas:', error)
        return NextResponse.json(
            { error: 'Error listando entregas', details: String(error) },
            { status: 500 }
        )
    }
}

// POST - Crear nueva entrega
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
            epsId,
            warehouseId,
            prescriptionNumber,
            prescriptionDate,
            prescribingDoctor,
            mipresCode,
            items,
            moderatorFee,
            notes,
            // Campos de terceros y documentos
            isAuthorizedPickup,
            authorizedPersonName,
            authorizedPersonDoc,
            prescriptionPhotoPath,
            deliverySignaturePath,
            authorizedDocPhotoPath,
            authorizationLetterPath,
            pendingDeliveryLetterPath,

            redeemedPendingItemIds,
            paymentType,
            paymentMethod,
            paymentAmount
        } = body

        if (!patientId || !warehouseId || !items?.length) {
            return NextResponse.json(
                { error: 'patientId, warehouseId e items son requeridos' },
                { status: 400 }
            )
        }

        // Verificar que hay suficiente inventario
        for (const item of items) {
            const inventory = await prisma.inventory.findUnique({
                where: { id: item.inventoryId }
            })

            if (!inventory || inventory.quantity < item.quantity) {
                return NextResponse.json(
                    { error: `Inventario insuficiente para producto ${item.productId}` },
                    { status: 400 }
                )
            }
        }

        // Crear transcripción y entrega en una transacción
        const result = await prisma.$transaction(async (tx) => {
            // Determinar estado de la prescripción
            let hasPendingItems = false
            for (const item of items) {
                if (item.quantityPrescribed && item.quantity < item.quantityPrescribed) {
                    hasPendingItems = true
                    break
                }
            }
            const prescriptionStatus = hasPendingItems ? 'PARTIAL' : 'DELIVERED'

            // Crear prescripción
            const prescription = await tx.prescription.create({
                data: {
                    organizationId,
                    patientId,
                    epsId: epsId || (await tx.ePS.findFirst({ where: { organizationId } }))?.id, // Fallback to *any* EPS of the org if not provided?
                    prescriptionNumber: prescriptionNumber || `RX-${Date.now()}`,
                    prescriptionDate: prescriptionDate ? new Date(prescriptionDate) : new Date(),
                    prescribingDoctor,
                    mipresCode,
                    status: prescriptionStatus,
                    items: {
                        create: items.map((item: any) => ({
                            productId: item.productId,
                            quantity: item.quantityPrescribed || item.quantity,
                            deliveredQty: item.quantity,
                            notes: item.quantity < (item.quantityPrescribed || item.quantity) ? 'Entrega parcial' : undefined
                        }))
                    }
                }
            })

            // Crear PendingItems si hay pendientes
            if (hasPendingItems) {
                const createdPrescription = await tx.prescription.findUnique({
                    where: { id: prescription.id },
                    include: { items: true }
                })

                if (createdPrescription) {
                    for (const pItem of createdPrescription.items) {
                        const originalItem = items.find((i: any) => i.productId === pItem.productId)
                        if (originalItem && originalItem.quantity < pItem.quantity) {
                            const pendingQty = pItem.quantity - originalItem.quantity
                            await tx.pendingItem.create({
                                data: {
                                    organizationId,
                                    prescriptionItemId: pItem.id,
                                    warehouseId,
                                    quantity: pendingQty,
                                    status: 'PENDING'
                                }
                            })
                        }
                    }
                }
            }

            // Si estamos REDIMIENDO pendientes, actualizamos su estado
            if (redeemedPendingItemIds && redeemedPendingItemIds.length > 0) {
                await tx.pendingItem.updateMany({
                    where: { id: { in: redeemedPendingItemIds } },
                    data: { status: 'DELIVERED', notifiedAt: new Date() }
                })
            }

            // Crear entrega
            const userEmail = session?.user?.email
            const currentUser = userEmail ? await tx.user.findUnique({ where: { email: userEmail } }) : null
            // We shouldn't pick random users anymore, strict userId is better, but keeping fallback logic compatible
            const delivererId = currentUser?.id || (await tx.organizationMember.findFirst({ where: { organizationId } }))?.userId || ''

            const delivery = await tx.delivery.create({
                data: {
                    organizationId,
                    prescriptionId: prescription.id,
                    warehouseId,
                    deliveredById: delivererId,
                    status: 'COMPLETED',
                    moderatorFee: moderatorFee || 0,
                    notes,
                    // Campos de documentos y terceros
                    isAuthorizedPickup: isAuthorizedPickup || false,
                    authorizedPersonName,
                    authorizedPersonDoc,
                    prescriptionPhotoPath,
                    deliverySignaturePath,
                    authorizedDocPhotoPath,
                    authorizationLetterPath,
                    pendingDeliveryLetterPath,
                    paymentType,
                    paymentMethod,
                    paymentAmount,

                    items: {
                        create: items.map((item: any) => ({
                            productId: item.productId,
                            lotNumber: item.lotNumber,
                            quantity: item.quantity
                        }))
                    }
                },
                include: {
                    items: { include: { product: true } },
                    prescription: { include: { patient: true } }
                }
            })

            // Descontar inventario
            for (const item of items) {
                await tx.inventory.update({
                    where: { id: item.inventoryId },
                    data: {
                        quantity: { decrement: item.quantity }
                    }
                })
            }

            return delivery
        })

        return NextResponse.json({ success: true, delivery: result }, { status: 201 })
    } catch (error) {
        console.error('Error creando entrega:', error)
        return NextResponse.json(
            { error: 'Error creando entrega', details: String(error) },
            { status: 500 }
        )
    }
}
