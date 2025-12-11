
import dotenv from 'dotenv'
dotenv.config()

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
// @ts-ignore
import { PrismaClient } from '../src/generated/prisma/client.ts'

async function main() {
    console.log('--- Checking Database State ---')
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    try {
        // 1. Check Organizations
        const orgs = await prisma.organization.findMany()
        console.log(`Organizations found: ${orgs.length}`)
        orgs.forEach(o => console.log(` - ID: ${o.id}, Name: ${o.name}, Slug: ${o.slug}`))

        // 2. Check Users
        const users = await prisma.user.findMany({ include: { memberships: true } })
        console.log(`Users found: ${users.length}`)
        users.forEach(u => console.log(` - Email: ${u.email}, Orgs: ${u.memberships.length}`))

        // 3. Check Products (sample)
        const products = await prisma.product.findMany({ take: 5 })
        console.log(`Products found (sample 5):`)
        products.forEach(p => console.log(` - Code: ${p.code}, OrgID: ${p.organizationId}`))

    } catch (e) {
        console.error("Error checking DB:", e)
    } finally {
        await prisma.$disconnect()
        await pool.end()
    }
}

main()
