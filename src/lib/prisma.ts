// Prisma 7 con Driver Adapter para PostgreSQL
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

function createPrismaClient() {
    // Crear pool de conexiones PostgreSQL
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    })

    // Crear adapter para Prisma
    const adapter = new PrismaPg(pool)

    // Crear cliente Prisma con el adapter
    return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
