import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
    generateQuoteRequestMessage,
    sendQuoteRequest,
    getSupplierRecommendations
} from '@/lib/services/quote-bot'

/**
 * API para gestión de solicitudes de cotización
 * 
 * GET /api/quotes - Listar solicitudes de cotización
 * POST /api/quotes - Crear nueva solicitud de cotización
 */

// GET - Listar solicitudes de cotización
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get('status')
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))

        // Obtener organizationId del usuario
        const member = await prisma.organizationMember.findFirst({
            where: { userId: session.user.id },
            select: { organizationId: true }
        })

        if (!member) {
            return NextResponse.json({ error: 'Usuario sin organización' }, { status: 400 })
        }

        const where: any = { organizationId: member.organizationId } // eslint-disable-line @typescript-eslint/no-explicit-any
        if (status) {
            where.status = status
        }

        const [quoteRequests, total] = await Promise.all([
            prisma.quoteRequest.findMany({
                where,
                include: {
                    items: {
                        include: {
                            product: { select: { id: true, name: true, code: true } },
                            invimaDrug: { select: { id: true, producto: true, cum: true } }
                        }
                    },
                    quotes: {
                        include: {
                            supplier: { select: { id: true, name: true, code: true } },
                            items: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.quoteRequest.count({ where })
        ])

        return NextResponse.json({
            success: true,
            data: quoteRequests,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        })
    } catch (error) {
        console.error('Error listando cotizaciones:', error)
        return NextResponse.json(
            { success: false, error: 'Error al listar cotizaciones' },
            { status: 500 }
        )
    }
}

// POST - Crear nueva solicitud de cotización
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { items, supplierIds, notes, dueDate, sendNow = false } = body

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Se requieren productos para cotizar' },
                { status: 400 }
            )
        }

        // Obtener organización
        const member = await prisma.organizationMember.findFirst({
            where: { userId: session.user.id },
            include: { organization: true }
        })

        if (!member) {
            return NextResponse.json(
                { success: false, error: 'Usuario sin organización' },
                { status: 400 }
            )
        }

        const organizationId = member.organizationId

        // Generar número de solicitud
        const lastRequest = await prisma.quoteRequest.findFirst({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            select: { requestNumber: true }
        })

        const nextNumber = lastRequest
            ? parseInt(lastRequest.requestNumber.split('-')[1] || '0') + 1
            : 1
        const requestNumber = `COT-${nextNumber.toString().padStart(5, '0')}`

        // Crear solicitud de cotización
        const quoteRequest = await prisma.quoteRequest.create({
            data: {
                organizationId,
                requestNumber,
                status: 'PENDING',
                notes,
                dueDate: dueDate ? new Date(dueDate) : null,
                items: {
                    create: items.map((item: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                        productId: item.productId || null,
                        invimaDrugId: item.invimaDrugId || null,
                        description: item.description,
                        quantity: item.quantity
                    }))
                }
            },
            include: {
                items: {
                    include: {
                        product: true,
                        invimaDrug: true
                    }
                }
            }
        })

        // Si se solicita envío inmediato a proveedores
        const sendResults: any[] = [] // eslint-disable-line @typescript-eslint/no-explicit-any
        if (sendNow && supplierIds && supplierIds.length > 0) {
            const message = generateQuoteRequestMessage(
                member.organization.name,
                quoteRequest.items.map(item => ({
                    description: item.description,
                    quantity: item.quantity
                })),
                quoteRequest.dueDate || undefined,
                notes
            )

            for (const supplierId of supplierIds) {
                const result = await sendQuoteRequest(supplierId, message)
                sendResults.push({ supplierId, ...result })
            }

            // Actualizar estado a SENT si al menos uno fue exitoso
            if (sendResults.some(r => r.success)) {
                await prisma.quoteRequest.update({
                    where: { id: quoteRequest.id },
                    data: { status: 'SENT' }
                })
            }
        }

        return NextResponse.json({
            success: true,
            data: quoteRequest,
            sendResults: sendResults.length > 0 ? sendResults : undefined
        })
    } catch (error) {
        console.error('Error creando cotización:', error)
        return NextResponse.json(
            { success: false, error: 'Error al crear cotización' },
            { status: 500 }
        )
    }
}

// PUT - Actualizar solicitud de cotización o registrar cotización recibida
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { quoteRequestId, action, data } = body

        if (!quoteRequestId) {
            return NextResponse.json(
                { success: false, error: 'Se requiere quoteRequestId' },
                { status: 400 }
            )
        }

        // Verificar permisos
        const member = await prisma.organizationMember.findFirst({
            where: { userId: session.user.id }
        })

        if (!member) {
            return NextResponse.json(
                { success: false, error: 'Usuario sin organización' },
                { status: 400 }
            )
        }

        const quoteRequest = await prisma.quoteRequest.findFirst({
            where: {
                id: quoteRequestId,
                organizationId: member.organizationId
            }
        })

        if (!quoteRequest) {
            return NextResponse.json(
                { success: false, error: 'Solicitud de cotización no encontrada' },
                { status: 404 }
            )
        }

        switch (action) {
            case 'register_quote':
                // Registrar cotización recibida de un proveedor
                const { supplierId, quoteNumber, items: quoteItems, totalAmount, deliveryDays, paymentTerms, discount, validUntil, notes: quoteNotes } = data

                if (!supplierId || !quoteItems || quoteItems.length === 0) {
                    return NextResponse.json(
                        { success: false, error: 'Datos de cotización incompletos' },
                        { status: 400 }
                    )
                }

                const quote = await prisma.quote.create({
                    data: {
                        quoteRequestId,
                        supplierId,
                        quoteNumber,
                        totalAmount: totalAmount || 0,
                        deliveryDays,
                        paymentTerms,
                        discount,
                        validUntil: validUntil ? new Date(validUntil) : null,
                        notes: quoteNotes,
                        items: {
                            create: quoteItems.map((item: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                                quoteRequestItemId: item.quoteRequestItemId,
                                unitPrice: item.unitPrice,
                                quantity: item.quantity,
                                available: item.available ?? true,
                                notes: item.notes
                            }))
                        }
                    },
                    include: { items: true, supplier: true }
                })

                // Actualizar estado de la solicitud
                await prisma.quoteRequest.update({
                    where: { id: quoteRequestId },
                    data: { status: 'PARTIAL' }
                })

                return NextResponse.json({ success: true, data: quote })

            case 'select_quote':
                // Seleccionar una cotización como ganadora
                const { quoteId } = data

                // Deseleccionar otras cotizaciones
                await prisma.quote.updateMany({
                    where: { quoteRequestId },
                    data: { isSelected: false }
                })

                // Seleccionar la indicada
                await prisma.quote.update({
                    where: { id: quoteId },
                    data: { isSelected: true }
                })

                // Marcar solicitud como completada
                await prisma.quoteRequest.update({
                    where: { id: quoteRequestId },
                    data: { status: 'COMPLETED' }
                })

                return NextResponse.json({ success: true, message: 'Cotización seleccionada' })

            case 'cancel':
                await prisma.quoteRequest.update({
                    where: { id: quoteRequestId },
                    data: { status: 'CANCELLED' }
                })
                return NextResponse.json({ success: true, message: 'Solicitud cancelada' })

            default:
                return NextResponse.json(
                    { success: false, error: 'Acción no válida' },
                    { status: 400 }
                )
        }
    } catch (error) {
        console.error('Error actualizando cotización:', error)
        return NextResponse.json(
            { success: false, error: 'Error al actualizar cotización' },
            { status: 500 }
        )
    }
}
