import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Buscar inventario disponible
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const warehouseId = searchParams.get('warehouseId')
        const search = searchParams.get('search')
        const epsCode = searchParams.get('epsCode')

        const whereClause: any = {
            quantity: { gt: 0 }
        }

        if (warehouseId) {
            whereClause.warehouseId = warehouseId
        }

        // Filtrar por EPS (bodegas que pertenecen a esa EPS)
        if (epsCode) {
            whereClause.warehouse = {
                code: { startsWith: epsCode }
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
                warehouse: true
            },
            orderBy: [
                { product: { name: 'asc' } },
                { expiryDate: 'asc' }
            ],
            take: 100
        })

        // Agrupar por producto y bodega
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
            total: Object.keys(grouped).length
        })
    } catch (error) {
        console.error('Error buscando inventario:', error)
        return NextResponse.json(
            { error: 'Error buscando inventario', details: String(error) },
            { status: 500 }
        )
    }
}
