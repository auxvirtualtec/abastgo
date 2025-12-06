import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Generar reportes
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type')
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')
        const warehouseId = searchParams.get('warehouseId')

        if (!type) {
            return NextResponse.json(
                { error: 'El parámetro type es requerido' },
                { status: 400 }
            )
        }

        let data: any[] = []
        let headers: string[] = []

        const dateStart = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1))
        const dateEnd = endDate ? new Date(endDate) : new Date()

        switch (type) {
            case '1604':
                // Reporte 1604 - Dispensación Supersalud
                headers = [
                    'bodega', 'NumeroMovimiento', 'entidad', 'TIPIDEAFIL', 'Identificacion',
                    'NombreCompleto', 'telefono', 'direccion', 'municipio', 'codigo', 'descripcion',
                    'Cantidad_sol', 'cantidad_entregadas', 'fecha', 'Fech_Entrega_efectiva',
                    'Entrega', 'CONTRATO', 'costog', 'Mipres', 'REGIMEN', 'FECHA_FORMULA',
                    'DISPENSO', 'Concentracion', 'FormaFarma', 'medico'
                ]

                const deliveries1604 = await prisma.$queryRaw`
          SELECT 
            w.code as bodega,
            d.id as numero_movimiento,
            p.document_type as tipo_doc,
            p.document_number as identificacion,
            p.name as nombre,
            p.phone as telefono,
            p.address as direccion,
            p.city as municipio,
            pr.code as codigo_producto,
            pr.name as producto,
            di.quantity as cantidad,
            d.delivery_date as fecha_entrega,
            pr.concentration as concentracion,
            pr.presentation as forma_farma,
            di.unit_cost as costo
          FROM deliveries d
          LEFT JOIN warehouses w ON d.warehouse_id = w.id
          LEFT JOIN prescriptions rx ON d.prescription_id = rx.id
          LEFT JOIN patients p ON rx.patient_id = p.id
          LEFT JOIN delivery_items di ON di.delivery_id = d.id
          LEFT JOIN products pr ON di.product_id = pr.id
          WHERE d.delivery_date >= ${dateStart} AND d.delivery_date <= ${dateEnd}
          ${warehouseId ? prisma.$queryRaw`AND d.warehouse_id = ${warehouseId}` : prisma.$queryRaw``}
          ORDER BY d.delivery_date DESC
          LIMIT 10000
        ` as any[]

                data = deliveries1604.map((d: any) => ({
                    bodega: d.bodega || '',
                    NumeroMovimiento: d.numero_movimiento?.substring(0, 10) || '',
                    entidad: '',
                    TIPIDEAFIL: d.tipo_doc || 'CC',
                    Identificacion: d.identificacion || '',
                    NombreCompleto: d.nombre || '',
                    telefono: d.telefono || '',
                    direccion: d.direccion || '',
                    municipio: d.municipio || '',
                    codigo: d.codigo_producto || '',
                    descripcion: d.producto || '',
                    Cantidad_sol: d.cantidad || 0,
                    cantidad_entregadas: d.cantidad || 0,
                    fecha: d.fecha_entrega?.toISOString().split('T')[0] || '',
                    Fech_Entrega_efectiva: d.fecha_entrega?.toISOString().split('T')[0] || '',
                    Entrega: 'Presencial',
                    CONTRATO: 'EVENTO',
                    costog: d.costo || 0,
                    Mipres: '',
                    REGIMEN: 'SUBSIDIADO',
                    FECHA_FORMULA: '',
                    DISPENSO: '',
                    Concentracion: d.concentracion || '',
                    FormaFarma: d.forma_farma || '',
                    medico: ''
                }))
                break

            case '40':
                // Reporte 40 - Entregas
                headers = [
                    'Entidad', 'Acta', 'codigo', 'descripcionitem', 'cantidad',
                    'Fecha_Entrega', 'hora', 'Tipo_contrato', 'valorven', 'COSTO',
                    'Funcionario_Entrega', 'Lote', 'Bodega_Entrega', 'Nombre_Bodega_Entrega',
                    'Identificacion', 'NombreCompleto', 'municipio'
                ]

                const deliveries40 = await prisma.$queryRaw`
          SELECT 
            d.id,
            w.code as bodega_code,
            w.name as bodega_name,
            p.document_number,
            p.name as paciente,
            p.city,
            pr.code as producto_code,
            pr.name as producto_name,
            di.quantity,
            di.lot_number,
            di.unit_cost,
            d.delivery_date,
            u.name as funcionario
          FROM deliveries d
          LEFT JOIN warehouses w ON d.warehouse_id = w.id
          LEFT JOIN prescriptions rx ON d.prescription_id = rx.id
          LEFT JOIN patients p ON rx.patient_id = p.id
          LEFT JOIN delivery_items di ON di.delivery_id = d.id
          LEFT JOIN products pr ON di.product_id = pr.id
          LEFT JOIN users u ON d.delivered_by_id = u.id
          WHERE d.delivery_date >= ${dateStart} AND d.delivery_date <= ${dateEnd}
          ORDER BY d.delivery_date DESC
          LIMIT 10000
        ` as any[]

                data = deliveries40.map((d: any) => ({
                    Entidad: '',
                    Acta: d.id?.substring(0, 10) || '',
                    codigo: d.producto_code || '',
                    descripcionitem: d.producto_name || '',
                    cantidad: d.quantity || 0,
                    Fecha_Entrega: d.delivery_date?.toISOString().split('T')[0] || '',
                    hora: d.delivery_date?.toISOString() || '',
                    Tipo_contrato: 'EVENTO',
                    valorven: (d.quantity || 0) * (d.unit_cost || 0),
                    COSTO: d.unit_cost || 0,
                    Funcionario_Entrega: d.funcionario || '',
                    Lote: d.lot_number || '',
                    Bodega_Entrega: d.bodega_code || '',
                    Nombre_Bodega_Entrega: d.bodega_name || '',
                    Identificacion: d.document_number || '',
                    NombreCompleto: d.paciente || '',
                    municipio: d.city || ''
                }))
                break

            case 'pendientes':
                // Reporte Pendientes
                headers = [
                    'bodega', 'BODEGA', 'codigo', 'descripcion', 'cantidad',
                    'fecha', 'pendientes', 'tipopen', 'AfCodigo', 'NombreCompleto', 'TELEFONO'
                ]

                const pending = await prisma.$queryRaw`
          SELECT 
            w.code as bodega_code,
            w.name as bodega_name,
            pr.code as producto_code,
            pr.name as producto_name,
            pi.quantity,
            pi.created_at,
            pi.status,
            p.document_number,
            p.name as paciente,
            p.phone
          FROM pending_items pi
          LEFT JOIN warehouses w ON pi.warehouse_id = w.id
          LEFT JOIN prescription_items pxi ON pi.prescription_item_id = pxi.id
          LEFT JOIN products pr ON pxi.product_id = pr.id
          LEFT JOIN prescriptions rx ON pxi.prescription_id = rx.id
          LEFT JOIN patients p ON rx.patient_id = p.id
          WHERE pi.status IN ('PENDING', 'NOTIFIED')
          ORDER BY pi.created_at DESC
        ` as any[]

                data = pending.map((p: any) => ({
                    bodega: p.bodega_code || '',
                    BODEGA: p.bodega_name || '',
                    codigo: p.producto_code || '',
                    descripcion: p.producto_name || '',
                    cantidad: p.quantity || 0,
                    fecha: p.created_at?.toISOString().split('T')[0] || '',
                    pendientes: p.quantity || 0,
                    tipopen: 'Pendiente por desabastecimiento',
                    AfCodigo: p.document_number || '',
                    NombreCompleto: p.paciente || '',
                    TELEFONO: p.phone || ''
                }))
                break

            case 'cierre_diario':
                // Cierre de Caja Diario por Bodega
                headers = [
                    'fecha', 'bodega', 'nombre_bodega', 'total_entregas', 'total_items',
                    'total_unidades', 'valor_total', 'cuota_moderadora', 'pacientes_atendidos'
                ]

                const cierreDiario = await prisma.$queryRaw`
          SELECT 
            DATE(d.delivery_date) as fecha,
            w.code as bodega,
            w.name as nombre_bodega,
            COUNT(DISTINCT d.id) as total_entregas,
            COUNT(di.id) as total_items,
            COALESCE(SUM(di.quantity), 0) as total_unidades,
            COALESCE(SUM(di.quantity * di.unit_cost), 0) as valor_total,
            COALESCE(SUM(d.moderator_fee), 0) as cuota_moderadora,
            COUNT(DISTINCT rx.patient_id) as pacientes_atendidos
          FROM deliveries d
          LEFT JOIN warehouses w ON d.warehouse_id = w.id
          LEFT JOIN delivery_items di ON di.delivery_id = d.id
          LEFT JOIN prescriptions rx ON d.prescription_id = rx.id
          WHERE d.delivery_date >= ${dateStart} AND d.delivery_date <= ${dateEnd}
          ${warehouseId ? prisma.$queryRaw`AND d.warehouse_id = ${warehouseId}` : prisma.$queryRaw``}
          GROUP BY DATE(d.delivery_date), w.code, w.name
          ORDER BY fecha DESC, nombre_bodega
        ` as any[]

                data = cierreDiario.map((c: any) => ({
                    fecha: c.fecha?.toISOString().split('T')[0] || '',
                    bodega: c.bodega || '',
                    nombre_bodega: c.nombre_bodega || '',
                    total_entregas: Number(c.total_entregas) || 0,
                    total_items: Number(c.total_items) || 0,
                    total_unidades: Number(c.total_unidades) || 0,
                    valor_total: Math.round(Number(c.valor_total) || 0),
                    cuota_moderadora: Math.round(Number(c.cuota_moderadora) || 0),
                    pacientes_atendidos: Number(c.pacientes_atendidos) || 0
                }))
                break

            case 'cierre_mensual':
                // Cierre Mensual por Bodega
                headers = [
                    'año', 'mes', 'bodega', 'nombre_bodega', 'total_entregas', 'total_items',
                    'total_unidades', 'valor_total', 'promedio_diario', 'dias_con_entregas'
                ]

                const cierreMensual = await prisma.$queryRaw`
          SELECT 
            EXTRACT(YEAR FROM d.delivery_date) as año,
            EXTRACT(MONTH FROM d.delivery_date) as mes,
            w.code as bodega,
            w.name as nombre_bodega,
            COUNT(DISTINCT d.id) as total_entregas,
            COUNT(di.id) as total_items,
            COALESCE(SUM(di.quantity), 0) as total_unidades,
            COALESCE(SUM(di.quantity * di.unit_cost), 0) as valor_total,
            COUNT(DISTINCT DATE(d.delivery_date)) as dias_con_entregas
          FROM deliveries d
          LEFT JOIN warehouses w ON d.warehouse_id = w.id
          LEFT JOIN delivery_items di ON di.delivery_id = d.id
          WHERE d.delivery_date >= ${dateStart} AND d.delivery_date <= ${dateEnd}
          ${warehouseId ? prisma.$queryRaw`AND d.warehouse_id = ${warehouseId}` : prisma.$queryRaw``}
          GROUP BY EXTRACT(YEAR FROM d.delivery_date), EXTRACT(MONTH FROM d.delivery_date), w.code, w.name
          ORDER BY año DESC, mes DESC, nombre_bodega
        ` as any[]

                data = cierreMensual.map((c: any) => ({
                    año: Number(c.año) || 0,
                    mes: Number(c.mes) || 0,
                    bodega: c.bodega || '',
                    nombre_bodega: c.nombre_bodega || '',
                    total_entregas: Number(c.total_entregas) || 0,
                    total_items: Number(c.total_items) || 0,
                    total_unidades: Number(c.total_unidades) || 0,
                    valor_total: Math.round(Number(c.valor_total) || 0),
                    promedio_diario: Math.round((Number(c.total_entregas) || 0) / (Number(c.dias_con_entregas) || 1)),
                    dias_con_entregas: Number(c.dias_con_entregas) || 0
                }))
                break

            case 'inventario_valorizado':
                // Inventario Valorizado
                headers = [
                    'bodega', 'nombre_bodega', 'codigo', 'producto', 'molecula',
                    'lote', 'fecha_vencimiento', 'cantidad', 'costo_unitario', 'valor_total'
                ]

                const inventario = await prisma.inventory.findMany({
                    where: {
                        quantity: { gt: 0 },
                        ...(warehouseId && { warehouseId })
                    },
                    include: {
                        product: true,
                        warehouse: true
                    },
                    orderBy: [
                        { warehouse: { name: 'asc' } },
                        { product: { name: 'asc' } }
                    ]
                })

                data = inventario.map(inv => ({
                    bodega: inv.warehouse?.code || '',
                    nombre_bodega: inv.warehouse?.name || '',
                    codigo: inv.product?.code || '',
                    producto: inv.product?.name || '',
                    molecula: inv.product?.molecule || '',
                    lote: inv.lotNumber || '',
                    fecha_vencimiento: inv.expiryDate?.toISOString().split('T')[0] || '',
                    cantidad: inv.quantity,
                    costo_unitario: Number(inv.unitCost) || 0,
                    valor_total: inv.quantity * (Number(inv.unitCost) || 0)
                }))
                break

            case 'vencimientos':
                // Próximos Vencimientos (90 días)
                headers = [
                    'bodega', 'nombre_bodega', 'codigo', 'producto', 'lote',
                    'fecha_vencimiento', 'dias_para_vencer', 'cantidad', 'valor_en_riesgo', 'estado'
                ]

                const hoy = new Date()
                const en90dias = new Date()
                en90dias.setDate(en90dias.getDate() + 90)

                const vencimientos = await prisma.inventory.findMany({
                    where: {
                        quantity: { gt: 0 },
                        expiryDate: { lte: en90dias },
                        ...(warehouseId && { warehouseId })
                    },
                    include: {
                        product: true,
                        warehouse: true
                    },
                    orderBy: { expiryDate: 'asc' }
                })

                data = vencimientos.map(inv => {
                    const diasVencer = inv.expiryDate
                        ? Math.ceil((inv.expiryDate.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
                        : 999

                    return {
                        bodega: inv.warehouse?.code || '',
                        nombre_bodega: inv.warehouse?.name || '',
                        codigo: inv.product?.code || '',
                        producto: inv.product?.name || '',
                        lote: inv.lotNumber || '',
                        fecha_vencimiento: inv.expiryDate?.toISOString().split('T')[0] || '',
                        dias_para_vencer: diasVencer,
                        cantidad: inv.quantity,
                        valor_en_riesgo: inv.quantity * (Number(inv.unitCost) || 0),
                        estado: diasVencer <= 0 ? 'VENCIDO' : diasVencer <= 30 ? 'CRITICO' : diasVencer <= 60 ? 'ALERTA' : 'PROXIMO'
                    }
                })
                break

            case 'resumen_bodega':
                // Resumen General por Bodega
                headers = [
                    'codigo_bodega', 'nombre_bodega', 'tipo', 'total_productos', 'total_unidades',
                    'valor_inventario', 'productos_stock_bajo', 'productos_por_vencer'
                ]

                const bodegas = await prisma.warehouse.findMany({
                    where: { isActive: true },
                    include: {
                        inventory: { where: { quantity: { gt: 0 } } }
                    }
                })

                const en30dias = new Date()
                en30dias.setDate(en30dias.getDate() + 30)

                data = bodegas.map(w => {
                    const totalUnidades = w.inventory.reduce((sum, i) => sum + i.quantity, 0)
                    const valorInventario = w.inventory.reduce((sum, i) => sum + (i.quantity * Number(i.unitCost)), 0)
                    const stockBajo = w.inventory.filter(i => i.quantity <= 10).length
                    const porVencer = w.inventory.filter(i => i.expiryDate && i.expiryDate <= en30dias).length

                    return {
                        codigo_bodega: w.code,
                        nombre_bodega: w.name,
                        tipo: w.type,
                        total_productos: w.inventory.length,
                        total_unidades: totalUnidades,
                        valor_inventario: Math.round(valorInventario),
                        productos_stock_bajo: stockBajo,
                        productos_por_vencer: porVencer
                    }
                }).sort((a, b) => b.valor_inventario - a.valor_inventario)
                break

            case 'entregas_paciente':
                // Historial de Entregas por Paciente
                headers = [
                    'documento', 'paciente', 'telefono', 'ciudad', 'total_visitas',
                    'total_productos', 'valor_total', 'ultima_visita'
                ]

                const pacientes = await prisma.$queryRaw`
          SELECT 
            p.document_number,
            p.name,
            p.phone,
            p.city,
            COUNT(DISTINCT d.id) as total_visitas,
            COUNT(di.id) as total_productos,
            COALESCE(SUM(di.quantity * di.unit_cost), 0) as valor_total,
            MAX(d.delivery_date) as ultima_visita
          FROM patients p
          LEFT JOIN prescriptions rx ON rx.patient_id = p.id
          LEFT JOIN deliveries d ON d.prescription_id = rx.id
          LEFT JOIN delivery_items di ON di.delivery_id = d.id
          WHERE d.delivery_date >= ${dateStart} AND d.delivery_date <= ${dateEnd}
          GROUP BY p.id, p.document_number, p.name, p.phone, p.city
          ORDER BY total_visitas DESC
          LIMIT 5000
        ` as any[]

                data = pacientes.map((p: any) => ({
                    documento: p.document_number || '',
                    paciente: p.name || '',
                    telefono: p.phone || '',
                    ciudad: p.city || '',
                    total_visitas: Number(p.total_visitas) || 0,
                    total_productos: Number(p.total_productos) || 0,
                    valor_total: Math.round(Number(p.valor_total) || 0),
                    ultima_visita: p.ultima_visita?.toISOString().split('T')[0] || ''
                }))
                break

            case 'consumo_producto':
                // Consumo por Producto
                headers = [
                    'codigo', 'producto', 'molecula', 'presentacion', 'total_dispensado',
                    'total_entregas', 'valor_total'
                ]

                const consumo = await prisma.$queryRaw`
          SELECT 
            pr.code,
            pr.name,
            pr.molecule,
            pr.presentation,
            COALESCE(SUM(di.quantity), 0) as total_dispensado,
            COUNT(di.id) as total_entregas,
            COALESCE(SUM(di.quantity * di.unit_cost), 0) as valor_total
          FROM products pr
          LEFT JOIN delivery_items di ON di.product_id = pr.id
          LEFT JOIN deliveries d ON di.delivery_id = d.id
          WHERE d.delivery_date >= ${dateStart} AND d.delivery_date <= ${dateEnd}
          GROUP BY pr.id, pr.code, pr.name, pr.molecule, pr.presentation
          ORDER BY total_dispensado DESC
          LIMIT 1000
        ` as any[]

                data = consumo.map((c: any) => ({
                    codigo: c.code || '',
                    producto: c.name || '',
                    molecula: c.molecule || '',
                    presentacion: c.presentation || '',
                    total_dispensado: Number(c.total_dispensado) || 0,
                    total_entregas: Number(c.total_entregas) || 0,
                    valor_total: Math.round(Number(c.valor_total) || 0)
                }))
                break

            case 'traslados':
                // Reporte de Traslados
                headers = [
                    'numero', 'fecha', 'bodega_origen', 'bodega_destino', 'estado',
                    'total_items', 'observaciones'
                ]

                const traslados = await prisma.transfer.findMany({
                    where: {
                        createdAt: { gte: dateStart, lte: dateEnd }
                    },
                    include: {
                        fromWarehouse: true,
                        toWarehouse: true,
                        items: true
                    },
                    orderBy: { createdAt: 'desc' }
                })

                data = traslados.map(t => ({
                    numero: t.transferNumber,
                    fecha: t.createdAt.toISOString().split('T')[0],
                    bodega_origen: t.fromWarehouse?.name || '',
                    bodega_destino: t.toWarehouse?.name || '',
                    estado: t.status,
                    total_items: t.items.length,
                    observaciones: t.notes || ''
                }))
                break

            default:
                return NextResponse.json(
                    { error: `Tipo de reporte no válido: ${type}` },
                    { status: 400 }
                )
        }

        return NextResponse.json({
            type,
            headers,
            data,
            count: data.length,
            generatedAt: new Date().toISOString()
        })
    } catch (error) {
        console.error('Error generando reporte:', error)
        return NextResponse.json(
            { error: 'Error generando reporte', details: String(error) },
            { status: 500 }
        )
    }
}
