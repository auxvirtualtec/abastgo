import { prisma } from '../src/lib/prisma'

async function main() {
    const eps = await prisma.ePS.findMany()
    const warehouses = await prisma.warehouse.findMany({
        include: { eps: true }
    })

    console.log("EPS Found:", JSON.stringify(eps, null, 2))
    console.log("Warehouses Found:", JSON.stringify(warehouses, null, 2))

    // Also check if any organization exists to attach new entities to
    const orgs = await prisma.organization.findMany()
    console.log("Organizations:", JSON.stringify(orgs, null, 2))
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
