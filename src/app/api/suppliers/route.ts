import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * API para gestión de proveedores
 * 
 * GET /api/suppliers - Listar proveedores
 * POST /api/suppliers - Crear proveedor
 * PUT /api/suppliers - Actualizar proveedor
 * DELETE /api/suppliers - Eliminar proveedor
 */

// GET - Listar proveedores
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const searchParams = request.nextUrl.searchParams
        const search = searchParams.get('search')
        const includeScores = searchParams.get('includeScores') === 'true'

        // Obtener organizationId del usuario
        const member = await prisma.organizationMember.findFirst({
            where: { userId: session.user.id },
            select: { organizationId: true }
        })

        if (!member) {
            return NextResponse.json({ error: 'Usuario sin organización' }, { status: 400 })
        }

        const where: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
            organizationId: member.organizationId,
            isActive: true
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { nit: { contains: search, mode: 'insensitive' } }
            ]
        }

        const suppliers = await prisma.supplier.findMany({
            where,
            include: includeScores ? { score: true } : undefined,
            orderBy: { name: 'asc' }
        })

        return NextResponse.json({
            success: true,
            suppliers
        })
    } catch (error) {
        console.error('Error listando proveedores:', error)
        return NextResponse.json(
            { success: false, error: 'Error al listar proveedores' },
            { status: 500 }
        )
    }
}

// POST - Crear proveedor
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { code, name, nit, address, phone, email, whatsapp, website, preferredContact, isExternal } = body

        if (!code || !name) {
            return NextResponse.json(
                { success: false, error: 'Código y nombre son requeridos' },
                { status: 400 }
            )
        }

        // Obtener organización
        const member = await prisma.organizationMember.findFirst({
            where: { userId: session.user.id }
        })

        if (!member) {
            return NextResponse.json({ error: 'Usuario sin organización' }, { status: 400 })
        }

        // Verificar código único
        const existing = await prisma.supplier.findFirst({
            where: { organizationId: member.organizationId, code }
        })

        if (existing) {
            return NextResponse.json(
                { success: false, error: 'Ya existe un proveedor con ese código' },
                { status: 400 }
            )
        }

        const supplier = await prisma.supplier.create({
            data: {
                organizationId: member.organizationId,
                code,
                name,
                nit,
                address,
                phone,
                email,
                whatsapp,
                website,
                preferredContact,
                isExternal: isExternal || false
            }
        })

        // Crear score inicial
        await prisma.supplierScore.create({
            data: {
                supplierId: supplier.id,
                priceScore: 50,
                deliveryScore: 50,
                qualityScore: 50,
                paymentScore: 50,
                discountScore: 50,
                trackingScore: 50,
                overallScore: 50
            }
        })

        return NextResponse.json({
            success: true,
            supplier
        })
    } catch (error) {
        console.error('Error creando proveedor:', error)
        return NextResponse.json(
            { success: false, error: 'Error al crear proveedor' },
            { status: 500 }
        )
    }
}

// PUT - Actualizar proveedor
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { id, ...data } = body

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID de proveedor requerido' },
                { status: 400 }
            )
        }

        // Verificar permisos
        const member = await prisma.organizationMember.findFirst({
            where: { userId: session.user.id }
        })

        if (!member) {
            return NextResponse.json({ error: 'Usuario sin organización' }, { status: 400 })
        }

        const existing = await prisma.supplier.findFirst({
            where: { id, organizationId: member.organizationId }
        })

        if (!existing) {
            return NextResponse.json(
                { success: false, error: 'Proveedor no encontrado' },
                { status: 404 }
            )
        }

        const supplier = await prisma.supplier.update({
            where: { id },
            data: {
                name: data.name,
                nit: data.nit,
                address: data.address,
                phone: data.phone,
                email: data.email,
                whatsapp: data.whatsapp,
                website: data.website,
                preferredContact: data.preferredContact,
                isActive: data.isActive
            }
        })

        return NextResponse.json({
            success: true,
            supplier
        })
    } catch (error) {
        console.error('Error actualizando proveedor:', error)
        return NextResponse.json(
            { success: false, error: 'Error al actualizar proveedor' },
            { status: 500 }
        )
    }
}

// DELETE - Desactivar proveedor (soft delete)
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID de proveedor requerido' },
                { status: 400 }
            )
        }

        // Verificar permisos
        const member = await prisma.organizationMember.findFirst({
            where: { userId: session.user.id }
        })

        if (!member) {
            return NextResponse.json({ error: 'Usuario sin organización' }, { status: 400 })
        }

        const existing = await prisma.supplier.findFirst({
            where: { id, organizationId: member.organizationId }
        })

        if (!existing) {
            return NextResponse.json(
                { success: false, error: 'Proveedor no encontrado' },
                { status: 404 }
            )
        }

        await prisma.supplier.update({
            where: { id },
            data: { isActive: false }
        })

        return NextResponse.json({
            success: true,
            message: 'Proveedor eliminado'
        })
    } catch (error) {
        console.error('Error eliminando proveedor:', error)
        return NextResponse.json(
            { success: false, error: 'Error al eliminar proveedor' },
            { status: 500 }
        )
    }
}
