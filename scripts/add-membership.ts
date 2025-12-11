// Script to add user membership to organization
import * as dotenv from 'dotenv'
dotenv.config()

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

// Crear pool de conexiones PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
})

// Crear adapter para Prisma
const adapter = new PrismaPg(pool)

// Crear cliente Prisma con el adapter
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...')

    // Add admin@ghg.com to "Organización Principal"
    const userId = 'cmixeow420001yg0gb20047tm' // admin@ghg.com
    const organizationId = 'cmiynkusx00008m0g0q6u78vo' // Organización Principal

    // Check if membership already exists
    const existing = await prisma.organizationMember.findFirst({
        where: { userId, organizationId }
    })

    if (existing) {
        console.log('Membership already exists!')
        return
    }

    // Create membership
    const membership = await prisma.organizationMember.create({
        data: {
            userId,
            organizationId,
            role: 'ADMIN'
        },
        include: {
            user: true,
            organization: true
        }
    })

    console.log('Membership created successfully!')
    console.log(`User: ${membership.user.email}`)
    console.log(`Organization: ${membership.organization.name}`)
    console.log(`Role: ${membership.role}`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
