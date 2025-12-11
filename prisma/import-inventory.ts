import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

// Mapeo de EPS por archivo
const EPS_CONFIG = {
    'Saldos_EPS (1).csv': { code: 'EPS-RIOHACHA', name: 'EPS Riohacha' },
    'Saldos_FOMAG.csv': { code: 'FOMAG', name: 'FOMAG' },
    'Saldo de Inventario coosalud.xlsx': { code: 'COOSALUD', name: 'Coosalud' }
}

interface InventoryRow {
    bodegaCode: string
    bodegaName: string
    itemCode: string
    itemDescription: string | null
    quantity: number
    unitCost: number
    totalCost: number
}

function parseCSV(filePath: string): InventoryRow[] {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').filter(line => line.trim())
    const rows: InventoryRow[] = []

    // Saltar encabezado y línea de guiones
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i]
        const parts = line.split(',')

        if (parts.length >= 6) {
            const bodegaCode = parts[0]?.trim()
            const bodegaName = parts[1]?.trim()
            const itemCode = parts[2]?.trim()
            const itemDescription = parts[3]?.trim()
            const quantity = parseFloat(parts[4]?.trim() || '0')
            const unitCost = parseFloat(parts[5]?.trim() || '0')
            const totalCost = parseFloat(parts[6]?.trim() || '0')

            if (bodegaCode && itemCode && quantity > 0) {
                rows.push({
                    bodegaCode,
                    bodegaName,
                    itemCode,
                    itemDescription: itemDescription === 'NULL' ? null : itemDescription,
                    quantity,
                    unitCost,
                    totalCost
                })
            }
        }
    }

    return rows
}

function parseExcel(filePath: string): InventoryRow[] {
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

    const rows: InventoryRow[] = []

    // Buscar la fila de encabezados
    let headerRow = 0
    for (let i = 0; i < Math.min(10, data.length); i++) {
        const row = data[i] as string[]
        if (row && row.some(cell => String(cell).toLowerCase().includes('bodega') || String(cell).toLowerCase().includes('item'))) {
            headerRow = i
            break
        }
    }

    // Procesar datos después del encabezado
    for (let i = headerRow + 1; i < data.length; i++) {
        const row = data[i] as (string | number)[]
        if (!row || row.length < 5) continue

        const bodegaCode = String(row[0] || '').trim()
        const bodegaName = String(row[1] || '').trim()
        const itemCode = String(row[2] || '').trim()
        const itemDescription = String(row[3] || '').trim()
        const quantity = parseFloat(String(row[4] || '0'))
        const unitCost = parseFloat(String(row[5] || '0'))
        const totalCost = parseFloat(String(row[6] || '0'))

        if (bodegaCode && itemCode && quantity > 0) {
            rows.push({
                bodegaCode,
                bodegaName,
                itemCode,
                itemDescription: itemDescription === 'NULL' || !itemDescription ? null : itemDescription,
                quantity,
                unitCost,
                totalCost
            })
        }
    }

    return rows
}

async function main() {
    console.log('🔗 Conectando a la base de datos...')

    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    const docPath = path.join(__dirname, '..', 'doc')
    const files = fs.readdirSync(docPath)

    console.log(`📁 Archivos encontrados: ${files.join(', ')}`)

    let totalImported = 0

    // Obtener o crear organización por defecto para migración
    const defaultOrgSlug = 'system-migration'
    let organization = await prisma.organization.findUnique({
        where: { slug: defaultOrgSlug }
    })

    if (!organization) {
        organization = await prisma.organization.create({
            data: {
                name: 'System Migration Org',
                slug: defaultOrgSlug,
                stripeCustomerId: 'cus_migration_placeholder', // Placeholder
            }
        })
        console.log(`🏢 Organización por defecto creada: ${organization.name}`)
    }
    const organizationId = organization.id

    for (const file of files) {
        const epsConfig = EPS_CONFIG[file as keyof typeof EPS_CONFIG]
        if (!epsConfig) {
            console.log(`⏭️  Saltando archivo no reconocido: ${file}`)
            continue
        }

        console.log(`\n📦 Procesando ${file} (${epsConfig.name})...`)

        // Crear o actualizar EPS
        const eps = await prisma.ePS.upsert({
            where: {
                organizationId_code: {
                    organizationId,
                    code: epsConfig.code
                }
            },
            update: {},
            create: {
                organizationId,
                code: epsConfig.code,
                name: epsConfig.name,
                hasApi: false,
                isActive: true
            }
        })
        console.log(`   ✅ EPS: ${eps.name} (${eps.id})`)

        const filePath = path.join(docPath, file)
        let rows: InventoryRow[] = []

        if (file.endsWith('.csv')) {
            rows = parseCSV(filePath)
        } else if (file.endsWith('.xlsx')) {
            rows = parseExcel(filePath)
        }

        console.log(`   📊 Registros encontrados: ${rows.length}`)

        // Agrupar por bodega y producto
        const groupedByWarehouse = new Map<string, InventoryRow[]>()
        for (const row of rows) {
            const key = row.bodegaCode
            if (!groupedByWarehouse.has(key)) {
                groupedByWarehouse.set(key, [])
            }
            groupedByWarehouse.get(key)!.push(row)
        }

        for (const [bodegaCode, warehouseRows] of groupedByWarehouse) {
            // Crear bodega si no existe
            const warehouseCode = `${epsConfig.code}-${bodegaCode}`
            const warehouseName = `${warehouseRows[0].bodegaName} (${epsConfig.name})`

            const warehouse = await prisma.warehouse.upsert({
                where: {
                    organizationId_code: {
                        organizationId,
                        code: warehouseCode
                    }
                },
                update: {},
                create: {
                    organizationId,
                    code: warehouseCode,
                    name: warehouseName,
                    type: warehouseName.toLowerCase().includes('bodega') ? 'BODEGA' : 'DISPENSARIO',
                    city: warehouseRows[0].bodegaName,
                    isActive: true
                }
            })

            console.log(`   🏢 Bodega: ${warehouse.name}`)

            // Agrupar items del mismo producto
            const productMap = new Map<string, InventoryRow[]>()
            for (const row of warehouseRows) {
                if (!productMap.has(row.itemCode)) {
                    productMap.set(row.itemCode, [])
                }
                productMap.get(row.itemCode)!.push(row)
            }

            for (const [itemCode, itemRows] of productMap) {
                // Crear o buscar producto
                const productCode = `${epsConfig.code}-${itemCode}`
                const description = itemRows.find(r => r.itemDescription)?.itemDescription || `Producto ${itemCode}`

                const product = await prisma.product.upsert({
                    where: {
                        organizationId_code: {
                            organizationId,
                            code: productCode
                        }
                    },
                    update: {},
                    create: {
                        organizationId,
                        code: productCode,
                        name: description,
                        price: itemRows[0].unitCost,
                        isActive: true
                    }
                })

                // Crear inventario para cada lote (mismo producto puede tener diferentes costos)
                for (let i = 0; i < itemRows.length; i++) {
                    const row = itemRows[i]
                    const lotNumber = `${epsConfig.code}-${Date.now()}-${i}`

                    await prisma.inventory.create({
                        data: {
                            productId: product.id,
                            warehouseId: warehouse.id,
                            lotNumber,
                            quantity: Math.round(row.quantity),
                            unitCost: row.unitCost
                        }
                    })
                    totalImported++
                }
            }
        }

        console.log(`   ✅ Importados ${rows.length} registros para ${epsConfig.name}`)
    }

    console.log(`\n🎉 Importación completada!`)
    console.log(`   Total registros importados: ${totalImported}`)

    // Mostrar resumen
    const summary = await prisma.$queryRaw`
    SELECT 
      w.name as bodega,
      COUNT(i.id) as total_items,
      SUM(i.quantity) as total_quantity
    FROM inventory i
    JOIN warehouses w ON i.warehouse_id = w.id
    GROUP BY w.name
    ORDER BY w.name
  `

    console.log('\n📊 Resumen de inventarios:')
    console.table(summary)

    await prisma.$disconnect()
    await pool.end()
}

main().catch(e => {
    console.error('❌ Error:', e)
    process.exit(1)
})
