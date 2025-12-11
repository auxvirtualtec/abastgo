// Quick script to list organizations
import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    const orgs = await prisma.organization.findMany({
        select: { id: true, name: true, slug: true }
    })

    console.log('Organizations:')
    orgs.forEach(o => console.log(`  ${o.name} -> slug: "${o.slug}" -> id: ${o.id}`))

    await prisma.$disconnect()
}

main().catch(console.error)
