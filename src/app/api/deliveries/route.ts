import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// GET - Listar entregas
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const warehouseId = searchParams.get('warehouseId')
        const patientId = searchParams.get('patientId')
        const dateFrom = searchParams.get('dateFrom')
        const dateTo = searchParams.get('dateTo')
        const limit = parseInt(searchParams.get('limit') || '50')

        const whereClause: any = {}

        if (warehouseId) whereClause.warehouseId = warehouseId
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
        const body = await request.json()
        const {
            patientId,
            epsId,
            warehouseId,
            prescriptionNumber,
            prescriptionDate,
            prescribingDoctor,
            mipresCode,
            items, // Array de { productId, quantity, lotNumber, inventoryId }
            moderatorFee,
            notes
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

        // Crear prescripción y entrega en una transacción
        const result = await prisma.$transaction(async (tx) => {
            // Crear prescripción
            const prescription = await tx.prescription.create({
                data: {
                    patientId,
                    epsId: epsId || (await tx.ePS.findFirst())?.id,
                    prescriptionNumber: prescriptionNumber || `RX-${Date.now()}`,
                    prescriptionDate: prescriptionDate ? new Date(prescriptionDate) : new Date(),
                    prescribingDoctor,
                    mipresCode,
                    status: 'DELIVERED',
                    items: {
                        create: items.map((item: any) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            deliveredQty: item.quantity
                        }))
                    }
                }
            })

            // Crear entrega
            // TODO: Obtener usuario actual del session
            const firstUser = await tx.user.findFirst()

            const delivery = await tx.delivery.create({
                data: {
                    prescriptionId: prescription.id,
                    warehouseId,
                    deliveredById: firstUser?.id || '',
                    status: 'COMPLETED',
                    moderatorFee: moderatorFee || 0,
                    notes,
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
