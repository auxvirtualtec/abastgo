import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'day'; // day, week, month
        const startDateStr = searchParams.get('startDate');
        const endDateStr = searchParams.get('endDate');
        const molecule = searchParams.get('molecule'); // Nuevo filtro

        const endDate = endDateStr ? new Date(endDateStr) : new Date();
        const startDate = startDateStr ? new Date(startDateStr) : new Date(new Date().setDate(endDate.getDate() - 30));

        // Ajustar fechas
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        // Validar rango
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const daysInRange = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

        // Construir Query Dinámica
        const conditions = [
            Prisma.sql`d.status = 'COMPLETED'`,
            Prisma.sql`d.delivery_date >= ${startDate}`,
            Prisma.sql`d.delivery_date <= ${endDate}`,
            Prisma.sql`p.molecule IS NOT NULL`
        ];

        if (molecule && molecule !== 'all') {
            conditions.push(Prisma.sql`p.molecule = ${molecule}`);
        }

        const whereClause = conditions.length > 0
            ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
            : Prisma.empty;

        const results = await prisma.$queryRaw<
            { molecule: string; total_quantity: number }[]
        >`
            SELECT 
                p.molecule, 
                SUM(di.quantity) as total_quantity
            FROM "delivery_items" di
            JOIN "deliveries" d ON di.delivery_id = d.id
            JOIN "products" p ON di.product_id = p.id
            ${whereClause}
            GROUP BY p.molecule
            ORDER BY total_quantity DESC
        `;

        // Procesar datos
        const reportData = results.map(row => {
            const totalQty = Number(row.total_quantity);
            let avgRotation = 0;

            if (period === 'week') {
                const weeks = daysInRange / 7;
                avgRotation = totalQty / (weeks < 1 ? 1 : weeks);
            } else if (period === 'month') {
                const months = daysInRange / 30;
                avgRotation = totalQty / (months < 1 ? 1 : months);
            } else {
                // Day
                avgRotation = totalQty / daysInRange;
            }

            return {
                molecule: row.molecule,
                totalQuantity: totalQty,
                averageRotation: parseFloat(avgRotation.toFixed(2))
            };
        });

        return NextResponse.json({
            data: reportData,
            meta: {
                period,
                startDate,
                endDate,
                daysInRange
            }
        });

    } catch (error) {
        console.error('Error en reporte de rotación:', error);
        return NextResponse.json(
            { error: 'Error al generar el reporte', details: String(error) },
            { status: 500 }
        );
    }
}
