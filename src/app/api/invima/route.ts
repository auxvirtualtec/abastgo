import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * API para buscar medicamentos en el catálogo INVIMA
 * 
 * GET /api/invima
 * Query params:
 * - q: Término de búsqueda (nombre, principio activo, ATC)
 * - estado: Filtrar por estado del CUM (Activo/Inactivo)
 * - via: Vía de administración
 * - atc: Código ATC
 * - forma: Forma farmacéutica
 * - page: Página (default: 1)
 * - limit: Límite por página (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
    try {
        // Autenticación opcional - permite búsqueda pública pero puede limitar para no autenticados
        const session = await getServerSession(authOptions)

        const searchParams = request.nextUrl.searchParams
        const query = searchParams.get('q') || ''
        const estado = searchParams.get('estado')
        const via = searchParams.get('via')
        const atc = searchParams.get('atc')
        const forma = searchParams.get('forma')
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))

        // Construir condiciones de búsqueda
        const where: any = {} // eslint-disable-line @typescript-eslint/no-explicit-any

        // Búsqueda por texto (nombre, principio activo, ATC)
        if (query && query.length >= 2) {
            where.OR = [
                { producto: { contains: query, mode: 'insensitive' } },
                { principioActivo: { contains: query, mode: 'insensitive' } },
                { atc: { contains: query, mode: 'insensitive' } },
                { descripcionAtc: { contains: query, mode: 'insensitive' } },
                { cum: { contains: query, mode: 'insensitive' } },
            ]
        }

        // Filtro por estado del CUM
        if (estado) {
            where.estadoCum = estado
        }

        // Filtro por vía de administración
        if (via) {
            where.viaAdministracion = { contains: via, mode: 'insensitive' }
        }

        // Filtro por código ATC
        if (atc) {
            where.atc = { startsWith: atc, mode: 'insensitive' }
        }

        // Filtro por forma farmacéutica
        if (forma) {
            where.formaFarmaceutica = { contains: forma, mode: 'insensitive' }
        }

        // Ejecutar consulta con paginación
        const [drugs, total] = await Promise.all([
            prisma.invimaDrug.findMany({
                where,
                select: {
                    id: true,
                    cum: true,
                    producto: true,
                    titular: true,
                    registroSanitario: true,
                    estadoRegistro: true,
                    estadoCum: true,
                    atc: true,
                    descripcionAtc: true,
                    viaAdministracion: true,
                    principioActivo: true,
                    concentracion: true,
                    formaFarmaceutica: true,
                    unidadMedida: true,
                    cantidad: true,
                    muestraMedica: true,
                    nombreRol: true,
                },
                orderBy: [
                    { estadoCum: 'asc' }, // Activos primero
                    { producto: 'asc' }
                ],
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.invimaDrug.count({ where })
        ])

        return NextResponse.json({
            success: true,
            data: drugs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total
            }
        })
    } catch (error) {
        console.error('Error buscando medicamentos INVIMA:', error)
        return NextResponse.json(
            { success: false, error: 'Error al buscar medicamentos' },
            { status: 500 }
        )
    }
}

/**
 * GET /api/invima/[id]
 * Obtener detalle completo de un medicamento
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            )
        }

        const body = await request.json()
        const { id, cum } = body

        if (!id && !cum) {
            return NextResponse.json(
                { success: false, error: 'Se requiere id o cum' },
                { status: 400 }
            )
        }

        const drug = await prisma.invimaDrug.findFirst({
            where: id ? { id } : { cum }
        })

        if (!drug) {
            return NextResponse.json(
                { success: false, error: 'Medicamento no encontrado' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            data: drug
        })
    } catch (error) {
        console.error('Error obteniendo medicamento INVIMA:', error)
        return NextResponse.json(
            { success: false, error: 'Error al obtener medicamento' },
            { status: 500 }
        )
    }
}
