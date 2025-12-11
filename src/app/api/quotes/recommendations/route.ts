import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSupplierRecommendations, updateSupplierScore } from '@/lib/services/quote-bot'

/**
 * GET /api/quotes/recommendations
 * Obtener recomendaciones de proveedores basadas en scoring
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // Obtener organización del usuario
        const member = await prisma.organizationMember.findFirst({
            where: { userId: session.user.id },
            select: { organizationId: true }
        })

        if (!member) {
            return NextResponse.json({ error: 'Usuario sin organización' }, { status: 400 })
        }

        const recommendations = await getSupplierRecommendations(member.organizationId)

        return NextResponse.json({
            success: true,
            data: recommendations.map(r => ({
                supplier: {
                    id: r.supplier.id,
                    name: r.supplier.name,
                    code: r.supplier.code,
                    email: r.supplier.email,
                    phone: r.supplier.phone,
                    whatsapp: r.supplier.whatsapp,
                    preferredContact: r.supplier.preferredContact,
                    isExternal: r.supplier.isExternal
                },
                scoring: r.score ? {
                    overallScore: r.overallScore,
                    priceScore: r.score.priceScore,
                    deliveryScore: r.score.deliveryScore,
                    qualityScore: r.score.qualityScore,
                    paymentScore: r.score.paymentScore,
                    discountScore: r.score.discountScore,
                    trackingScore: r.score.trackingScore,
                    totalOrders: r.score.totalOrders,
                    onTimeDeliveries: r.score.onTimeDeliveries
                } : null,
                recommendation: r.recommendation,
                pros: r.pros,
                cons: r.cons
            }))
        })
    } catch (error) {
        console.error('Error obteniendo recomendaciones:', error)
        return NextResponse.json(
            { success: false, error: 'Error al obtener recomendaciones' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/quotes/recommendations
 * Actualizar score de un proveedor después de una transacción
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const {
            supplierId,
            priceCompetitive,
            deliveredOnTime,
            qualityGood,
            paymentFlexible,
            discountOffered,
            communicationGood
        } = body

        if (!supplierId) {
            return NextResponse.json(
                { success: false, error: 'Se requiere supplierId' },
                { status: 400 }
            )
        }

        // Verificar que el proveedor existe y pertenece a la organización
        const member = await prisma.organizationMember.findFirst({
            where: { userId: session.user.id }
        })

        if (!member) {
            return NextResponse.json({ error: 'Usuario sin organización' }, { status: 400 })
        }

        const supplier = await prisma.supplier.findFirst({
            where: {
                id: supplierId,
                organizationId: member.organizationId
            }
        })

        if (!supplier) {
            return NextResponse.json(
                { success: false, error: 'Proveedor no encontrado' },
                { status: 404 }
            )
        }

        // Actualizar score
        const updatedScore = await updateSupplierScore(supplierId, {
            priceCompetitive,
            deliveredOnTime,
            qualityGood,
            paymentFlexible,
            discountOffered,
            communicationGood
        })

        return NextResponse.json({
            success: true,
            data: updatedScore
        })
    } catch (error) {
        console.error('Error actualizando score:', error)
        return NextResponse.json(
            { success: false, error: 'Error al actualizar score' },
            { status: 500 }
        )
    }
}
