// Script to complete migration - delete duplicate EPS and old org
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
    const sourceOrgId = 'cmiynkusx00008m0g0q6u78vo' // Organización Principal (to delete)
    const targetOrgId = 'cmiwk7e9a000z6b0gixsbzmzx' // GHG (destination)

    console.log('=== Completing Migration: Cleanup ===\n')

    // 1. Handle EPS - the EPS is linked to Warehouse, not Inventory directly
    // We need to update warehouse.epsId references to point to GHG's EPS
    const sourceEps = await prisma.ePS.findMany({
        where: { organizationId: sourceOrgId }
    })

    console.log(`Found ${sourceEps.length} EPS in source org`)

    for (const eps of sourceEps) {
        // Check if same code exists in target
        const existingEps = await prisma.ePS.findFirst({
            where: { organizationId: targetOrgId, code: eps.code }
        })

        if (existingEps) {
            // Update warehouses that reference this EPS to use the GHG EPS
            console.log(`  - Merging EPS ${eps.code} (updating warehouse references)`)

            await prisma.warehouse.updateMany({
                where: { epsId: eps.id },
                data: { epsId: existingEps.id }
            })

            // Update patient contracts that reference this EPS
            await prisma.patientContract.updateMany({
                where: { epsId: eps.id },
                data: { epsId: existingEps.id }
            })

            // Update prescriptions that reference this EPS
            await prisma.prescription.updateMany({
                where: { epsId: eps.id },
                data: { epsId: existingEps.id }
            })

            // Delete the duplicate EPS
            await prisma.ePS.delete({ where: { id: eps.id } })
        } else {
            // Move EPS to target org
            console.log(`  - Moving EPS ${eps.code} to GHG`)
            await prisma.ePS.update({
                where: { id: eps.id },
                data: { organizationId: targetOrgId }
            })
        }
    }
    console.log(`✓ Handled ${sourceEps.length} EPS entities`)

    // 2. Update prescriptions org
    const updatedPrescriptions = await prisma.prescription.updateMany({
        where: { organizationId: sourceOrgId },
        data: { organizationId: targetOrgId }
    })
    console.log(`✓ Migrated ${updatedPrescriptions.count} prescriptions to GHG`)

    // 3. Update deliveries
    const updatedDeliveries = await prisma.delivery.updateMany({
        where: { organizationId: sourceOrgId },
        data: { organizationId: targetOrgId }
    })
    console.log(`✓ Migrated ${updatedDeliveries.count} deliveries to GHG`)

    // 4. Update pending items 
    const updatedPendingItems = await prisma.pendingItem.updateMany({
        where: { organizationId: sourceOrgId },
        data: { organizationId: targetOrgId }
    })
    console.log(`✓ Migrated ${updatedPendingItems.count} pending items to GHG`)

    // 5. Update transfers
    const updatedTransfers = await prisma.transfer.updateMany({
        where: { organizationId: sourceOrgId },
        data: { organizationId: targetOrgId }
    })
    console.log(`✓ Migrated ${updatedTransfers.count} transfers to GHG`)

    // 6. Update purchase receipts (via purchaseOrder - need to check)
    // PurchaseReceipt doesn't have organizationId directly, it's through purchaseOrder

    // 7. Update purchase orders
    const updatedPurchaseOrders = await prisma.purchaseOrder.updateMany({
        where: { organizationId: sourceOrgId },
        data: { organizationId: targetOrgId }
    })
    console.log(`✓ Migrated ${updatedPurchaseOrders.count} purchase orders to GHG`)

    // 8. Update suppliers
    // First check for duplicates
    const sourceSuppliers = await prisma.supplier.findMany({
        where: { organizationId: sourceOrgId }
    })

    for (const supplier of sourceSuppliers) {
        const existingSupplier = await prisma.supplier.findFirst({
            where: { organizationId: targetOrgId, code: supplier.code }
        })

        if (existingSupplier) {
            // Update purchase orders to use existing supplier
            await prisma.purchaseOrder.updateMany({
                where: { supplierId: supplier.id },
                data: { supplierId: existingSupplier.id }
            })
            await prisma.supplier.delete({ where: { id: supplier.id } })
            console.log(`  - Merged supplier ${supplier.code}`)
        } else {
            await prisma.supplier.update({
                where: { id: supplier.id },
                data: { organizationId: targetOrgId }
            })
        }
    }
    console.log(`✓ Handled ${sourceSuppliers.length} suppliers`)

    // 9. Update saved reports
    const updatedReports = await prisma.savedReport.updateMany({
        where: { organizationId: sourceOrgId },
        data: { organizationId: targetOrgId }
    })
    console.log(`✓ Migrated ${updatedReports.count} saved reports to GHG`)

    // 10. Update inventory returns
    const updatedReturns = await prisma.inventoryReturn.updateMany({
        where: { organizationId: sourceOrgId },
        data: { organizationId: targetOrgId }
    })
    console.log(`✓ Migrated ${updatedReturns.count} inventory returns to GHG`)

    // 11. Update audit logs
    const updatedAuditLogs = await prisma.auditLog.updateMany({
        where: { organizationId: sourceOrgId },
        data: { organizationId: targetOrgId }
    })
    console.log(`✓ Migrated ${updatedAuditLogs.count} audit logs to GHG`)

    // 12. Update roles
    const updatedRoles = await prisma.role.updateMany({
        where: { organizationId: sourceOrgId },
        data: { organizationId: targetOrgId }
    })
    console.log(`✓ Migrated ${updatedRoles.count} roles to GHG`)

    // 13. Delete memberships from source org
    const deletedMemberships = await prisma.organizationMember.deleteMany({
        where: { organizationId: sourceOrgId }
    })
    console.log(`✓ Removed ${deletedMemberships.count} old memberships`)

    // 14. Check remaining references
    const remainingWarehouses = await prisma.warehouse.count({ where: { organizationId: sourceOrgId } })
    const remainingProducts = await prisma.product.count({ where: { organizationId: sourceOrgId } })
    const remainingPatients = await prisma.patient.count({ where: { organizationId: sourceOrgId } })
    const remainingEps = await prisma.ePS.count({ where: { organizationId: sourceOrgId } })
    const remainingPrescriptions = await prisma.prescription.count({ where: { organizationId: sourceOrgId } })

    console.log(`\nRemaining in source org:`)
    console.log(`  Warehouses: ${remainingWarehouses}`)
    console.log(`  Products: ${remainingProducts}`)
    console.log(`  Patients: ${remainingPatients}`)
    console.log(`  EPS: ${remainingEps}`)
    console.log(`  Prescriptions: ${remainingPrescriptions}`)

    if (remainingWarehouses === 0 && remainingProducts === 0 && remainingPatients === 0 && remainingEps === 0) {
        // 15. Delete the source organization
        try {
            await prisma.organization.delete({
                where: { id: sourceOrgId }
            })
            console.log(`\n✓ Deleted "Organización Principal" organization`)
        } catch (e: any) {
            console.log(`\n⚠ Could not delete org: ${e.message}`)
        }
    } else {
        console.log('\n⚠ Source org still has data, not deleting')
    }

    // Verify final state
    const ghgOrg = await prisma.organization.findUnique({
        where: { id: targetOrgId },
        include: {
            _count: {
                select: {
                    warehouses: true,
                    products: true,
                    patients: true,
                    members: true,
                    eps: true,
                    prescriptions: true
                }
            }
        }
    })

    console.log(`\n=== Final State of GHG ===`)
    console.log(`Warehouses: ${ghgOrg?._count.warehouses}`)
    console.log(`Products: ${ghgOrg?._count.products}`)
    console.log(`Patients: ${ghgOrg?._count.patients}`)
    console.log(`EPS: ${ghgOrg?._count.eps}`)
    console.log(`Prescriptions: ${ghgOrg?._count.prescriptions}`)
    console.log(`Members: ${ghgOrg?._count.members}`)

    console.log('\n✅ Migration completed successfully!')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
