import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";

export async function GET() {
    try {
        const filePath = "/Users/haniballecter/Documents/development/dispenzabot/doc/Saldos_EPS (1).csv";
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const lines = fileContent.split("\n").filter(l => l.trim().length > 0);

        // 1. Get Organization "GHG"
        let org = await prisma.organization.findFirst({
            where: {
                name: { contains: "GHG", mode: "insensitive" }
            }
        });

        if (!org) {
            // If GHG doesn't exist, create it as requested
            console.log("Creating GHG Organization...");
            org = await prisma.organization.create({
                data: {
                    name: "GHG",
                    slug: "ghg-sas" // generating a slug
                }
            });
            // We assume there's a user or we let the user Claim it via /api/admin/join if needed.
            // But if the user ALREADY exists, we shouldn't create a new admin.
            // We'll proceed with import.
        }

        // 2. Get/Create EPS
        const epsCode = "EPS001";
        let eps = await prisma.ePS.findFirst({
            where: { organizationId: org.id, code: epsCode }
        });

        if (!eps) {
            eps = await prisma.ePS.create({
                data: {
                    organizationId: org.id,
                    code: epsCode,
                    name: "EPS Familiar",
                    isActive: true
                }
            });
        }

        // 3. Process CSV lines (Skip header)
        const results = {
            targetOrg: org.name,
            processed: 0,
            productsCreated: 0,
            inventoryUpdated: 0,
            errors: [] as string[]
        };

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const cols = line.split(",").map(c => c.trim());
            if (cols.length < 5) continue;

            const bodegaCode = cols[0]; // 44001
            const bodegaName = cols[1]; // RIOHACHA
            const productCode = cols[2]; // 70015

            const qtyStr = cols[4];
            const costStr = cols[5];

            const qty = parseFloat(qtyStr) || 0;
            const cost = parseFloat(costStr) || 0;

            if (!bodegaCode || !productCode) continue;

            try {
                // 4. Get/Create Warehouse
                let warehouse = await prisma.warehouse.findFirst({
                    where: { organizationId: org.id, code: bodegaCode }
                });

                if (!warehouse) {
                    warehouse = await prisma.warehouse.create({
                        data: {
                            organizationId: org.id,
                            code: bodegaCode,
                            name: bodegaName,
                            type: "DISPENSARIO",
                            epsId: eps.id,
                            isActive: true
                        }
                    });
                } else if (!warehouse.epsId) {
                    await prisma.warehouse.update({
                        where: { id: warehouse.id },
                        data: { epsId: eps.id }
                    });
                }

                // 5. Get/Create Product
                let product = await prisma.product.findFirst({
                    where: { organizationId: org.id, code: productCode }
                });

                if (!product) {
                    product = await prisma.product.create({
                        data: {
                            organizationId: org.id,
                            code: productCode,
                            name: `Item ${productCode}`,
                            price: cost,
                            isActive: true
                        }
                    });
                    results.productsCreated++;
                }

                // 6. Update Inventory
                const inv = await prisma.inventory.findFirst({
                    where: { warehouseId: warehouse.id, productId: product.id }
                });

                if (inv) {
                    await prisma.inventory.update({
                        where: { id: inv.id },
                        data: { quantity: inv.quantity + qty }
                    });
                } else {
                    await prisma.inventory.create({
                        data: {
                            warehouseId: warehouse.id,
                            productId: product.id,
                            quantity: qty,
                            unitCost: cost
                        }
                    });
                }
                results.inventoryUpdated++;
                results.processed++;

            } catch (rowError) {
                console.error(`Error row ${i}:`, rowError);
                results.errors.push(`Row ${i}: ${String(rowError)}`);
            }
        }

        return NextResponse.json({ success: true, results, epsId: eps.id });

    } catch (error) {
        console.error("Import Error", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
