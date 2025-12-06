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

    // Crear permisos
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
        await prisma.permission.upsert({
            where: { code: perm.code },
            update: {},
            create: perm,
        })
    }
    console.log('✅ Permisos creados')

    // Crear roles
    const adminRole = await prisma.role.upsert({
        where: { name: 'admin' },
        update: {},
        create: {
            name: 'admin',
            description: 'Administrador del sistema',
        },
    })

    const dispensadorRole = await prisma.role.upsert({
        where: { name: 'dispensador' },
        update: {},
        create: {
            name: 'dispensador',
            description: 'Dispensador de medicamentos',
        },
    })

    const bodegaRole = await prisma.role.upsert({
        where: { name: 'bodega' },
        update: {},
        create: {
            name: 'bodega',
            description: 'Personal de bodega',
        },
    })
    console.log('✅ Roles creados')

    // Asignar permisos a roles
    const allPermission = await prisma.permission.findUnique({ where: { code: 'all' } })
    if (allPermission) {
        await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: adminRole.id,
                    permissionId: allPermission.id,
                },
            },
            update: {},
            create: {
                roleId: adminRole.id,
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

    // Asignar rol admin al usuario
    await prisma.userRole.upsert({
        where: {
            userId_roleId: {
                userId: adminUser.id,
                roleId: adminRole.id,
            },
        },
        update: {},
        create: {
            userId: adminUser.id,
            roleId: adminRole.id,
        },
    })
    console.log('✅ Usuario admin creado: admin@abastgo.com / admin123')

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
            where: { code: e.code },
            update: {},
            create: e,
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
            where: { code: bod.code },
            update: {},
            create: bod,
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
            where: { code: prod.code },
            update: {},
            create: prod,
        })
    }
    console.log('✅ Productos de ejemplo creados')

    console.log('\n🎉 Seed completado exitosamente!')
    console.log('\n📋 Credenciales de acceso:')
    console.log('   Email: admin@abastgo.com')
    console.log('   Password: admin123\n')

    await prisma.$disconnect()
    await pool.end()
}

main()
    .catch((e) => {
        console.error('❌ Error en seed:', e)
        process.exit(1)
    })
