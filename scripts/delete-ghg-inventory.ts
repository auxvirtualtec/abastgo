// Script to delete inventory data from GHG organization
import * as dotenv from 'dotenv'
dotenv.config()

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    const ghgOrgId = 'cmiwk7e9a000z6b0gixsbzmzx' // GHG

    console.log('=== Deleting GHG Inventory Data ===\n')

    // Get warehouses in GHG
    const warehouses = await prisma.warehouse.findMany({
        where: { organizationId: ghgOrgId },
        select: { id: true, name: true }
    })

    const warehouseIds = warehouses.map(w => w.id)
    console.log(`Found ${warehouses.length} warehouses in GHG`)

    // Delete inventory items
    const deletedInventory = await prisma.inventory.deleteMany({
        where: { warehouseId: { in: warehouseIds } }
    })
    console.log(`✓ Deleted ${deletedInventory.count} inventory items`)

    // Delete receipt items (linked to inventory)
    const deletedReceiptItems = await prisma.receiptItem.deleteMany({
        where: { receipt: { warehouseId: { in: warehouseIds } } }
    })
    console.log(`✓ Deleted ${deletedReceiptItems.count} receipt items`)

    // Delete purchase receipts
    const deletedReceipts = await prisma.purchaseReceipt.deleteMany({
        where: { warehouseId: { in: warehouseIds } }
    })
    console.log(`✓ Deleted ${deletedReceipts.count} purchase receipts`)

    console.log('\n✅ GHG inventory data deleted successfully!')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
