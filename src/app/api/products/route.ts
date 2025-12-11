import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET - Listar productos
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const organizationId = session.user.organizationId

        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const isActive = searchParams.get('isActive')
        const limit = parseInt(searchParams.get('limit') || '100')
        const offset = parseInt(searchParams.get('offset') || '0')

        const whereClause: any = { organizationId }

        if (search) {
            whereClause.AND = [
                { organizationId },
                {
                    OR: [
                        { code: { contains: search, mode: 'insensitive' } },
                        { name: { contains: search, mode: 'insensitive' } },
                        { molecule: { contains: search, mode: 'insensitive' } },
                        { barcode: { contains: search, mode: 'insensitive' } }
                    ]
                }
            ]
        }

        if (isActive !== null && isActive !== undefined && isActive !== '') {
            whereClause.isActive = isActive === 'true'
        }

        const [products, count, totalParams] = await Promise.all([
            prisma.product.findMany({
                where: whereClause,
                orderBy: { name: 'asc' },
                take: limit,
                skip: offset
            }),
            prisma.product.count({ where: whereClause }),
            prisma.product.groupBy({
                by: ['isActive'],
                where: { organizationId },
                _count: { id: true }
            })
        ])

        const stats = {
            total: totalParams.reduce((acc, curr) => acc + curr._count.id, 0),
            active: totalParams.find(p => p.isActive)?._count.id || 0,
            inactive: totalParams.find(p => !p.isActive)?._count.id || 0,
            lowStock: 0
        }

        // Count low stock
        stats.lowStock = await prisma.product.count({
            where: {
                organizationId,
                isActive: true,
                minStock: { gt: 0 }
            }
        })

        return NextResponse.json({ products, total: count, stats })
    } catch (error) {
        console.error('Error listando productos:', error)
        return NextResponse.json(
            { error: 'Error listando productos', details: String(error) },
            { status: 500 }
        )
    }
}

// POST - Crear producto
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const organizationId = session?.user?.organizationId

        if (!organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const {
            code,
            barcode,
            name,
            molecule,
            presentation,
            concentration,
            unit,
            price,
            minStock
        } = body

        if (!code || !name) {
            return NextResponse.json(
                { error: 'code y name son requeridos' },
                { status: 400 }
            )
        }

        // Verificar código único dentro de la organización
        const existing = await prisma.product.findUnique({
            where: {
                organizationId_code: {
                    organizationId,
                    code
                }
            }
        })
        if (existing) {
            return NextResponse.json(
                { error: 'Ya existe un producto con ese código en esta organización' },
                { status: 400 }
            )
        }

        const product = await prisma.product.create({
            data: {
                organizationId,
                code,
                barcode,
                name,
                molecule,
                presentation,
                concentration,
                unit,
                price: price || 0,
                minStock: minStock || 0,
                isActive: true
            }
        })

        return NextResponse.json({ success: true, product }, { status: 201 })
    } catch (error) {
        console.error('Error creando producto:', error)
        return NextResponse.json(
            { error: 'Error creando producto', details: String(error) },
            { status: 500 }
        )
    }
}

// PUT - Actualizar producto
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const organizationId = session.user.organizationId

        const body = await request.json()
        const { id, code, barcode, name, molecule, presentation, concentration, unit, price, minStock, isActive } = body

        if (!id) {
            return NextResponse.json(
                { error: 'id es requerido' },
                { status: 400 }
            )
        }

        // Verify product owner
        const existingProduct = await prisma.product.findUnique({ where: { id } })
        if (!existingProduct || existingProduct.organizationId !== organizationId) {
            return NextResponse.json(
                { error: 'Producto no encontrado' },
                { status: 404 }
            )
        }

        // Si se cambia el código, verificar que no exista
        if (code && code !== existingProduct.code) {
            const duplicate = await prisma.product.findUnique({
                where: {
                    organizationId_code: {
                        organizationId,
                        code
                    }
                }
            })
            if (duplicate) {
                return NextResponse.json(
                    { error: 'Ya existe otro producto con ese código' },
                    { status: 400 }
                )
            }
        }

        // Use updateMany to ensure security or simple update since we checked
        const product = await prisma.product.update({
            where: { id },
            data: {
                ...(code && { code }),
                ...(barcode !== undefined && { barcode }),
                ...(name && { name }),
                ...(molecule !== undefined && { molecule }),
                ...(presentation !== undefined && { presentation }),
                ...(concentration !== undefined && { concentration }),
                ...(unit !== undefined && { unit }),
                ...(price !== undefined && { price }),
                ...(minStock !== undefined && { minStock }),
                ...(isActive !== undefined && { isActive })
            }
        })

        return NextResponse.json({ success: true, product })
    } catch (error) {
        console.error('Error actualizando producto:', error)
        return NextResponse.json(
            { error: 'Error actualizando producto', details: String(error) },
            { status: 500 }
        )
    }
}

// DELETE - Desactivar producto (soft delete)
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const organizationId = session.user.organizationId

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json(
                { error: 'id es requerido' },
                { status: 400 }
            )
        }

        // Verify product owner
        const existingProduct = await prisma.product.findUnique({ where: { id } })
        if (!existingProduct || existingProduct.organizationId !== organizationId) {
            return NextResponse.json(
                { error: 'Producto no encontrado' },
                { status: 404 }
            )
        }

        await prisma.product.update({
            where: { id },
            data: { isActive: false }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error desactivando producto:', error)
        return NextResponse.json(
            { error: 'Error desactivando producto', details: String(error) },
            { status: 500 }
        )
    }
}
