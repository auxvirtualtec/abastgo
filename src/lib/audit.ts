import { prisma } from '@/lib/prisma'

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'

interface AuditData {
    userId?: string | null
    action: AuditAction
    entity: string
    entityId: string
    oldValues?: any
    newValues?: any
}

/**
 * Registra una acción en el log de auditoría
 */
export async function logAudit(data: AuditData): Promise<void> {


    try {
        let organizationId = (data as any).organizationId

        if (!organizationId && data.userId) {
            const user = await prisma.user.findUnique({
                where: { id: data.userId },
                select: { memberships: { select: { organizationId: true }, take: 1 } }
            })
            organizationId = user?.memberships[0]?.organizationId
        }

        if (!organizationId) {
            console.warn('Audit log skipped: No organizationId context', data)
            return
        }

        await prisma.auditLog.create({
            data: {
                organizationId,
                userId: data.userId || null,
                action: data.action,
                entity: data.entity,
                entityId: data.entityId,
                oldValues: data.oldValues || null,
                newValues: data.newValues || null
            }
        })
    } catch (error) {
        console.error('Error registrando auditoría:', error)
        // No lanzar error para no interrumpir la operación principal
    }
}

/**
 * Helper para auditar creación
 */
export async function auditCreate(
    entity: string,
    entityId: string,
    newValues: any,
    userId?: string | null
): Promise<void> {
    await logAudit({ action: 'CREATE', entity, entityId, newValues, userId })
}

/**
 * Helper para auditar actualización
 */
export async function auditUpdate(
    entity: string,
    entityId: string,
    oldValues: any,
    newValues: any,
    userId?: string | null
): Promise<void> {
    await logAudit({ action: 'UPDATE', entity, entityId, oldValues, newValues, userId })
}

/**
 * Helper para auditar eliminación
 */
export async function auditDelete(
    entity: string,
    entityId: string,
    oldValues: any,
    userId?: string | null
): Promise<void> {
    await logAudit({ action: 'DELETE', entity, entityId, oldValues, userId })
}
