import { prisma } from "@/lib/prisma";

export interface SmartAlert {
    type: 'warning' | 'danger' | 'info';
    message: string;
    href: string;
    action?: 'TRANSFER' | 'PURCHASE';
}

export async function generateRotationAlerts(warehouseId?: string): Promise<SmartAlert[]> {
    const alerts: SmartAlert[] = [];
    const today = new Date();
    const twentyEightDaysAgo = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);

    // 1. Identificar almacenes a monitorear (Dispensarios)
    // Si se pasa warehouseId, verificar si es dispensario. Si no, traer todos los dispensarios.
    const warehousesToMonitor = await prisma.warehouse.findMany({
        where: {
            isActive: true,
            type: 'DISPENSARIO',
            ...(warehouseId ? { id: warehouseId } : {})
        }
    });

    if (warehousesToMonitor.length === 0) return alerts;

    // 2. Obtener Bodegas para verificar stock de reposición
    const supplyWarehouses = await prisma.warehouse.findMany({
        where: { isActive: true, type: 'BODEGA' },
        include: { inventory: true }
    });

    // 3. Para cada dispensario, calcular rotación por producto
    for (const warehouse of warehousesToMonitor) {
        // Obtener salidas (entregas) de los últimos 28 días
        const consumptions = await prisma.deliveryItem.groupBy({
            by: ['productId'],
            where: {
                delivery: {
                    warehouseId: warehouse.id,
                    deliveryDate: { gte: twentyEightDaysAgo },
                    status: 'COMPLETED'
                }
            },
            _sum: { quantity: true }
        });

        // Obtener inventario actual del dispensario
        const currentInventory = await prisma.inventory.groupBy({
            by: ['productId'],
            where: { warehouseId: warehouse.id, quantity: { gt: 0 } },
            _sum: { quantity: true }
        });

        // Mapas para acceso rápido
        // const stockMap = new Map(currentInventory.map(i => [i.productId, i._sum.quantity || 0]));
        // TypeScript safe way:
        const stockMap = new Map<string, number>();
        currentInventory.forEach(i => {
            stockMap.set(i.productId, i._sum.quantity || 0);
        });

        const productIds = consumptions.map(c => c.productId);
        if (productIds.length === 0) continue;

        // Cargar nombres de productos
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, minStock: true }
        });
        const productMap = new Map(products.map(p => [p.id, p]));

        // Análisis de cada producto consumido
        for (const consumption of consumptions) {
            const productId = consumption.productId;
            const totalConsumed = consumption._sum.quantity || 0;
            const weeklyRotation = totalConsumed / 4;
            const currentStock = stockMap.get(productId) || 0;

            // UMBRAL: Si el stock actual cubre 1 semana o menos (o es 0)
            // Se puede ajustar el umbral, ej: 1.5 semanas para seguridad.
            // Usaremos: Stock <= WeeklyRotation (cobertura <= 7 días)

            if (currentStock <= weeklyRotation && weeklyRotation > 0) {
                const product = productMap.get(productId);
                if (!product) continue;

                // Verificar disponibilidad en Bodegas Centrales
                let availableInSupply = 0;
                for (const supplyWh of supplyWarehouses) {
                    const supplyItem = supplyWh.inventory.find(i => i.productId === productId && i.quantity > 0);
                    // O mejor, filtrar la lista completa. supplyWarehouses trae inventory. 
                    // Inventory es array.
                    const supplyStock = supplyWh.inventory
                        .filter(i => i.productId === productId)
                        .reduce((sum, item) => sum + item.quantity, 0);
                    availableInSupply += supplyStock;
                }

                // Generar Alerta
                if (availableInSupply > 0) {
                    alerts.push({
                        type: 'warning',
                        message: `Stock bajo de ${product.name} en ${warehouse.name}. Reponer desde Bodega (Disp: ${availableInSupply})`,
                        href: `/traslados/nuevo?from=BODEGA&to=${warehouse.id}&product=${productId}`, // Link inteligente hipotético
                        action: 'TRANSFER'
                    });
                } else {
                    alerts.push({
                        type: 'danger',
                        message: `AGOTADO: ${product.name} en ${warehouse.name} y Bodegas. Solicitar COMPRA.`,
                        href: `/compras/nueva?product=${productId}`,
                        action: 'PURCHASE'
                    });
                }
            }
        }
    }

    return alerts.slice(0, 5); // Limitar a top 5 alertas más críticas si hay muchas?
    // O devolver todas. Dashboard filtra. Devolvamos todas.
    // return alerts;
    return alerts;
}
