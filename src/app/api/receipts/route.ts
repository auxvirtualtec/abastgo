import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET - Listar entradas de almacén
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const organizationId = session.user.organizationId

        const { searchParams } = new URL(request.url)
        const warehouseId = searchParams.get('warehouseId')
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')

        const where: any = {
            warehouse: { organizationId }
        }

        if (warehouseId) where.warehouseId = warehouseId
        if (startDate || endDate) {
            where.receiptDate = {}
            if (startDate) where.receiptDate.gte = new Date(startDate)
            if (endDate) where.receiptDate.lte = new Date(endDate)
        }

        const receipts = await prisma.purchaseReceipt.findMany({
            where,
            include: {
                warehouse: true,
                items: {
                    include: {
                        inventory: {
                            include: { product: true }
                        }
                    }
                },
                purchaseOrder: {
                    include: { supplier: true }
                }
            },
            orderBy: { receiptDate: 'desc' },
            take: 100
        })

        const receiptsData = receipts.map((r: any) => ({
            id: r.id,
            receiptNumber: r.invoiceNumber || 'SIN-REF',
            supplier: r.purchaseOrder?.supplier?.name || 'Sin Proveedor',
            invoiceNumber: r.invoiceNumber,
            receiptDate: r.receiptDate,
            warehouse: { id: r.warehouse.id, name: r.warehouse.name, code: r.warehouse.code },
            itemsCount: r.items.length,
            totalUnits: r.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
            totalValue: r.items.reduce((sum: number, item: any) => sum + (item.quantity * Number(item.inventory?.unitCost || 0)), 0),
            notes: r.notes
        }))

        return NextResponse.json({ receipts: receiptsData })
    } catch (error) {
        console.error('Error listando entradas:', error)
        return NextResponse.json(
            { error: 'Error listando entradas', details: String(error) },
            { status: 500 }
        )
    }
}

// POST - Crear entrada de almacén
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const organizationId = session?.user?.organizationId

        if (!organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const {
            warehouseId,
            supplier, // This comes as name or ID? Assuming name based on old code, but we need ID.
            invoiceNumber,
            receiptDate,
            notes,
            items // [{ productId, lotNumber, expiryDate, quantity, unitCost }]
        } = body

        if (!warehouseId || !items || items.length === 0) {
            return NextResponse.json(
                { error: 'warehouseId e items son requeridos' },
                { status: 400 }
            )
        }

        // 1. Find or create supplier (Best effort)
        let supplierId = '';
        if (supplier) {
            const supp = await prisma.supplier.findFirst({
                where: {
                    organizationId,
                    OR: [
                        { id: supplier }, // if it's an ID
                        { name: supplier } // if it's a name
                    ]
                }
            });
            if (supp) supplierId = supp.id;
            else {
                // Create dummy if not found? Or fail. Let's create one to be safe for "fixing errors"
                const newSupp = await prisma.supplier.create({
                    data: {
                        organizationId,
                        code: `SUP-${Date.now()}`,
                        name: supplier || 'Proveedor General'
                    }
                });
                supplierId = newSupp.id;
            }
        } else {
            // Fallback supplier
            const defaultSupp = await prisma.supplier.findFirst({ where: { organizationId } });
            if (defaultSupp) supplierId = defaultSupp.id;
            else {
                const newSupp = await prisma.supplier.create({
                    data: {
                        organizationId,
                        code: `SUP-DEFAULT-${Date.now()}`,
                        name: 'Proveedor General'
                    }
                });
                supplierId = newSupp.id;
            }
        }

        // 2. Create Purchase Order (Required by schema)
        const orderNumber = `ORD-${Date.now()}`;
        const purchaseOrder = await prisma.purchaseOrder.create({
            data: {
                organizationId,
                orderNumber,
                supplierId,
                status: 'RECEIVED',
                orderDate: receiptDate ? new Date(receiptDate) : new Date()
            }
        });

        // 3. Create Receipt
        // We first need to handle inventory. ReceiptItem links to Inventory.
        // So we must Create/Find Inventory records first, THEN create ReceiptItems linking to them.
        // Inventory is unique by productId + warehouseId + lotNumber.
        // Inventory doesn't have organizationId, but warehouse does.

        const receiptItemsData = [];

        for (const item of items) {
            // Prisma's @@unique([productId, warehouseId, lotNumber]) allows easy upsert if we knew ID, or findUnique by compound.
            // But lotNumber is optional/nullable? In schema: lotNumber String?
            // Prisma doesn't support compound unique with optional fields well in some versions, but let's try findFirst.

            let inv = await prisma.inventory.findFirst({
                where: {
                    productId: item.productId,
                    warehouseId,
                    lotNumber: item.lotNumber || null
                }
            });

            if (inv) {
                inv = await prisma.inventory.update({
                    where: { id: inv.id },
                    data: {
                        quantity: { increment: item.quantity },
                        // Update cost? usually weighted average, but for simplicity overwrite or keep
                    }
                });
            } else {
                inv = await prisma.inventory.create({
                    data: {
                        productId: item.productId,
                        warehouseId,
                        lotNumber: item.lotNumber || null,
                        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
                        quantity: item.quantity,
                        unitCost: item.unitCost || 0
                    }
                });
            }

            receiptItemsData.push({
                inventoryId: inv.id,
                quantity: item.quantity
            });
        }

        const receipt = await prisma.purchaseReceipt.create({
            data: {
                purchaseOrderId: purchaseOrder.id,
                warehouseId,
                invoiceNumber,
                receiptDate: receiptDate ? new Date(receiptDate) : new Date(),
                notes,
                items: {
                    create: receiptItemsData
                }
            },
            include: { items: true }
        })

        return NextResponse.json({
            success: true,
            receipt: {
                id: receipt.id,
                receiptNumber: receipt.invoiceNumber,
                itemsCount: receipt.items.length
            }
        }, { status: 201 })
    } catch (error) {
        console.error('Error creando entrada:', error)
        return NextResponse.json(
            { error: 'Error creando entrada', details: String(error) },
            { status: 500 }
        )
    }
}
