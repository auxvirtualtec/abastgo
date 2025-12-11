import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('Seeding patient...');

    // Obtener o crear organización por defecto
    const defaultOrgSlug = 'seed-org'
    let organization = await prisma.organization.findUnique({
        where: { slug: defaultOrgSlug }
    })

    if (!organization) {
        organization = await prisma.organization.create({
            data: {
                name: 'Seed Organization',
                slug: defaultOrgSlug,
                stripeCustomerId: 'cus_seed_patient_placeholder'
            }
        })
    }
    const organizationId = organization.id

    // Buscar una bodega existente de esta org
    let warehouse = await prisma.warehouse.findFirst({
        where: { organizationId }
    });

    if (!warehouse) {
        // Crear bodega si no existe
        warehouse = await prisma.warehouse.create({
            data: {
                organizationId,
                code: 'SEED-WH',
                name: 'Seed Warehouse',
                type: 'BODEGA',
                isActive: true
            }
        })
    }

    // Buscar EPS
    let eps = await prisma.ePS.findFirst({
        where: { organizationId }
    });
    if (!eps) {
        eps = await prisma.ePS.create({
            data: {
                organizationId,
                code: 'EPS001',
                name: 'EPS Sanitas',
                hasApi: false, // Default
                isActive: true
            }
        });
    }

    // Buscar Producto
    let product = await prisma.product.findFirst({
        where: { organizationId }
    });

    if (!product) {
        // Crear producto dummy si no existe
        product = await prisma.product.create({
            data: {
                organizationId,
                code: 'SEED-MED',
                name: 'Medicamento Prueba',
                price: 100,
                isActive: true
            }
        })
    }

    // Create Patient
    const patient = await prisma.patient.create({
        data: {
            organizationId,
            documentType: 'CC',
            documentNumber: '1020304050',
            name: 'Carlos Andrés Rodríguez',
            address: 'Calle 123 # 45-67',
            phone: '3001234567',
            city: 'Bogotá',
            diagnosis: 'Hipertensión Arterial',
            contracts: {
                create: {
                    epsId: eps.id,
                    startDate: new Date('2023-01-01'),
                    isActive: true,
                    affiliationType: 'COTIZANTE',
                    regime: 'CONTRIBUTIVO'
                }
            },
            prescriptions: {
                create: {
                    organizationId,
                    prescriptionNumber: 'PRE-2024-001',
                    prescriptionDate: new Date(),
                    prescribingDoctor: 'Dr. House',
                    status: 'DELIVERED',
                    epsId: eps.id,
                    items: {
                        create: {
                            productId: product.id,
                            quantity: 30,
                            deliveredQty: 30
                        }
                    },
                    deliveries: {
                        create: {
                            organizationId,
                            warehouseId: warehouse.id,
                            deliveryDate: new Date(),
                            status: 'COMPLETED',
                            deliveredById: (await prisma.user.findFirst())?.id || 'clerk_user', // This might fail if no user exists and foreign key constraint enforces it.
                            items: {
                                create: {
                                    productId: product.id,
                                    quantity: 30
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    console.log('Patient created:', patient.id);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        // No disconnect exported from lib but pool handles it or process exit
        process.exit(0);
    });
