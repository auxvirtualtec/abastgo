import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Listar todas las EPS
export async function GET() {
    try {
        const eps = await prisma.ePS.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                code: true,
                name: true
            }
        })

        return NextResponse.json({ eps })
    } catch (error) {
        console.error('Error listando EPS:', error)
        return NextResponse.json(
            { error: 'Error listando EPS', eps: [] },
            { status: 500 }
        )
    }
}
