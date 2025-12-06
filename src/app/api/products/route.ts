import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Listar productos
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const isActive = searchParams.get('isActive')
        const limit = parseInt(searchParams.get('limit') || '100')
        const offset = parseInt(searchParams.get('offset') || '0')

        const whereClause: any = {}

        if (search) {
            whereClause.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { molecule: { contains: search, mode: 'insensitive' } }
            ]
        }

        if (isActive !== null && isActive !== undefined) {
            whereClause.isActive = isActive === 'true'
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where: whereClause,
                orderBy: { name: 'asc' },
                take: limit,
                skip: offset
            }),
            prisma.product.count({ where: whereClause })
        ])

        return NextResponse.json({ products, total })
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
        const body = await request.json()
        const {
            code,
            name,
            molecule,
            presentation,
            concentration,
            laboratory,
            price,
            requiresPrescription,
            isControlled,
            minStock,
            maxStock
        } = body

        if (!code || !name) {
            return NextResponse.json(
                { error: 'code y name son requeridos' },
                { status: 400 }
            )
        }

        // Verificar código único
        const existing = await prisma.product.findUnique({ where: { code } })
        if (existing) {
            return NextResponse.json(
                { error: 'Ya existe un producto con ese código' },
                { status: 400 }
            )
        }

        const product = await prisma.product.create({
            data: {
                code,
                name,
                molecule,
                presentation,
                concentration,
                laboratory,
                price: price || 0,
                requiresPrescription: requiresPrescription ?? true,
                isControlled: isControlled ?? false,
                minStock,
                maxStock,
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
        const body = await request.json()
        const { id, ...data } = body

        if (!id) {
            return NextResponse.json(
                { error: 'id es requerido' },
                { status: 400 }
            )
        }

        const product = await prisma.product.update({
            where: { id },
            data
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

// DELETE - Desactivar producto
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json(
                { error: 'id es requerido' },
                { status: 400 }
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
