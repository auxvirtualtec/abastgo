import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } // Cambio para Next.js 15: params es una Promesa
) {
    const { id } = await context.params;

    try {
        const patient = await prisma.patient.findUnique({
            where: { id },
            include: {
                contracts: {
                    include: { eps: true },
                    orderBy: { startDate: 'desc' }
                },
                prescriptions: {
                    include: {
                        items: {
                            include: { product: true }
                        },
                        eps: true
                    },
                    orderBy: { prescriptionDate: 'desc' },
                    take: 20 // Últimas 20
                },
                // Entregas no están directamente en Patient, sino via Prescription o Delivery. 
                // Delivery tiene patientId? No, Delivery tiene prescriptionId -> Patient.
                // PERO... Delivery no tiene patientId directo en este schema (revisaré schema abajo).
                // Revisando schema: delivery -> prescription -> patient.
                // Espera, schema.prisma dice: model Patient { prescriptions Prescription[] }
                // model Prescription { deliveries Delivery[] }
                // Entonces para ver entregas, vamos por prescripciones.
            }
        });

        if (!patient) {
            return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
        }

        // Obtener historial de entregas a través de prescripciones
        // Esto puede ser costoso si tiene muchas. Haremos una query separada mejor optimizada.
        const deliveries = await prisma.delivery.findMany({
            where: {
                prescription: { patientId: id }
            },
            include: {
                warehouse: true,
                items: { include: { product: true } },
                prescription: true
            },
            orderBy: { deliveryDate: 'desc' },
            take: 20
        });

        // Obtener items pendientes activos
        const pendingItems = await prisma.pendingItem.findMany({
            where: {
                prescriptionItem: {
                    prescription: { patientId: id }
                },
                status: 'PENDING'
            },
            include: {
                prescriptionItem: {
                    include: {
                        product: true,
                        prescription: true
                    }
                },
                warehouse: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({
            patient,
            deliveries,
            pendingItems
        });

    } catch (error) {
        console.error('Error obteniendo detalle paciente:', error);
        return NextResponse.json(
            { error: 'Error obteniendo paciente' },
            { status: 500 }
        );
    }
}
