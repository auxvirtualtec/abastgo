import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Listar reportes guardados del usuario
export async function GET(request: NextRequest) {
    try {
        // TODO: Obtener userId de la sesión
        // Por ahora usamos un query param temporal
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') // 'favorite' | 'custom' | null (todos)

        const whereClause: any = {}
        if (type) whereClause.type = type

        const reports = await prisma.$queryRaw`
      SELECT * FROM saved_reports 
      ORDER BY is_favorite DESC, updated_at DESC
      LIMIT 50
    ` as any[]

        return NextResponse.json({ reports })
    } catch (error) {
        console.error('Error listando reportes guardados:', error)
        return NextResponse.json(
            { error: 'Error listando reportes', details: String(error) },
            { status: 500 }
        )
    }
}

// POST - Guardar un reporte
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name, description, type, reportType, query, sqlQuery, filters, isFavorite } = body

        if (!name || !type) {
            return NextResponse.json(
                { error: 'Se requiere nombre y tipo de reporte' },
                { status: 400 }
            )
        }

        // Buscar primer usuario (temporal - debería ser sesión)
        const user = await prisma.user.findFirst()
        if (!user) {
            return NextResponse.json(
                { error: 'No hay usuario disponible' },
                { status: 400 }
            )
        }

        const id = crypto.randomUUID()
        const now = new Date()

        await prisma.$executeRaw`
      INSERT INTO saved_reports (id, user_id, name, description, type, report_type, query, sql_query, filters, is_favorite, created_at, updated_at)
      VALUES (${id}, ${user.id}, ${name}, ${description || null}, ${type}, ${reportType || null}, ${query || null}, ${sqlQuery || null}, ${filters ? JSON.stringify(filters) : null}::jsonb, ${isFavorite || false}, ${now}, ${now})
    `

        return NextResponse.json({
            success: true,
            id,
            message: 'Reporte guardado exitosamente'
        }, { status: 201 })
    } catch (error) {
        console.error('Error guardando reporte:', error)
        return NextResponse.json(
            { error: 'Error guardando reporte', details: String(error) },
            { status: 500 }
        )
    }
}

// DELETE - Eliminar reporte guardado
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json(
                { error: 'Se requiere ID del reporte' },
                { status: 400 }
            )
        }

        await prisma.$executeRaw`DELETE FROM saved_reports WHERE id = ${id}`

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error eliminando reporte:', error)
        return NextResponse.json(
            { error: 'Error eliminando reporte', details: String(error) },
            { status: 500 }
        )
    }
}

// PATCH - Actualizar favorito
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json()
        const { id, isFavorite } = body

        if (!id) {
            return NextResponse.json(
                { error: 'Se requiere ID del reporte' },
                { status: 400 }
            )
        }

        await prisma.$executeRaw`
      UPDATE saved_reports SET is_favorite = ${isFavorite}, updated_at = ${new Date()} WHERE id = ${id}
    `

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error actualizando reporte:', error)
        return NextResponse.json(
            { error: 'Error actualizando reporte', details: String(error) },
            { status: 500 }
        )
    }
}
