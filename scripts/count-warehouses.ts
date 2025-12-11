// Quick script to count warehouses by type
import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    const ghg = await prisma.organization.findFirst({ where: { slug: 'ghg-sas' } })
    if (!ghg) { console.log('GHG not found'); return }

    const warehouses = await prisma.warehouse.findMany({
        where: { organizationId: ghg.id },
        select: { id: true, name: true, type: true, code: true }
    })

    const bodegas = warehouses.filter(w => w.type === 'BODEGA')
    const dispensarios = warehouses.filter(w => w.type === 'DISPENSARIO')

    console.log(`\n=== Bodegas en GHG ===`)
    console.log(`Total: ${warehouses.length}`)
    console.log(`- BODEGA: ${bodegas.length}`)
    console.log(`- DISPENSARIO: ${dispensarios.length}`)

    console.log(`\nBODEGAS:`)
    bodegas.forEach(w => console.log(`  - ${w.code}: ${w.name}`))

    console.log(`\nDISPENSARIOS:`)
    dispensarios.forEach(w => console.log(`  - ${w.code}: ${w.name}`))

    // Check inventory
    const inventoryCount = await prisma.inventory.count({
        where: { warehouse: { organizationId: ghg.id } }
    })
    console.log(`\n📦 Total items de inventario: ${inventoryCount}`)

    await prisma.$disconnect()
}

main().catch(console.error)
