import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Listar bodegas
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type')
        const epsCode = searchParams.get('epsCode')

        const whereClause: any = {
            isActive: true
        }

        if (type) {
            whereClause.type = type
        }

        // Filtrar por EPS (código de bodega comienza con el código de EPS)
        if (epsCode) {
            whereClause.code = { startsWith: epsCode }
        }

        const warehouses = await prisma.warehouse.findMany({
            where: whereClause,
            orderBy: { name: 'asc' }
        })

        return NextResponse.json({ warehouses })
    } catch (error) {
        console.error('Error listando bodegas:', error)
        return NextResponse.json(
            { error: 'Error listando bodegas', details: String(error) },
            { status: 500 }
        )
    }
}
