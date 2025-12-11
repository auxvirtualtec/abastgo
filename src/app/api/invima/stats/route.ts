import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/invima/stats
 * Obtener estadísticas del catálogo INVIMA
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            )
        }

        // Obtener estadísticas en paralelo
        const [
            totalDrugs,
            activeDrugs,
            inactiveDrugs,
            viasAdministracion,
            formasFarmaceuticas,
            topAtcGroups
        ] = await Promise.all([
            prisma.invimaDrug.count(),
            prisma.invimaDrug.count({ where: { estadoCum: 'Activo' } }),
            prisma.invimaDrug.count({ where: { estadoCum: 'Inactivo' } }),
            prisma.invimaDrug.groupBy({
                by: ['viaAdministracion'],
                _count: { _all: true },
                where: { viaAdministracion: { not: null } },
                orderBy: { _count: { viaAdministracion: 'desc' } },
                take: 10
            }),
            prisma.invimaDrug.groupBy({
                by: ['formaFarmaceutica'],
                _count: { _all: true },
                where: { formaFarmaceutica: { not: null } },
                orderBy: { _count: { formaFarmaceutica: 'desc' } },
                take: 10
            }),
            prisma.invimaDrug.groupBy({
                by: ['atc'],
                _count: { _all: true },
                where: { atc: { not: null } },
                orderBy: { _count: { atc: 'desc' } },
                take: 20
            })
        ])

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    total: totalDrugs,
                    activos: activeDrugs,
                    inactivos: inactiveDrugs
                },
                viaAdministracion: viasAdministracion.map(v => ({
                    via: v.viaAdministracion,
                    count: v._count._all
                })),
                formasFarmaceuticas: formasFarmaceuticas.map(f => ({
                    forma: f.formaFarmaceutica,
                    count: f._count._all
                })),
                topAtcGroups: topAtcGroups.map(a => ({
                    atc: a.atc,
                    count: a._count._all
                }))
            }
        })
    } catch (error) {
        console.error('Error obteniendo estadísticas INVIMA:', error)
        return NextResponse.json(
            { success: false, error: 'Error al obtener estadísticas' },
            { status: 500 }
        )
    }
}
