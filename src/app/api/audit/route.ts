import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET - Listar logs de auditoría
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const organizationId = session.user.organizationId

        const { searchParams } = new URL(request.url)
        const entity = searchParams.get('entity')
        const action = searchParams.get('action')
        const userId = searchParams.get('userId')
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')
        const limit = parseInt(searchParams.get('limit') || '100')

        const whereClause: any = { organizationId }

        if (entity) whereClause.entity = entity
        if (action) whereClause.action = action
        if (userId) whereClause.userId = userId

        if (startDate || endDate) {
            whereClause.createdAt = {}
            if (startDate) whereClause.createdAt.gte = new Date(startDate)
            if (endDate) whereClause.createdAt.lte = new Date(endDate)
        }

        const logs = await prisma.auditLog.findMany({
            where: whereClause,
            include: {
                user: { select: { id: true, name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: limit
        })

        // Obtener estadísticas
        const stats = await prisma.$transaction([
            prisma.auditLog.count({ where: { organizationId } }),
            prisma.auditLog.count({ where: { organizationId, action: 'CREATE' } }),
            prisma.auditLog.count({ where: { organizationId, action: 'UPDATE' } }),
            prisma.auditLog.count({ where: { organizationId, action: 'DELETE' } })
        ])

        // Obtener entidades únicas para filtros
        const entities = await prisma.auditLog.groupBy({
            by: ['entity'],
            where: { organizationId },
            _count: true,
            orderBy: { _count: { entity: 'desc' } }
        })

        const logsData = logs.map(log => ({
            id: log.id,
            action: log.action,
            entity: log.entity,
            entityId: log.entityId,
            oldValues: log.oldValues,
            newValues: log.newValues,
            createdAt: log.createdAt,
            user: log.user ? {
                id: log.user.id,
                name: log.user.name,
                email: log.user.email
            } : null
        }))

        return NextResponse.json({
            logs: logsData,
            stats: {
                total: stats[0],
                creates: stats[1],
                updates: stats[2],
                deletes: stats[3]
            },
            entities: entities.map(e => ({ name: e.entity, count: e._count }))
        })
    } catch (error) {
        console.error('Error listando auditoría:', error)
        return NextResponse.json(
            { error: 'Error listando auditoría', details: String(error) },
            { status: 500 }
        )
    }
}

// POST - Crear log de auditoría (usado internamente)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const body = await request.json()
        const { userId, action, entity, entityId, oldValues, newValues } = body

        const organizationId = session?.user?.organizationId || body.organizationId

        if (!organizationId) {
            return NextResponse.json(
                { error: 'organizationId is required' },
                { status: 400 }
            )
        }

        if (!action || !entity || !entityId) {
            return NextResponse.json(
                { error: 'action, entity y entityId son requeridos' },
                { status: 400 }
            )
        }

        const log = await prisma.auditLog.create({
            data: {
                organizationId,
                userId: userId || session?.user?.id || null, // Prefer from body, fallback to session
                action,
                entity,
                entityId,
                oldValues: oldValues || null,
                newValues: newValues || null
            }
        })

        return NextResponse.json({ success: true, log }, { status: 201 })
    } catch (error) {
        console.error('Error creando log:', error)
        return NextResponse.json(
            { error: 'Error creando log de auditoría', details: String(error) },
            { status: 500 }
        )
    }
}
