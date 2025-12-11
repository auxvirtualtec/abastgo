/**
 * Servicio del Bot de Cotizaciones
 * 
 * Funcionalidades:
 * - Enviar solicitudes de cotización a proveedores (email, WhatsApp, API)
 * - Calcular score de proveedores basado en historial
 * - Sugerir el mejor proveedor para una compra
 */

import { prisma } from '@/lib/prisma'
import type { Supplier, Quote, SupplierScore } from '@/generated/prisma'

// Tipos de contacto soportados
export type ContactMethod = 'email' | 'whatsapp' | 'api'

// Pesos para cálculo de score general (total = 100)
const SCORE_WEIGHTS = {
    price: 30,       // Precio más competitivo
    delivery: 25,    // Cumplimiento de entregas
    quality: 20,     // Calidad de productos
    payment: 10,     // Facilidades de pago
    discount: 10,    // Descuentos ofrecidos
    tracking: 5      // Seguimiento/comunicación
}

export interface QuoteRequestData {
    organizationId: string
    items: {
        productId?: string
        invimaDrugId?: string
        description: string
        quantity: number
    }[]
    supplierIds: string[]
    notes?: string
    dueDate?: Date
}

export interface SupplierRecommendation {
    supplier: Supplier
    score: SupplierScore | null
    overallScore: number
    recommendation: string
    pros: string[]
    cons: string[]
}

/**
 * Calcula el score general de un proveedor
 */
export function calculateOverallScore(score: Partial<SupplierScore>): number {
    const priceScore = (score.priceScore || 0) * (SCORE_WEIGHTS.price / 100)
    const deliveryScore = (score.deliveryScore || 0) * (SCORE_WEIGHTS.delivery / 100)
    const qualityScore = (score.qualityScore || 0) * (SCORE_WEIGHTS.quality / 100)
    const paymentScore = (score.paymentScore || 0) * (SCORE_WEIGHTS.payment / 100)
    const discountScore = (score.discountScore || 0) * (SCORE_WEIGHTS.discount / 100)
    const trackingScore = (score.trackingScore || 0) * (SCORE_WEIGHTS.tracking / 100)

    return Math.round(priceScore + deliveryScore + qualityScore + paymentScore + discountScore + trackingScore)
}

/**
 * Actualiza el score de un proveedor basado en una orden/cotización completada
 */
export async function updateSupplierScore(
    supplierId: string,
    metrics: {
        priceCompetitive?: boolean     // ¿El precio fue competitivo vs otras cotizaciones?
        deliveredOnTime?: boolean      // ¿Entregó a tiempo?
        qualityGood?: boolean          // ¿Calidad aceptable?
        paymentFlexible?: boolean      // ¿Ofreció flexibilidad de pago?
        discountOffered?: number       // Porcentaje de descuento ofrecido
        communicationGood?: boolean    // ¿Buena comunicación/seguimiento?
    }
): Promise<SupplierScore> {
    // Obtener o crear score existente
    let score = await prisma.supplierScore.findUnique({
        where: { supplierId }
    })

    if (!score) {
        score = await prisma.supplierScore.create({
            data: {
                supplierId,
                priceScore: 50,
                deliveryScore: 50,
                qualityScore: 50,
                paymentScore: 50,
                discountScore: 50,
                trackingScore: 50,
                overallScore: 50,
                totalOrders: 0,
                onTimeDeliveries: 0
            }
        })
    }

    // Calcular nuevos scores usando promedio ponderado con historial
    // Factor de actualización: valores recientes tienen más peso
    const updateFactor = 0.3 // 30% del nuevo valor, 70% del histórico

    const newScores = {
        priceScore: score.priceScore,
        deliveryScore: score.deliveryScore,
        qualityScore: score.qualityScore,
        paymentScore: score.paymentScore,
        discountScore: score.discountScore,
        trackingScore: score.trackingScore,
        totalOrders: score.totalOrders + 1,
        onTimeDeliveries: score.onTimeDeliveries
    }

    if (metrics.priceCompetitive !== undefined) {
        const newValue = metrics.priceCompetitive ? 100 : 0
        newScores.priceScore = Math.round(score.priceScore * (1 - updateFactor) + newValue * updateFactor)
    }

    if (metrics.deliveredOnTime !== undefined) {
        const newValue = metrics.deliveredOnTime ? 100 : 0
        newScores.deliveryScore = Math.round(score.deliveryScore * (1 - updateFactor) + newValue * updateFactor)
        if (metrics.deliveredOnTime) {
            newScores.onTimeDeliveries++
        }
    }

    if (metrics.qualityGood !== undefined) {
        const newValue = metrics.qualityGood ? 100 : 0
        newScores.qualityScore = Math.round(score.qualityScore * (1 - updateFactor) + newValue * updateFactor)
    }

    if (metrics.paymentFlexible !== undefined) {
        const newValue = metrics.paymentFlexible ? 100 : 0
        newScores.paymentScore = Math.round(score.paymentScore * (1 - updateFactor) + newValue * updateFactor)
    }

    if (metrics.discountOffered !== undefined) {
        // Convertir % de descuento a score (0% = 0, 10%+ = 100)
        const newValue = Math.min(100, metrics.discountOffered * 10)
        newScores.discountScore = Math.round(score.discountScore * (1 - updateFactor) + newValue * updateFactor)
    }

    if (metrics.communicationGood !== undefined) {
        const newValue = metrics.communicationGood ? 100 : 0
        newScores.trackingScore = Math.round(score.trackingScore * (1 - updateFactor) + newValue * updateFactor)
    }

    // Calcular score general
    const overallScore = calculateOverallScore(newScores)

    // Actualizar en DB
    return prisma.supplierScore.update({
        where: { supplierId },
        data: {
            ...newScores,
            overallScore
        }
    })
}

/**
 * Obtiene recomendaciones de proveedores para una compra
 */
export async function getSupplierRecommendations(
    organizationId: string,
    productIds?: string[]
): Promise<SupplierRecommendation[]> {
    // Obtener proveedores activos con sus scores
    const suppliers = await prisma.supplier.findMany({
        where: {
            organizationId,
            isActive: true
        },
        include: {
            score: true,
            purchaseOrders: {
                take: 10,
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    // Generar recomendaciones
    const recommendations: SupplierRecommendation[] = suppliers.map(supplier => {
        const score = supplier.score
        const overallScore = score?.overallScore || 50

        const pros: string[] = []
        const cons: string[] = []

        // Analizar fortalezas y debilidades
        if (score) {
            if (score.priceScore >= 70) pros.push('Precios competitivos')
            else if (score.priceScore < 40) cons.push('Precios altos')

            if (score.deliveryScore >= 70) pros.push('Entregas puntuales')
            else if (score.deliveryScore < 40) cons.push('Problemas de entrega')

            if (score.qualityScore >= 70) pros.push('Alta calidad')
            else if (score.qualityScore < 40) cons.push('Calidad inconsistente')

            if (score.paymentScore >= 70) pros.push('Flexibilidad de pago')

            if (score.discountScore >= 70) pros.push('Buenos descuentos')

            if (score.trackingScore >= 70) pros.push('Excelente comunicación')
            else if (score.trackingScore < 40) cons.push('Falta de seguimiento')
        }

        // Generar texto de recomendación
        let recommendation = ''
        if (overallScore >= 80) {
            recommendation = '⭐ Altamente recomendado - Excelente historial'
        } else if (overallScore >= 60) {
            recommendation = '✅ Recomendado - Buen desempeño general'
        } else if (overallScore >= 40) {
            recommendation = '⚠️ Aceptable - Considerar alternativas'
        } else {
            recommendation = '❌ No recomendado - Historial deficiente'
        }

        // Agregar info de órdenes recientes
        if (supplier.purchaseOrders.length === 0) {
            recommendation += ' (Sin historial de compras)'
        }

        return {
            supplier,
            score,
            overallScore,
            recommendation,
            pros,
            cons
        }
    })

    // Ordenar por score descendente
    return recommendations.sort((a, b) => b.overallScore - a.overallScore)
}

/**
 * Genera el mensaje de solicitud de cotización
 */
export function generateQuoteRequestMessage(
    organizationName: string,
    items: { description: string; quantity: number }[],
    dueDate?: Date,
    notes?: string
): string {
    let message = `**SOLICITUD DE COTIZACIÓN**\n\n`
    message += `De: ${organizationName}\n`
    message += `Fecha: ${new Date().toLocaleDateString('es-CO')}\n`

    if (dueDate) {
        message += `Fecha límite de respuesta: ${dueDate.toLocaleDateString('es-CO')}\n`
    }

    message += `\n**PRODUCTOS SOLICITADOS:**\n\n`

    items.forEach((item, index) => {
        message += `${index + 1}. ${item.description}\n`
        message += `   Cantidad: ${item.quantity}\n\n`
    })

    message += `\n**INFORMACIÓN REQUERIDA:**\n`
    message += `- Precio unitario\n`
    message += `- Disponibilidad\n`
    message += `- Tiempo de entrega\n`
    message += `- Condiciones de pago\n`
    message += `- Descuentos aplicables\n`

    if (notes) {
        message += `\n**NOTAS:**\n${notes}\n`
    }

    message += `\n---\nPor favor responda a este mensaje con su cotización.`

    return message
}

/**
 * Envía solicitud de cotización por el método preferido del proveedor
 * (Placeholder - requiere integración con servicios de email/WhatsApp)
 */
export async function sendQuoteRequest(
    supplierId: string,
    message: string
): Promise<{ success: boolean; method: ContactMethod; error?: string }> {
    const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId }
    })

    if (!supplier) {
        return { success: false, method: 'email', error: 'Proveedor no encontrado' }
    }

    const method = (supplier.preferredContact as ContactMethod) || 'email'

    // TODO: Implementar envío real según método
    // Por ahora, solo registramos el intento

    switch (method) {
        case 'email':
            if (!supplier.email) {
                return { success: false, method, error: 'Proveedor sin email configurado' }
            }
            // TODO: Integrar con servicio de email (nodemailer, SendGrid, etc.)
            console.log(`📧 Enviando cotización por email a ${supplier.email}`)
            return { success: true, method }

        case 'whatsapp':
            if (!supplier.whatsapp) {
                return { success: false, method, error: 'Proveedor sin WhatsApp configurado' }
            }
            // TODO: Integrar con API de WhatsApp Business
            console.log(`💬 Enviando cotización por WhatsApp a ${supplier.whatsapp}`)
            return { success: true, method }

        case 'api':
            if (!supplier.apiEndpoint) {
                return { success: false, method, error: 'Proveedor sin API configurada' }
            }
            // TODO: Integrar con API del proveedor
            console.log(`🔌 Enviando cotización por API a ${supplier.apiEndpoint}`)
            return { success: true, method }

        default:
            return { success: false, method: 'email', error: 'Método de contacto no soportado' }
    }
}
