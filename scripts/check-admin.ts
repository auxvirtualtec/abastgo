import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import bcrypt from 'bcryptjs'

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  // Find super admin
  const superAdmin = await prisma.user.findFirst({
    where: { isSuperAdmin: true }
  })

  console.log('Super Admin found:', !!superAdmin)
  if (superAdmin) {
    console.log('Email:', superAdmin.email)
    console.log('Name:', superAdmin.name)
  }

  // Check admin user
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@abastgo.com' },
    include: {
      memberships: true,
      warehouseUsers: { select: { warehouseId: true } }
    }
  })

  console.log('\nAdmin user:')
  console.log('  Found:', !!admin)
  console.log('  Has passwordHash:', !!admin?.passwordHash)
  console.log('  Memberships:', admin?.memberships?.length || 0)
  console.log('  WarehouseUsers:', admin?.warehouseUsers?.length || 0)

  // Test password
  if (admin?.passwordHash) {
    const isValid = await bcrypt.compare('admin123', admin.passwordHash)
    console.log('  Password "admin123" valid:', isValid)
  }

  await prisma.$disconnect()
  await pool.end()
}

main().catch(console.error)
