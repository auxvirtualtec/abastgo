/**
 * Script para importar el catálogo de medicamentos INVIMA desde CSV
 * 
 * Uso: npx tsx scripts/import-invima.ts [--clear]
 * 
 * El script lee el archivo CSV de INVIMA y lo importa a la base de datos
 * usando batches para manejar los ~160,000 registros eficientemente.
 */

import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// Tamaño del batch para inserciones
const BATCH_SIZE = 500

function parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr === '' || dateStr === '01/01/3000') return null

    // Formato esperado: MM/DD/YYYY
    const parts = dateStr.split('/')
    if (parts.length !== 3) return null

    const month = parseInt(parts[0], 10)
    const day = parseInt(parts[1], 10)
    const year = parseInt(parts[2], 10)

    if (isNaN(month) || isNaN(day) || isNaN(year)) return null
    if (year > 2100 || year < 1900) return null

    return new Date(year, month - 1, day)
}

function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
        const char = line[i]

        if (char === '"') {
            inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim())
            current = ''
        } else {
            current += char
        }
    }

    result.push(current.trim())
    return result
}

async function main() {
    console.log('🔗 Conectando a la base de datos...')

    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    const args = process.argv.slice(2)
    const shouldClear = args.includes('--clear')

    const csvPath = path.join(__dirname, '../doc/CÓDIGO_ÚNICO_DE_MEDICAMENTOS_VIGENTES_20251211.csv')

    if (!fs.existsSync(csvPath)) {
        console.error('❌ Archivo CSV no encontrado:', csvPath)
        process.exit(1)
    }

    // Limpiar tabla si se solicita
    if (shouldClear) {
        console.log('🗑️ Limpiando tabla invima_drugs...')
        await prisma.invimaDrug.deleteMany({})
        console.log('✅ Tabla limpiada')
    }

    console.log('🔄 Iniciando importación del catálogo INVIMA...')
    console.log(`📁 Archivo: ${csvPath}`)

    const fileStream = fs.createReadStream(csvPath, { encoding: 'utf-8' })
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    })

    let lineNumber = 0
    let batch: any[] = [] // eslint-disable-line @typescript-eslint/no-explicit-any
    let totalImported = 0
    let totalSkipped = 0
    let headers: string[] = []

    const startTime = Date.now()

    for await (const line of rl) {
        lineNumber++

        // Primera línea = headers
        if (lineNumber === 1) {
            headers = parseCSVLine(line).map(h => h.toLowerCase().replace(/"/g, ''))
            console.log('📋 Headers encontrados:', headers.length)
            continue
        }

        try {
            const values = parseCSVLine(line)

            if (values.length < 10) {
                totalSkipped++
                continue
            }

            const data: Record<string, string> = {}
            headers.forEach((header, index) => {
                data[header] = values[index] || ''
            })

            // Crear CUM único usando expedientecum + consecutivocum
            const expedienteCum = data.expedientecum || data.expediente || ''
            const consecutivoCum = data.consecutivocum || '1'
            const cum = `${expedienteCum}-${consecutivoCum}`

            if (!expedienteCum || cum === '-') {
                totalSkipped++
                continue
            }

            const drug = {
                cum,
                expediente: data.expediente || null,
                producto: data.producto || 'Sin nombre',
                titular: data.titular || null,
                registroSanitario: data.registrosanitario || null,
                fechaExpedicion: parseDate(data.fechaexpedicion),
                fechaVencimiento: parseDate(data.fechavencimiento),
                estadoRegistro: data.estadoregistro || null,
                consecutivoCum: data.consecutivocum || null,
                cantidadCum: data.cantidadcum || null,
                descripcionComercial: data.descripcioncomercial || null,
                estadoCum: data.estadocum || null,
                fechaActivo: parseDate(data.fechaactivo),
                fechaInactivo: parseDate(data.fechainactivo),
                muestraMedica: data.muestramedica?.toLowerCase() === 'si',
                unidad: data.unidad || null,
                atc: data.atc || null,
                descripcionAtc: data.descripcionatc || null,
                viaAdministracion: data.viaadministracion || null,
                concentracion: data.concentracion || null,
                principioActivo: data.principioactivo || null,
                unidadMedida: data.unidadmedida || null,
                cantidad: data.cantidad || null,
                unidadReferencia: data.unidadreferencia || null,
                formaFarmaceutica: data.formafarmaceutica || null,
                nombreRol: data.nombrerol || null,
                tipoRol: data.tiporol || null,
                modalidad: data.modalidad || null,
                ium: data.ium || null,
            }

            batch.push(drug)

            // Procesar batch cuando alcance el tamaño definido
            if (batch.length >= BATCH_SIZE) {
                await processBatch(prisma, batch)
                totalImported += batch.length
                batch = []

                // Mostrar progreso cada 5000 registros
                if (totalImported % 5000 === 0) {
                    const elapsed = (Date.now() - startTime) / 1000
                    const rate = Math.round(totalImported / elapsed)
                    console.log(`✅ Importados: ${totalImported.toLocaleString()} registros (${rate}/seg)`)
                }
            }
        } catch (error) {
            totalSkipped++
        }
    }

    // Procesar registros restantes
    if (batch.length > 0) {
        await processBatch(prisma, batch)
        totalImported += batch.length
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log('\n========================================')
    console.log('✅ Importación completada!')
    console.log(`   📊 Total importados: ${totalImported.toLocaleString()}`)
    console.log(`   ⏭️ Saltados: ${totalSkipped.toLocaleString()}`)
    console.log(`   ⏱️ Tiempo total: ${totalTime} segundos`)
    console.log('========================================\n')

    await prisma.$disconnect()
    await pool.end()
}

async function processBatch(prisma: PrismaClient, batch: any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
    // Insertar en lotes con manejo de duplicados
    for (const drug of batch) {
        try {
            await prisma.invimaDrug.upsert({
                where: { cum: drug.cum },
                update: drug,
                create: drug,
            })
        } catch {
            // Ignorar errores de duplicados silenciosamente
        }
    }
}

main().catch(console.error)
