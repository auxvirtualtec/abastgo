import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import bcrypt from 'bcryptjs'

async function main() {
    console.log('🔗 Conectando a:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'))

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    console.log('🌱 Iniciando seed de datos...')

    // Crear Organización por defecto
    const defaultOrgSlug = 'default-org'
    console.log(`🏢 Buscando/Creando organización por defecto (${defaultOrgSlug})...`)
    const organization = await prisma.organization.upsert({
        where: { slug: defaultOrgSlug },
        update: {},
        create: {
            name: 'Organización Principal',
            slug: defaultOrgSlug,
            stripeCustomerId: 'cus_seed_placeholder'
        }
    })
    const organizationId = organization.id
    console.log(`✅ Organización lista: ${organization.name}`)

    // Crear permisos (Globales o de Org?)
    // Vamos a crearlos como Globales (organizationId: null) para este seed base
    // Pero unique constraint requiere organizationId_code.
    // Upsert con null en organizationId debería funcionar si se permite.
    // Si no, los creamos para la org por defecto. Probemos Globales.

    // NOTA: Si el tipo TypeScript falla con null, usaremos organizationId.
    // Asumiremos que Permissions son Globales (null) para el sistema base.

    const permissions = [
        { code: 'all', module: 'system', description: 'Acceso total al sistema' },
        { code: 'users.view', module: 'users', description: 'Ver usuarios' },
        { code: 'users.create', module: 'users', description: 'Crear usuarios' },
        { code: 'users.edit', module: 'users', description: 'Editar usuarios' },
        { code: 'products.view', module: 'products', description: 'Ver productos' },
        { code: 'products.create', module: 'products', description: 'Crear productos' },
        { code: 'products.edit', module: 'products', description: 'Editar productos' },
        { code: 'inventory.view', module: 'inventory', description: 'Ver inventario' },
        { code: 'inventory.edit', module: 'inventory', description: 'Modificar inventario' },
        { code: 'warehouses.view', module: 'warehouses', description: 'Ver bodegas' },
        { code: 'warehouses.edit', module: 'warehouses', description: 'Editar bodegas' },
        { code: 'patients.view', module: 'patients', description: 'Ver pacientes' },
        { code: 'patients.create', module: 'patients', description: 'Crear pacientes' },
        { code: 'deliveries.view', module: 'deliveries', description: 'Ver entregas' },
        { code: 'deliveries.create', module: 'deliveries', description: 'Crear entregas' },
        { code: 'purchases.view', module: 'purchases', description: 'Ver compras' },
        { code: 'purchases.create', module: 'purchases', description: 'Crear compras' },
        { code: 'transfers.view', module: 'transfers', description: 'Ver traslados' },
        { code: 'transfers.create', module: 'transfers', description: 'Crear traslados' },
        { code: 'pending.view', module: 'pending', description: 'Ver pendientes' },
        { code: 'reports.view', module: 'reports', description: 'Ver reportes' },
        { code: 'audit.view', module: 'audit', description: 'Ver auditoría' },
    ]

    for (const perm of permissions) {
        // Probamos creando permisos globales (organizationId: null es válido en schema?)
        // Schema: organizationId String? @map("organization_id")
        // @@unique([organizationId, code])
        // Prisma types allow null for optional fields implicitly but compound keys handling with null varies.
        // Vamos a asignarlos a la Organización por defecto para evitar problemas de tipos si 'null' es tricky en where compound.

        await prisma.permission.upsert({
            where: {
                organizationId_code: {
                    organizationId,
                    code: perm.code
                }
            },
            update: {},
            create: {
                organizationId,
                ...perm
            },
        })
    }
    console.log('✅ Permisos creados')

    // Crear roles (Ahora vinculados a Organization)
    const roleData = [
        { name: 'admin', description: 'Administrador del sistema' },
        { name: 'dispensador', description: 'Dispensador de medicamentos' },
        { name: 'bodega', description: 'Personal de bodega' }
    ]

    const rolesMap: Record<string, any> = {}

    for (const r of roleData) {
        const role = await prisma.role.upsert({
            where: {
                organizationId_name: {
                    organizationId,
                    name: r.name
                }
            },
            update: {},
            create: {
                organizationId,
                name: r.name,
                description: r.description,
            },
        })
        rolesMap[r.name] = role
    }
    console.log('✅ Roles creados')

    // Asignar permisos a rol admin
    // Buscamos el permiso 'all' de ESTA organización
    const allPermission = await prisma.permission.findUnique({
        where: {
            organizationId_code: {
                organizationId,
                code: 'all'
            }
        }
    })

    if (allPermission && rolesMap['admin']) {
        await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: rolesMap['admin'].id,
                    permissionId: allPermission.id,
                },
            },
            update: {},
            create: {
                roleId: rolesMap['admin'].id,
                permissionId: allPermission.id,
            },
        })
    }
    console.log('✅ Permisos asignados a roles')

    // Crear usuario admin
    const passwordHash = await bcrypt.hash('admin123', 10)
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@abastgo.com' },
        update: {},
        create: {
            email: 'admin@abastgo.com',
            passwordHash,
            name: 'Administrador',
            phone: '+57 300 123 4567',
            isActive: true,
        },
    })

    // Asignar Membresía (OrganizationMember) como OWNER
    await prisma.organizationMember.upsert({
        where: {
            organizationId_userId: {
                organizationId,
                userId: adminUser.id
            }
        },
        update: {},
        create: {
            organizationId,
            userId: adminUser.id,
            role: 'OWNER' // MemberRole enum
        }
    })

    // Asignar rol admin (Legacy/Granular) al usuario
    if (rolesMap['admin']) {
        await prisma.userRole.upsert({
            where: {
                userId_roleId: {
                    userId: adminUser.id,
                    roleId: rolesMap['admin'].id,
                },
            },
            update: {},
            create: {
                userId: adminUser.id,
                roleId: rolesMap['admin'].id,
            },
        })
    }
    console.log('✅ Usuario admin creado y asignado a organización')

    // Crear EPS de ejemplo
    const eps = [
        { code: 'EPS001', name: 'Nueva EPS', hasApi: false },
        { code: 'EPS002', name: 'Sura EPS', hasApi: false },
        { code: 'EPS003', name: 'Sanitas', hasApi: false },
        { code: 'EPS004', name: 'Compensar', hasApi: false },
        { code: 'EPS005', name: 'Familiar de Colombia', hasApi: true, apiEndpoint: 'http://integrationbridge.familiardecolombia.com:5000' },
    ]

    for (const e of eps) {
        await prisma.ePS.upsert({
            where: {
                organizationId_code: {
                    organizationId,
                    code: e.code
                }
            },
            update: {},
            create: {
                organizationId,
                ...e
            },
        })
    }
    console.log('✅ EPS creadas')

    // Crear bodegas de ejemplo
    const bodegas = [
        { code: 'BOD-001', name: 'Bodega Principal', type: 'BODEGA' as const, city: 'Bogotá', address: 'Calle 100 #15-20' },
        { code: 'DIS-001', name: 'Dispensario Centro', type: 'DISPENSARIO' as const, city: 'Bogotá', address: 'Carrera 7 #32-15' },
        { code: 'DIS-002', name: 'Dispensario Norte', type: 'DISPENSARIO' as const, city: 'Bogotá', address: 'Calle 170 #9-50' },
    ]

    for (const bod of bodegas) {
        await prisma.warehouse.upsert({
            where: {
                organizationId_code: {
                    organizationId,
                    code: bod.code
                }
            },
            update: {},
            create: {
                organizationId,
                ...bod
            },
        })
    }
    console.log('✅ Bodegas y dispensarios creados')

    // Crear productos de ejemplo
    const productos = [
        { code: 'MED-001', name: 'Acetaminofén 500mg', molecule: 'Paracetamol', presentation: 'Tabletas', concentration: '500mg', unit: 'Tableta', price: 150 },
        { code: 'MED-002', name: 'Ibuprofeno 400mg', molecule: 'Ibuprofeno', presentation: 'Tabletas', concentration: '400mg', unit: 'Tableta', price: 200 },
        { code: 'MED-003', name: 'Omeprazol 20mg', molecule: 'Omeprazol', presentation: 'Cápsulas', concentration: '20mg', unit: 'Cápsula', price: 350 },
        { code: 'MED-004', name: 'Losartán 50mg', molecule: 'Losartán', presentation: 'Tabletas', concentration: '50mg', unit: 'Tableta', price: 450 },
        { code: 'MED-005', name: 'Metformina 850mg', molecule: 'Metformina', presentation: 'Tabletas', concentration: '850mg', unit: 'Tableta', price: 280 },
    ]

    for (const prod of productos) {
        await prisma.product.upsert({
            where: {
                organizationId_code: {
                    organizationId,
                    code: prod.code
                }
            },
            update: {},
            create: {
                organizationId,
                ...prod
            },
        })
    }
    console.log('✅ Productos de ejemplo creados')

    console.log('\n🎉 Seed completado exitosamente!')
    console.log('\n📋 Credenciales de acceso:')
    console.log('   Email: admin@abastgo.com')
    console.log('   Password: admin123')
    console.log('   Organization: Organización Principal')

    await prisma.$disconnect()
    await pool.end()
}

main()
    .catch((e) => {
        console.error('❌ Error en seed:', e)
        process.exit(1)
    })
