
import dotenv from 'dotenv'
dotenv.config()

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
// @ts-ignore
import { PrismaClient } from '../src/generated/prisma/client.ts'

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    try {
        console.log('\n=== REPORTE DEL SISTEMA ===\n')

        // 1. Organizations
        const orgs = await prisma.organization.findMany({
            include: {
                _count: { select: { members: true } }
            }
        })

        console.log(`🏢 ORGANIZACIONES (${orgs.length}):`)
        if (orgs.length === 0) console.log("   (No hay organizaciones creadas)")

        for (const org of orgs) {
            console.log(`\n   ► ${org.name}`)
            console.log(`     ID: ${org.id}`)
            console.log(`     Slug: ${org.slug}`)
            console.log(`     Miembros: ${org._count.members}`)
            console.log(`     Link de Acceso: http://localhost:3000/login (Los usuarios entran con su email)`)

            // Get members for this org
            const members = await prisma.organizationMember.findMany({
                where: { organizationId: org.id },
                include: { user: true }
            })

            console.log(`     👤 Usuarios:`)
            members.forEach(m => {
                console.log(`        - ${m.user.name || 'Sin nombre'} (${m.user.email}) [Rol: ${m.role}]`)
            })
        }

        // 2. Users (Total)
        const allUsers = await prisma.user.findMany()
        console.log(`\n\n👥 TODOS LOS USUARIOS REGISTRADOS (${allUsers.length}):`)
        allUsers.forEach(u => {
            console.log(`   - ${u.email} (ID: ${u.id})`)
        })

        console.log('\n\n🔒 NOTA DE SEGURIDAD:')
        console.log('   Las contraseñas están encriptadas y NO se pueden recuperar.')
        console.log('   Si olvidaste una clave, debes resetearla o crear un usuario nuevo.')
        console.log('\n===========================\n')

    } catch (e) {
        console.error("Error generating report:", e)
    } finally {
        await prisma.$disconnect()
        await pool.end()
    }
}

main()
