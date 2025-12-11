import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateRotationAlerts } from '@/lib/alerts'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET - Obtener estadísticas del dashboard
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const organizationId = session?.user?.organizationId

        if (!organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const warehouseId = searchParams.get('warehouseId')

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)

        // Consultas en paralelo para mejor rendimiento
        const [
            totalProducts,
            totalWarehouses,
            totalInventoryValue,
            deliveriesToday,
            deliveriesMonth,
            pendingItems,
            expiringItems,
            lowStockItems
        ] = await Promise.all([
            // Total productos activos de esta organización
            prisma.product.count({ where: { isActive: true, organizationId } }),

            // Total bodegas activas de esta organización
            prisma.warehouse.count({ where: { isActive: true, organizationId } }),

            // Valor total inventario de esta organización
            prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(i.quantity * i.unit_cost), 0)::float as total
        FROM inventory i
        INNER JOIN warehouses w ON i.warehouse_id = w.id
        WHERE i.quantity > 0 AND w.organization_id = ${organizationId}
      `.then(r => r[0]?.total || 0),

            // Entregas hoy de esta organización
            prisma.delivery.count({
                where: {
                    organizationId,
                    deliveryDate: { gte: today },
                    ...(warehouseId && { warehouseId })
                }
            }),

            // Entregas del mes de esta organización
            prisma.delivery.count({
                where: {
                    organizationId,
                    deliveryDate: { gte: thisMonth },
                    ...(warehouseId && { warehouseId })
                }
            }),

            // Items pendientes de esta organización
            prisma.pendingItem.count({
                where: {
                    organizationId,
                    status: 'PENDING',
                    ...(warehouseId && { warehouseId })
                }
            }),

            // Próximos a vencer (30 días) de esta organización
            prisma.inventory.count({
                where: {
                    quantity: { gt: 0 },
                    warehouse: { organizationId },
                    expiryDate: {
                        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        gte: today
                    },
                    ...(warehouseId && { warehouseId })
                }
            }),

            // Productos con Stock Bajo de esta organización
            prisma.$queryRaw<{ count: number }[]>`
                SELECT COUNT(*)::int as count
                FROM "products" p
                LEFT JOIN "inventory" i ON p.id = i.product_id
                WHERE p.is_active = true AND p.min_stock > 0 AND p.organization_id = ${organizationId}
                GROUP BY p.id, p.min_stock
                HAVING COALESCE(SUM(i.quantity), 0) <= p.min_stock
            `.then(r => r.length),
        ])

        // Entregas recientes (últimas 5) de esta organización
        const recentDeliveries = await prisma.delivery.findMany({
            take: 5,
            orderBy: { deliveryDate: 'desc' },
            where: {
                organizationId,
                ...(warehouseId && { warehouseId })
            },
            include: {
                prescription: {
                    include: { patient: true }
                },
                warehouse: true,
                items: true
            }
        })

        const recentData = recentDeliveries.map(d => ({
            id: d.id,
            patientName: d.prescription?.patient?.name || 'Sin paciente',
            warehouse: d.warehouse.name,
            itemsCount: d.items.length,
            date: d.deliveryDate,
            status: d.status
        }))

        // Alertas Estándar
        const alerts: any[] = []
        if (pendingItems > 0) {
            alerts.push({ type: 'warning', message: `${pendingItems} medicamentos pendientes de entrega`, href: '/pendientes' })
        }
        if (expiringItems > 0) {
            alerts.push({ type: 'danger', message: `${expiringItems} lotes próximos a vencer`, href: '/inventario' })
        }

        // Alertas Inteligentes de Rotación
        try {
            const rotationAlerts = await generateRotationAlerts(warehouseId || undefined);
            // Prioridad a las alertas de rotación (al inicio)
            alerts.unshift(...rotationAlerts.map(a => ({
                type: a.type,
                message: a.message,
                href: a.href,
                isSmart: true // Flag opcional para UI
            })));
        } catch (e) {
            console.error("Error generando alertas de rotación", e);
        }

        // Alertas básicas de stock bajo (solo si no hay alertas inteligentes que ya cubran esto, pero dejémoslas por ahora)
        if (lowStockItems > 0 && alerts.length < 5) {
            // Solo agregar si hay espacio y para no saturar. 
            // Ojo: la métrica lowStockItems se basa en minStock, la rotación en consumo real. Son complementarias.
            alerts.push({ type: 'info', message: `${lowStockItems} productos bajo mínimo configurado`, href: '/inventario' })
        }

        return NextResponse.json({
            stats: {
                totalProducts,
                totalWarehouses,
                totalInventoryValue: Math.round(totalInventoryValue),
                deliveriesToday,
                deliveriesMonth,
                pendingItems,
                expiringItems,
                lowStockItems
            },
            recentDeliveries: recentData,
            alerts: alerts.slice(0, 8) // Limitar total
        })
    } catch (error) {
        console.error('Error obteniendo stats:', error)
        return NextResponse.json(
            { error: 'Error obteniendo estadísticas', details: String(error) },
            { status: 500 }
        )
    }
}
