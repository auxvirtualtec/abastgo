import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import * as fs from 'fs'
import * as path from 'path'

interface CSVRow {
    bodegaCode: string
    bodegaName: string
    itemCode: string
    descripcion: string
    cantidad: number
    costo: number
}

async function main() {
    console.log('🔗 Conectando a la base de datos...')

    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    // Obtener la organización GHG
    const organization = await prisma.organization.findFirst({
        where: { slug: 'ghg-sas' }
    })

    if (!organization) {
        console.error('❌ No se encontró la organización GHG')
        process.exit(1)
    }

    const organizationId = organization.id
    console.log(`✅ Organización: ${organization.name}`)

    // Buscar o crear EPS FOMAG
    let eps = await prisma.ePS.findFirst({
        where: { organizationId, code: 'FOMAG' }
    })

    if (!eps) {
        eps = await prisma.ePS.create({
            data: {
                organizationId,
                code: 'FOMAG',
                name: 'FOMAG',
                hasApi: false
            }
        })
        console.log('✅ EPS FOMAG creada')
    } else {
        console.log('✅ EPS FOMAG encontrada')
    }

    // Leer CSV
    const csvPath = path.join(__dirname, '../doc/Saldos_FOMAG.csv')
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    const lines = csvContent.split('\n').filter(line => line.trim())

    // Saltar header y línea de separación
    const dataLines = lines.slice(2)
    console.log(`📄 Procesando ${dataLines.length} líneas del CSV...`)

    // Parsear CSV
    const rows: CSVRow[] = []
    for (const line of dataLines) {
        const parts = line.split(',')
        if (parts.length >= 7) {
            const bodegaCode = parts[0].trim()
            const bodegaName = parts[1].trim()
            const itemCode = parts[2].trim()
            const descripcion = parts[3].trim()
            const cantidad = parseInt(parts[4].trim()) || 0
            const costo = parseFloat(parts[5].trim()) || 0

            if (cantidad > 0) {
                rows.push({ bodegaCode, bodegaName, itemCode, descripcion, cantidad, costo })
            }
        }
    }

    console.log(`📊 ${rows.length} registros válidos con cantidad > 0`)

    // Agrupar por bodega
    const bodegasUniq = [...new Set(rows.map(r => r.bodegaCode))]
    console.log(`🏭 Bodegas encontradas: ${bodegasUniq.length}`)

    // Crear/actualizar bodegas
    const bodegaMap: Record<string, string> = {}
    for (const bodegaCode of bodegasUniq) {
        const bodegaName = rows.find(r => r.bodegaCode === bodegaCode)?.bodegaName || bodegaCode

        let warehouse = await prisma.warehouse.findFirst({
            where: { organizationId, code: bodegaCode }
        })

        if (!warehouse) {
            warehouse = await prisma.warehouse.create({
                data: {
                    organizationId,
                    epsId: eps.id,
                    code: bodegaCode,
                    name: bodegaName.replace(/_/g, ' '),
                    type: bodegaName.includes('BODEGA') ? 'BODEGA' : 'DISPENSARIO'
                }
            })
            console.log(`  ➕ Bodega creada: ${warehouse.name}`)
        }

        bodegaMap[bodegaCode] = warehouse.id
    }

    // Agrupar por producto
    const productosUniq = [...new Set(rows.map(r => r.itemCode))]
    console.log(`📦 Productos encontrados: ${productosUniq.length}`)

    // Crear/actualizar productos
    const productMap: Record<string, string> = {}
    for (const itemCode of productosUniq) {
        const row = rows.find(r => r.itemCode === itemCode)
        const descripcion = row?.descripcion || `Producto ${itemCode}`

        let product = await prisma.product.findFirst({
            where: { organizationId, code: itemCode }
        })

        if (!product) {
            product = await prisma.product.create({
                data: {
                    organizationId,
                    code: itemCode,
                    name: descripcion === 'NULL' ? `Producto ${itemCode}` : descripcion.trim(),
                    unit: 'Unidad',
                    price: 0
                }
            })
        } else if (product.name === `Producto ${itemCode}` && descripcion !== 'NULL' && descripcion.trim()) {
            // Actualizar nombre si tenemos mejor descripción
            await prisma.product.update({
                where: { id: product.id },
                data: { name: descripcion.trim() }
            })
        }

        productMap[itemCode] = product.id
    }
    console.log(`✅ Productos procesados`)

    // Importar inventario
    // Primero, eliminar inventario existente de estas bodegas para evitar duplicados
    const warehouseIds = Object.values(bodegaMap)
    await prisma.inventory.deleteMany({
        where: { warehouseId: { in: warehouseIds } }
    })
    console.log(`🗑️ Inventario anterior eliminado`)

    // Agrupar por producto+bodega+costo (cada costo diferente es un "lote")
    let importedCount = 0
    const grouped: Record<string, { cantidad: number; costo: number }> = {}

    for (const row of rows) {
        const key = `${row.itemCode}-${row.bodegaCode}-${row.costo.toFixed(2)}`
        if (!grouped[key]) {
            grouped[key] = { cantidad: 0, costo: row.costo }
        }
        grouped[key].cantidad += row.cantidad
    }

    // Crear registros de inventario
    let lotCounter = 0
    for (const [key, data] of Object.entries(grouped)) {
        const [itemCode, bodegaCode, _] = key.split('-')
        const productId = productMap[itemCode]
        const warehouseId = bodegaMap[bodegaCode]

        if (productId && warehouseId && data.cantidad > 0) {
            lotCounter++
            await prisma.inventory.create({
                data: {
                    productId,
                    warehouseId,
                    lotNumber: `IMP-${lotCounter.toString().padStart(5, '0')}`,
                    quantity: data.cantidad,
                    unitCost: data.costo
                }
            })
            importedCount++
        }
    }

    console.log(`\n🎉 Importación completada!`)
    console.log(`   ${Object.keys(bodegaMap).length} bodegas`)
    console.log(`   ${Object.keys(productMap).length} productos`)
    console.log(`   ${importedCount} registros de inventario`)

    await prisma.$disconnect()
    await pool.end()
}

main().catch(console.error)
