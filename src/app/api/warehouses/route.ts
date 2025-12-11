import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET - Listar bodegas
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const organizationId = session.user.organizationId
        const orgRole = session.user.orgRole || 'MEMBER'

        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type')
        const epsCode = searchParams.get('epsCode')
        const includeInactive = searchParams.get('includeInactive') === 'true'
        const search = searchParams.get('search')

        const whereClause: any = { organizationId }

        // Filtrar por permisos de usuario si no es admin de la org
        const isAdmin = orgRole === 'OWNER' || orgRole === 'ADMIN'

        if (!isAdmin) {
            const userWarehouseIds = session.user.warehouseIds || []
            if (userWarehouseIds.length > 0) {
                whereClause.id = { in: userWarehouseIds }
            } else {
                // Usuario sin bodegas no ve nada
                return NextResponse.json({ warehouses: [] })
            }
        }

        if (!includeInactive) {
            whereClause.isActive = true
        }

        if (type) {
            whereClause.type = type
        }

        if (epsCode) {
            whereClause.code = { startsWith: epsCode }
        }

        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } }
            ]
        }

        const warehouses = await prisma.warehouse.findMany({
            where: whereClause,
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { inventory: true, users: true }
                },
                eps: {
                    select: { id: true, name: true, code: true }
                }
            }
        })

        // Agregar estadísticas
        const warehousesData = warehouses.map(w => ({
            id: w.id,
            code: w.code,
            name: w.name,
            type: w.type,
            address: w.address,
            city: w.city,
            phone: w.phone,
            isActive: w.isActive,
            inventoryCount: w._count.inventory,
            usersCount: w._count.users,
            epsId: w.epsId,
            epsName: w.eps?.name || null
        }))

        return NextResponse.json({ warehouses: warehousesData })
    } catch (error) {
        console.error('Error listando bodegas:', error)
        return NextResponse.json(
            { error: 'Error listando bodegas', details: String(error) },
            { status: 500 }
        )
    }
}

// POST - Crear nueva bodega
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const organizationId = session?.user?.organizationId

        if (!organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Optional: Check if user is admin to create warehouse?
        // if (session.user.orgRole !== 'OWNER' && session.user.orgRole !== 'ADMIN') ...

        const body = await request.json()
        const { code, name, type, address, city, phone, epsId } = body

        if (!code || !name || !type) {
            return NextResponse.json(
                { error: 'code, name y type son requeridos' },
                { status: 400 }
            )
        }

        // Verificar código único dentro de la organización
        const existing = await prisma.warehouse.findFirst({
            where: {
                organizationId,
                code
            }
        })
        if (existing) {
            return NextResponse.json(
                { error: 'Ya existe una bodega con ese código en esta organización' },
                { status: 409 }
            )
        }

        const warehouse = await prisma.warehouse.create({
            data: {
                organizationId,
                code,
                name,
                type,
                address,
                city,
                phone,
                isActive: true,
                epsId: epsId || null
            }
        })

        return NextResponse.json({ success: true, warehouse }, { status: 201 })
    } catch (error) {
        console.error('Error creando bodega:', error)
        return NextResponse.json(
            { error: 'Error creando bodega', details: String(error) },
            { status: 500 }
        )
    }
}

// PUT - Actualizar bodega
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const organizationId = session?.user?.organizationId

        if (!organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { id, code, name, type, address, city, phone, isActive, epsId } = body

        if (!id) {
            return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
        }

        // Verify ownership
        const currentWarehouse = await prisma.warehouse.findUnique({ where: { id } })
        if (!currentWarehouse || currentWarehouse.organizationId !== organizationId) {
            return NextResponse.json({ error: 'Bodega no encontrada' }, { status: 404 })
        }

        // Si cambia el código, verificar que no exista en la org
        if (code && code !== currentWarehouse.code) {
            const existing = await prisma.warehouse.findFirst({
                where: {
                    organizationId,
                    code,
                    NOT: { id }
                }
            })
            if (existing) {
                return NextResponse.json(
                    { error: 'Ya existe otra bodega con ese código en esta organización' },
                    { status: 409 }
                )
            }
        }

        const warehouse = await prisma.warehouse.update({
            where: { id },
            data: {
                ...(code && { code }),
                ...(name && { name }),
                ...(type && { type }),
                ...(address !== undefined && { address }),
                ...(city !== undefined && { city }),
                ...(phone !== undefined && { phone }),
                ...(isActive !== undefined && { isActive }),
                ...(epsId !== undefined && { epsId: epsId || null })
            }
        })

        return NextResponse.json({ success: true, warehouse })
    } catch (error) {
        console.error('Error actualizando bodega:', error)
        return NextResponse.json(
            { error: 'Error actualizando bodega', details: String(error) },
            { status: 500 }
        )
    }
}

// DELETE - Desactivar bodega (soft delete)
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const organizationId = session?.user?.organizationId

        if (!organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
        }

        // Verify ownership
        const currentWarehouse = await prisma.warehouse.findUnique({ where: { id } })
        if (!currentWarehouse || currentWarehouse.organizationId !== organizationId) {
            return NextResponse.json({ error: 'Bodega no encontrada' }, { status: 404 })
        }

        // Verificar si tiene inventario
        const inventoryCount = await prisma.inventory.count({
            where: { warehouseId: id, quantity: { gt: 0 } }
        })

        if (inventoryCount > 0) {
            return NextResponse.json(
                { error: `No se puede desactivar: tiene ${inventoryCount} productos en inventario` },
                { status: 409 }
            )
        }

        await prisma.warehouse.update({
            where: { id },
            data: { isActive: false }
        })

        return NextResponse.json({ success: true, message: 'Bodega desactivada' })
    } catch (error) {
        console.error('Error desactivando bodega:', error)
        return NextResponse.json(
            { error: 'Error desactivando bodega', details: String(error) },
            { status: 500 }
        )
    }
}
