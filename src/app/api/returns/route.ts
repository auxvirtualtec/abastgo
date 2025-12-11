import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET - Listar devoluciones
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const organizationId = session.user.organizationId

        const { searchParams } = new URL(request.url)
        const warehouseId = searchParams.get('warehouseId')
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')
        const status = searchParams.get('status')

        const whereClause: any = { organizationId }

        if (warehouseId) whereClause.warehouseId = warehouseId
        if (status) whereClause.status = status
        if (startDate || endDate) {
            whereClause.returnDate = {}
            if (startDate) whereClause.returnDate.gte = new Date(startDate)
            if (endDate) whereClause.returnDate.lte = new Date(endDate)
        }

        const returns = await prisma.inventoryReturn.findMany({
            where: whereClause,
            include: {
                warehouse: true,
                items: {
                    include: { product: true }
                },
                createdBy: { select: { name: true } }
            },
            orderBy: { returnDate: 'desc' },
            take: 100
        })

        const returnsData = returns.map(r => ({
            id: r.id,
            returnNumber: r.returnNumber,
            returnDate: r.returnDate,
            warehouse: { id: r.warehouse.id, name: r.warehouse.name },
            reason: r.reason,
            status: r.status,
            notes: r.notes,
            itemsCount: r.items.length,
            totalUnits: r.items.reduce((sum, item) => sum + item.quantity, 0),
            createdBy: r.createdBy?.name || 'Sistema'
        }))

        return NextResponse.json({ returns: returnsData })
    } catch (error) {
        console.error('Error listando devoluciones:', error)
        return NextResponse.json(
            { error: 'Error listando devoluciones', details: String(error) },
            { status: 500 }
        )
    }
}

// POST - Crear devolución
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const organizationId = session?.user?.organizationId

        if (!organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const {
            warehouseId,
            reason,
            notes,
            items // [{ productId, lotNumber, expiryDate, quantity }]
        } = body

        if (!warehouseId || !items || items.length === 0) {
            return NextResponse.json(
                { error: 'warehouseId e items son requeridos' },
                { status: 400 }
            )
        }

        // Generar número de devolución
        // Count only within org to avoid leaking info or collisions if unique per org?
        // Schema check: @@unique([organizationId, returnNumber]) usually.
        const count = await prisma.inventoryReturn.count({ where: { organizationId } })
        const returnNumber = `DEV-${String(count + 1).padStart(6, '0')}`

        // Obtener usuario actual
        const userId = session.user.id

        // Crear devolución con items
        const inventoryReturn = await prisma.inventoryReturn.create({
            data: {
                organizationId,
                returnNumber,
                warehouseId,
                reason: reason || 'DEVOLUCION_PACIENTE',
                notes,
                status: 'COMPLETED',
                returnDate: new Date(),
                createdById: userId,
                items: {
                    create: items.map((item: any) => ({
                        productId: item.productId,
                        lotNumber: item.lotNumber || null,
                        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
                        quantity: item.quantity
                    }))
                }
            },
            include: { items: true }
        })

        // Actualizar inventario (agregar unidades devueltas)
        for (const item of items) {
            // Buscar si existe el lote en inventario
            const existingInventory = await prisma.inventory.findFirst({
                where: {
                    productId: item.productId,
                    warehouseId,
                    lotNumber: item.lotNumber || null
                }
            })

            if (existingInventory) {
                await prisma.inventory.update({
                    where: { id: existingInventory.id },
                    data: {
                        quantity: { increment: item.quantity }
                    }
                })
            } else {
                // Crear nuevo registro de inventario
                await prisma.inventory.create({
                    data: {
                        productId: item.productId,
                        warehouseId,
                        lotNumber: item.lotNumber || null,
                        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
                        quantity: item.quantity,
                        unitCost: 0
                    }
                })
            }
        }

        return NextResponse.json({
            success: true,
            return: {
                id: inventoryReturn.id,
                returnNumber: inventoryReturn.returnNumber,
                itemsCount: inventoryReturn.items.length
            }
        }, { status: 201 })
    } catch (error) {
        console.error('Error creando devolución:', error)
        return NextResponse.json(
            { error: 'Error creando devolución', details: String(error) },
            { status: 500 }
        )
    }
}
