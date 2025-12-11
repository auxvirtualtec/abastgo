import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ExportPDFOptions {
    title: string
    subtitle?: string
    headers: string[]
    data: (string | number)[][]
    filename?: string
    orientation?: 'portrait' | 'landscape'
    footer?: string
}

/**
 * Genera y descarga un PDF con tabla de datos
 */
export function exportToPDF(options: ExportPDFOptions): void {
    const {
        title,
        subtitle,
        headers,
        data,
        filename = 'reporte',
        orientation = 'portrait',
        footer
    } = options

    const doc = new jsPDF({ orientation })
    const pageWidth = doc.internal.pageSize.getWidth()

    // Logo/Título
    doc.setFontSize(20)
    doc.setTextColor(31, 41, 55) // gray-800
    doc.text('DispenzaBot', 14, 20)

    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128) // gray-500
    doc.text('Sistema de Gestión de Dispensarios', 14, 26)

    // Título del reporte
    doc.setFontSize(16)
    doc.setTextColor(31, 41, 55)
    doc.text(title, 14, 40)

    // Subtítulo (si existe)
    if (subtitle) {
        doc.setFontSize(10)
        doc.setTextColor(107, 114, 128)
        doc.text(subtitle, 14, 47)
    }

    // Fecha de generación
    const now = new Date()
    doc.setFontSize(9)
    doc.text(
        `Generado: ${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString('es-CO')}`,
        pageWidth - 14,
        20,
        { align: 'right' }
    )

    // Tabla
    autoTable(doc, {
        head: [headers],
        body: data,
        startY: subtitle ? 55 : 50,
        headStyles: {
            fillColor: [59, 130, 246], // blue-500
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold'
        },
        bodyStyles: {
            fontSize: 8,
            textColor: [31, 41, 55]
        },
        alternateRowStyles: {
            fillColor: [249, 250, 251] // gray-50
        },
        margin: { left: 14, right: 14 },
        styles: {
            cellPadding: 3,
            overflow: 'linebreak'
        }
    })

    // Footer
    const pageCount = (doc as any).getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(156, 163, 175) // gray-400

        // Número de página
        doc.text(
            `Página ${i} de ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        )

        // Footer personalizado
        if (footer) {
            doc.text(
                footer,
                14,
                doc.internal.pageSize.getHeight() - 10
            )
        }
    }

    // Descargar
    const dateStr = now.toISOString().split('T')[0]
    doc.save(`${filename}_${dateStr}.pdf`)
}

/**
 * Exportar inventario valorizado a PDF con totales y discriminación por bodega
 */
export function exportInventoryPDF(inventory: any[], warehouseName?: string): void {
    const doc = new jsPDF({ orientation: 'landscape' })
    const pageWidth = doc.internal.pageSize.getWidth()

    // Agrupar por bodega si no hay filtro de bodega
    const byWarehouse: Record<string, any[]> = {}

    for (const item of inventory) {
        const wName = item.warehouseName || item.warehouse?.name || 'Sin Bodega'
        if (!byWarehouse[wName]) {
            byWarehouse[wName] = []
        }
        byWarehouse[wName].push(item)
    }

    // Calcular totales globales
    let grandTotalUnits = 0
    let grandTotalValue = 0

    for (const items of Object.values(byWarehouse)) {
        for (const item of items) {
            const qty = Number(item.quantity || 0)
            const cost = Number(item.unitCost || 0)
            grandTotalUnits += qty
            grandTotalValue += qty * cost
        }
    }

    // Header
    doc.setFontSize(20)
    doc.setTextColor(31, 41, 55)
    doc.text('DispenzaBot', 14, 20)

    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text('Sistema de Gestión de Dispensarios', 14, 26)

    doc.setFontSize(16)
    doc.setTextColor(31, 41, 55)
    doc.text('Reporte de Inventario Valorizado', 14, 40)

    // Subtítulo con totales
    doc.setFontSize(11)
    doc.setTextColor(59, 130, 246) // blue
    const subtitle = warehouseName
        ? `Bodega: ${warehouseName}`
        : `Todas las bodegas (${Object.keys(byWarehouse).length})`
    doc.text(subtitle, 14, 48)

    // Totales globales en header
    doc.setFontSize(10)
    doc.setTextColor(16, 185, 129) // green
    doc.text(`Total Unidades: ${grandTotalUnits.toLocaleString()}`, pageWidth - 100, 40, { align: 'right' })
    doc.text(`Valor Total: $${grandTotalValue.toLocaleString('es-CO', { minimumFractionDigits: 0 })}`, pageWidth - 14, 40, { align: 'right' })

    const now = new Date()
    doc.setFontSize(9)
    doc.setTextColor(107, 114, 128)
    doc.text(
        `Generado: ${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString('es-CO')}`,
        pageWidth - 14,
        20,
        { align: 'right' }
    )

    let startY = 55
    const warehouseNames = Object.keys(byWarehouse).sort()

    // Si es una sola bodega, mostrar tabla simple
    if (warehouseName || warehouseNames.length === 1) {
        const items = inventory
        const headers = ['Código', 'Producto', 'Lote', 'Vencimiento', 'Cantidad', 'Costo Unit.', 'Valor Total']

        const data = items.map(item => [
            item.product?.code || item.productCode || '',
            item.product?.name || item.productName || '',
            item.lotNumber || '-',
            item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('es-CO') : '-',
            (item.quantity || 0).toLocaleString(),
            `$${Number(item.unitCost || 0).toLocaleString()}`,
            `$${(Number(item.quantity || 0) * Number(item.unitCost || 0)).toLocaleString()}`
        ])

        // Agregar fila de totales
        data.push([
            '', '', '', 'TOTAL:',
            grandTotalUnits.toLocaleString(),
            '',
            `$${grandTotalValue.toLocaleString('es-CO')}`
        ])

        autoTable(doc, {
            head: [headers],
            body: data,
            startY,
            headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8, textColor: [31, 41, 55] },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { left: 14, right: 14 },
            didParseCell: (data) => {
                // Resaltar fila de totales
                if (data.row.index === items.length) {
                    data.cell.styles.fontStyle = 'bold'
                    data.cell.styles.fillColor = [219, 234, 254] // blue-100
                }
            }
        })
    } else {
        // Múltiples bodegas - mostrar tabla por bodega con subtotales
        const headers = ['Código', 'Producto', 'Lote', 'Vencimiento', 'Cantidad', 'Costo Unit.', 'Valor Total']

        for (const wName of warehouseNames) {
            const items = byWarehouse[wName]

            // Calcular subtotales de bodega
            let warehouseUnits = 0
            let warehouseValue = 0
            for (const item of items) {
                warehouseUnits += Number(item.quantity || 0)
                warehouseValue += Number(item.quantity || 0) * Number(item.unitCost || 0)
            }

            // Título de bodega
            if (startY > doc.internal.pageSize.getHeight() - 40) {
                doc.addPage()
                startY = 20
            }

            doc.setFontSize(11)
            doc.setTextColor(31, 41, 55)
            doc.setFont('helvetica', 'bold')
            doc.text(`📦 ${wName}`, 14, startY)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(9)
            doc.setTextColor(107, 114, 128)
            doc.text(`${items.length} items | ${warehouseUnits.toLocaleString()} unidades | $${warehouseValue.toLocaleString('es-CO')}`, 14, startY + 5)
            startY += 10

            const data = items.map(item => [
                item.product?.code || item.productCode || '',
                item.product?.name || item.productName || '',
                item.lotNumber || '-',
                item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('es-CO') : '-',
                (item.quantity || 0).toLocaleString(),
                `$${Number(item.unitCost || 0).toLocaleString()}`,
                `$${(Number(item.quantity || 0) * Number(item.unitCost || 0)).toLocaleString()}`
            ])

            // Agregar fila de subtotal
            data.push([
                '', '', '', `Subtotal ${wName}:`,
                warehouseUnits.toLocaleString(),
                '',
                `$${warehouseValue.toLocaleString('es-CO')}`
            ])

            autoTable(doc, {
                head: [headers],
                body: data,
                startY,
                headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8, fontStyle: 'bold' },
                bodyStyles: { fontSize: 7, textColor: [31, 41, 55] },
                alternateRowStyles: { fillColor: [249, 250, 251] },
                margin: { left: 14, right: 14 },
                didParseCell: (data) => {
                    if (data.row.index === items.length) {
                        data.cell.styles.fontStyle = 'bold'
                        data.cell.styles.fillColor = [254, 243, 199] // yellow-100
                    }
                }
            })

            startY = (doc as any).lastAutoTable.finalY + 10
        }

        // Agregar tabla de resumen final
        if (startY > doc.internal.pageSize.getHeight() - 60) {
            doc.addPage()
            startY = 20
        }

        doc.setFontSize(12)
        doc.setTextColor(31, 41, 55)
        doc.setFont('helvetica', 'bold')
        doc.text('RESUMEN POR BODEGA', 14, startY)
        startY += 5

        const summaryData = warehouseNames.map(wName => {
            const items = byWarehouse[wName]
            let units = 0, value = 0
            for (const item of items) {
                units += Number(item.quantity || 0)
                value += Number(item.quantity || 0) * Number(item.unitCost || 0)
            }
            return [wName, items.length.toString(), units.toLocaleString(), `$${value.toLocaleString('es-CO')}`]
        })

        // Fila de gran total
        summaryData.push([
            'TOTAL GENERAL',
            inventory.length.toString(),
            grandTotalUnits.toLocaleString(),
            `$${grandTotalValue.toLocaleString('es-CO')}`
        ])

        autoTable(doc, {
            head: [['Bodega', 'Items', 'Unidades', 'Valor']],
            body: summaryData,
            startY,
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 10, fontStyle: 'bold' },
            bodyStyles: { fontSize: 9, textColor: [31, 41, 55] },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { left: 14, right: 14 },
            didParseCell: (data) => {
                if (data.row.index === warehouseNames.length) {
                    data.cell.styles.fontStyle = 'bold'
                    data.cell.styles.fillColor = [209, 250, 229] // green-100
                    data.cell.styles.fontSize = 10
                }
            }
        })
    }

    // Footer con número de páginas
    const pageCount = (doc as any).getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(156, 163, 175)
        doc.text(
            `Página ${i} de ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        )
    }

    const dateStr = now.toISOString().split('T')[0]
    doc.save(`inventario_valorizado_${dateStr}.pdf`)
}

/**
 * Exportar entregas a PDF
 */
export function exportDeliveriesPDF(deliveries: any[], title?: string): void {
    const headers = ['Fecha', 'Paciente', 'Documento', 'Producto', 'Cantidad', 'Bodega']

    const data = deliveries.map(d => [
        new Date(d.deliveryDate || d.date).toLocaleDateString('es-CO'),
        d.patientName || d.patient?.name || '',
        d.patientDocument || d.patient?.documentNumber || '',
        d.productName || d.items?.[0]?.product?.name || '',
        d.quantity?.toString() || d.items?.reduce((s: number, i: any) => s + i.quantity, 0)?.toString() || '',
        d.warehouseName || d.warehouse?.name || ''
    ])

    exportToPDF({
        title: title || 'Reporte de Entregas',
        headers,
        data,
        filename: 'entregas',
        orientation: 'landscape'
    })
}

/**
 * Exportar kardex a PDF
 */
export function exportKardexPDF(movements: any[], productName?: string): void {
    const headers = ['Fecha', 'Tipo', 'Referencia', 'Producto', 'Entrada', 'Salida', 'Saldo']

    const data = movements.map(m => [
        new Date(m.date).toLocaleDateString('es-CO'),
        m.type,
        m.reference || '',
        m.productName || '',
        m.quantityIn > 0 ? `+${m.quantityIn}` : '',
        m.quantityOut > 0 ? `-${m.quantityOut}` : '',
        m.balance?.toString() || ''
    ])

    exportToPDF({
        title: 'Kardex de Movimientos',
        subtitle: productName ? `Producto: ${productName}` : undefined,
        headers,
        data,
        filename: 'kardex',
        orientation: 'landscape'
    })
}

/**
 * Exportar pendientes a PDF
 */
export function exportPendingPDF(pending: any[]): void {
    const headers = ['Fecha', 'Paciente', 'Documento', 'Producto', 'Cantidad', 'Estado']

    const data = pending.map(p => [
        new Date(p.createdAt).toLocaleDateString('es-CO'),
        p.patient?.name || '',
        p.patient?.documentNumber || '',
        p.product?.name || '',
        p.quantity?.toString() || '',
        p.status || 'PENDING'
    ])

    exportToPDF({
        title: 'Reporte de Pendientes',
        headers,
        data,
        filename: 'pendientes'
    })
}

/**
 * Exportar devoluciones a PDF
 */
export function exportReturnsPDF(returns: any[]): void {
    const headers = ['Nº Devolución', 'Fecha', 'Bodega', 'Motivo', 'Items', 'Unidades']

    const data = returns.map(r => [
        r.returnNumber || '',
        new Date(r.returnDate).toLocaleDateString('es-CO'),
        r.warehouse?.name || r.warehouseName || '',
        r.reason || '',
        r.itemsCount?.toString() || '',
        r.totalUnits?.toString() || ''
    ])

    exportToPDF({
        title: 'Reporte de Devoluciones',
        headers,
        data,
        filename: 'devoluciones'
    })
}
