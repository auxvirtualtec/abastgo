import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST - Generar reporte personalizado con IA
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { query, startDate, endDate } = body

        if (!query) {
            return NextResponse.json(
                { error: 'Se requiere una descripción del reporte' },
                { status: 400 }
            )
        }

        // Analizar la consulta y generar SQL
        const sqlQuery = generateSQLFromQuery(query, startDate, endDate)

        // Ejecutar la consulta
        let data: any[] = []
        let headers: string[] = []

        try {
            // Ejecutar consulta SQL generada
            const result = await prisma.$queryRawUnsafe(sqlQuery) as any[]

            if (result.length > 0) {
                headers = Object.keys(result[0])
                data = result.map(row => {
                    const cleanRow: any = {}
                    for (const key of headers) {
                        let value = row[key]
                        // Formatear fechas y números
                        if (value instanceof Date) {
                            cleanRow[key] = value.toISOString().split('T')[0]
                        } else if (typeof value === 'bigint') {
                            cleanRow[key] = Number(value)
                        } else {
                            cleanRow[key] = value ?? ''
                        }
                    }
                    return cleanRow
                })
            }
        } catch (sqlError) {
            console.error('Error SQL:', sqlError)
            // Fallback a consulta predeterminada si la generada falla
            return NextResponse.json({
                error: 'No se pudo procesar la consulta. Intenta ser más específico.',
                suggestion: 'Ejemplo: "entregas del mes de noviembre por bodega" o "productos más vendidos"',
                sqlGenerated: sqlQuery
            }, { status: 400 })
        }

        return NextResponse.json({
            query,
            sqlQuery,
            headers,
            data,
            count: data.length,
            generatedAt: new Date().toISOString()
        })
    } catch (error) {
        console.error('Error generando reporte personalizado:', error)
        return NextResponse.json(
            { error: 'Error procesando solicitud', details: String(error) },
            { status: 500 }
        )
    }
}

// Función para generar SQL a partir de consulta en lenguaje natural
function generateSQLFromQuery(query: string, startDate?: string, endDate?: string): string {
    const q = query.toLowerCase()

    const dateFilter = startDate && endDate
        ? `AND d.delivery_date >= '${startDate}' AND d.delivery_date <= '${endDate}'`
        : startDate
            ? `AND d.delivery_date >= '${startDate}'`
            : endDate
                ? `AND d.delivery_date <= '${endDate}'`
                : ''

    // Patrones de consulta comunes

    // Entregas por bodega
    if (q.includes('entreg') && (q.includes('bodega') || q.includes('dispensario'))) {
        return `
      SELECT 
        w.name as bodega,
        COUNT(DISTINCT d.id) as total_entregas,
        COUNT(di.id) as items_entregados,
        COALESCE(SUM(di.quantity), 0) as unidades,
        ROUND(COALESCE(SUM(di.quantity * di.unit_cost), 0)::numeric, 2) as valor_total
      FROM deliveries d
      LEFT JOIN warehouses w ON d.warehouse_id = w.id
      LEFT JOIN delivery_items di ON di.delivery_id = d.id
      WHERE 1=1 ${dateFilter}
      GROUP BY w.name
      ORDER BY total_entregas DESC
      LIMIT 100
    `
    }

    // Productos más vendidos/dispensados
    if ((q.includes('product') || q.includes('medicament')) && (q.includes('vendid') || q.includes('dispens') || q.includes('más') || q.includes('top'))) {
        return `
      SELECT 
        pr.code as codigo,
        pr.name as producto,
        pr.molecule as molecula,
        COALESCE(SUM(di.quantity), 0) as cantidad_total,
        COUNT(DISTINCT d.id) as veces_entregado,
        ROUND(COALESCE(SUM(di.quantity * di.unit_cost), 0)::numeric, 2) as valor_total
      FROM products pr
      LEFT JOIN delivery_items di ON di.product_id = pr.id
      LEFT JOIN deliveries d ON di.delivery_id = d.id
      WHERE 1=1 ${dateFilter}
      GROUP BY pr.id, pr.code, pr.name, pr.molecule
      ORDER BY cantidad_total DESC
      LIMIT 50
    `
    }

    // Pacientes atendidos
    if (q.includes('pacient') && (q.includes('atendid') || q.includes('visit'))) {
        return `
      SELECT 
        p.document_number as documento,
        p.name as paciente,
        p.city as ciudad,
        COUNT(DISTINCT d.id) as total_visitas,
        COUNT(di.id) as productos_recibidos,
        MAX(d.delivery_date) as ultima_visita
      FROM patients p
      LEFT JOIN prescriptions rx ON rx.patient_id = p.id
      LEFT JOIN deliveries d ON d.prescription_id = rx.id
      LEFT JOIN delivery_items di ON di.delivery_id = d.id
      WHERE 1=1 ${dateFilter.replace('d.delivery_date', 'd.delivery_date')}
      GROUP BY p.id, p.document_number, p.name, p.city
      ORDER BY total_visitas DESC
      LIMIT 100
    `
    }

    // Inventario bajo / stock bajo
    if (q.includes('stock') && (q.includes('bajo') || q.includes('poco') || q.includes('agotad'))) {
        return `
      SELECT 
        w.name as bodega,
        pr.code as codigo,
        pr.name as producto,
        i.quantity as stock_actual,
        i.lot_number as lote,
        i.expiry_date as vencimiento
      FROM inventory i
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      LEFT JOIN products pr ON i.product_id = pr.id
      WHERE i.quantity <= 10 AND i.quantity > 0
      ORDER BY i.quantity ASC
      LIMIT 100
    `
    }

    // Vencimientos
    if (q.includes('venc') || q.includes('expir') || q.includes('caduc')) {
        return `
      SELECT 
        w.name as bodega,
        pr.code as codigo,
        pr.name as producto,
        i.lot_number as lote,
        i.quantity as cantidad,
        i.expiry_date as fecha_vencimiento,
        EXTRACT(DAY FROM (i.expiry_date - CURRENT_DATE)) as dias_para_vencer
      FROM inventory i
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      LEFT JOIN products pr ON i.product_id = pr.id
      WHERE i.expiry_date <= CURRENT_DATE + INTERVAL '90 days' AND i.quantity > 0
      ORDER BY i.expiry_date ASC
      LIMIT 100
    `
    }

    // Traslados
    if (q.includes('traslad') || q.includes('movimient')) {
        return `
      SELECT 
        t.transfer_number as numero,
        fw.name as bodega_origen,
        tw.name as bodega_destino,
        t.status as estado,
        COUNT(ti.id) as items,
        t.created_at as fecha
      FROM transfers t
      LEFT JOIN warehouses fw ON t.from_warehouse_id = fw.id
      LEFT JOIN warehouses tw ON t.to_warehouse_id = tw.id
      LEFT JOIN transfer_items ti ON ti.transfer_id = t.id
      WHERE 1=1 ${dateFilter.replace('d.delivery_date', 't.created_at')}
      GROUP BY t.id, t.transfer_number, fw.name, tw.name, t.status, t.created_at
      ORDER BY t.created_at DESC
      LIMIT 100
    `
    }

    // Resumen general por día
    if (q.includes('resum') && (q.includes('día') || q.includes('diari'))) {
        return `
      SELECT 
        DATE(d.delivery_date) as fecha,
        COUNT(DISTINCT d.id) as entregas,
        COUNT(DISTINCT rx.patient_id) as pacientes,
        COUNT(di.id) as items,
        ROUND(COALESCE(SUM(di.quantity * di.unit_cost), 0)::numeric, 2) as valor
      FROM deliveries d
      LEFT JOIN delivery_items di ON di.delivery_id = d.id
      LEFT JOIN prescriptions rx ON d.prescription_id = rx.id
      WHERE 1=1 ${dateFilter}
      GROUP BY DATE(d.delivery_date)
      ORDER BY fecha DESC
      LIMIT 60
    `
    }

    // Resumen por mes
    if (q.includes('resum') && (q.includes('mes') || q.includes('mensual'))) {
        return `
      SELECT 
        EXTRACT(YEAR FROM d.delivery_date) as año,
        EXTRACT(MONTH FROM d.delivery_date) as mes,
        COUNT(DISTINCT d.id) as entregas,
        COUNT(DISTINCT rx.patient_id) as pacientes,
        COUNT(di.id) as items,
        ROUND(COALESCE(SUM(di.quantity * di.unit_cost), 0)::numeric, 2) as valor
      FROM deliveries d
      LEFT JOIN delivery_items di ON di.delivery_id = d.id
      LEFT JOIN prescriptions rx ON d.prescription_id = rx.id
      WHERE 1=1 ${dateFilter}
      GROUP BY EXTRACT(YEAR FROM d.delivery_date), EXTRACT(MONTH FROM d.delivery_date)
      ORDER BY año DESC, mes DESC
      LIMIT 24
    `
    }

    // Inventario valorizado
    if ((q.includes('inventari') || q.includes('stock')) && (q.includes('valor') || q.includes('cost'))) {
        return `
      SELECT 
        w.name as bodega,
        pr.code as codigo,
        pr.name as producto,
        i.lot_number as lote,
        i.quantity as cantidad,
        i.unit_cost as costo_unitario,
        ROUND((i.quantity * i.unit_cost)::numeric, 2) as valor_total
      FROM inventory i
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      LEFT JOIN products pr ON i.product_id = pr.id
      WHERE i.quantity > 0
      ORDER BY valor_total DESC
      LIMIT 200
    `
    }

    // Default: entregas generales
    return `
    SELECT 
      d.id as entrega_id,
      w.name as bodega,
      p.name as paciente,
      p.document_number as documento,
      d.delivery_date as fecha,
      COUNT(di.id) as items,
      ROUND(COALESCE(SUM(di.quantity * di.unit_cost), 0)::numeric, 2) as valor
    FROM deliveries d
    LEFT JOIN warehouses w ON d.warehouse_id = w.id
    LEFT JOIN prescriptions rx ON d.prescription_id = rx.id
    LEFT JOIN patients p ON rx.patient_id = p.id
    LEFT JOIN delivery_items di ON di.delivery_id = d.id
    WHERE 1=1 ${dateFilter}
    GROUP BY d.id, w.name, p.name, p.document_number, d.delivery_date
    ORDER BY d.delivery_date DESC
    LIMIT 100
  `
}
