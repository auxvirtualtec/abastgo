import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET - Buscar inventario disponible
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const organizationId = session?.user?.organizationId
        const orgRole = session?.user?.orgRole
        const userWarehouseIds = session?.user?.warehouseIds || []

        if (!organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const warehouseId = searchParams.get('warehouseId')
        const search = searchParams.get('search')
        const epsId = searchParams.get('epsId') // Filtrar por EPS
        const groupBy = searchParams.get('groupBy') // 'product' = totales consolidados

        const whereClause: any = {
            quantity: { gt: 0 },
            warehouse: {
                organizationId
            }
        }

        // Filtrar por bodegas asignadas al usuario (solo para OPERATOR/DISPENSER)
        const isRestrictedRole = orgRole === 'OPERATOR' || orgRole === 'DISPENSER'
        if (isRestrictedRole && userWarehouseIds.length > 0) {
            whereClause.warehouseId = { in: userWarehouseIds }
        } else if (isRestrictedRole && userWarehouseIds.length === 0) {
            return NextResponse.json({ items: [], total: 0 })
        }

        if (warehouseId) {
            if (isRestrictedRole && !userWarehouseIds.includes(warehouseId)) {
                return NextResponse.json({ error: 'No tiene acceso a esta bodega' }, { status: 403 })
            }
            whereClause.warehouseId = warehouseId
        }

        // Filtrar por EPS (bodegas que pertenecen a esa EPS)
        if (epsId) {
            whereClause.warehouse = {
                ...whereClause.warehouse,
                epsId: epsId
            }
        }

        // Buscar por nombre o código de producto
        if (search) {
            whereClause.product = {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { code: { contains: search, mode: 'insensitive' } },
                    { molecule: { contains: search, mode: 'insensitive' } }
                ]
            }
        }

        const inventory = await prisma.inventory.findMany({
            where: whereClause,
            include: {
                product: true,
                warehouse: {
                    include: { eps: true }
                }
            },
            orderBy: [
                { product: { name: 'asc' } },
                { expiryDate: 'asc' }
            ],
            take: 500
        })

        // Agrupar según el modo solicitado
        if (groupBy === 'product') {
            // Totales consolidados por producto (sin desglose por bodega)
            const grouped = inventory.reduce((acc, item) => {
                const key = item.productId
                if (!acc[key]) {
                    acc[key] = {
                        productId: item.productId,
                        productCode: item.product.code,
                        productName: item.product.name,
                        molecule: item.product.molecule,
                        totalQuantity: 0,
                        warehouseCount: 0,
                        warehouses: new Set<string>(),
                        lots: []
                    }
                }
                acc[key].totalQuantity += item.quantity
                acc[key].warehouses.add(item.warehouseId)
                acc[key].lots.push({
                    inventoryId: item.id,
                    lotNumber: item.lotNumber,
                    quantity: item.quantity,
                    unitCost: Number(item.unitCost),
                    expiryDate: item.expiryDate,
                    warehouseName: item.warehouse.name,
                    epsName: item.warehouse.eps?.name || 'General'
                })
                return acc
            }, {} as Record<string, any>)

            // Convertir Set a conteo
            const items = Object.values(grouped).map((item: any) => ({
                ...item,
                warehouseCount: item.warehouses.size,
                warehouses: undefined
            }))

            return NextResponse.json({
                items,
                total: items.length,
                mode: 'consolidated'
            })
        }

        // Modo por defecto: Agrupar por producto y bodega
        const grouped = inventory.reduce((acc, item) => {
            const key = `${item.productId}-${item.warehouseId}`
            if (!acc[key]) {
                acc[key] = {
                    productId: item.productId,
                    productCode: item.product.code,
                    productName: item.product.name,
                    molecule: item.product.molecule,
                    warehouseId: item.warehouseId,
                    warehouseName: item.warehouse.name,
                    warehouseCode: item.warehouse.code,
                    epsName: item.warehouse.eps?.name || 'General',
                    totalQuantity: 0,
                    lots: []
                }
            }
            acc[key].totalQuantity += item.quantity
            acc[key].lots.push({
                inventoryId: item.id,
                lotNumber: item.lotNumber,
                quantity: item.quantity,
                unitCost: Number(item.unitCost),
                expiryDate: item.expiryDate
            })
            return acc
        }, {} as Record<string, any>)

        return NextResponse.json({
            items: Object.values(grouped),
            total: Object.keys(grouped).length,
            mode: 'by-warehouse'
        })
    } catch (error) {
        console.error('Error buscando inventario:', error)
        return NextResponse.json(
            { error: 'Error buscando inventario', details: String(error) },
            { status: 500 }
        )
    }
}
