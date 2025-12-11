import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const molecules = await prisma.product.findMany({
            where: {
                isActive: true,
                molecule: { not: null }
            },
            select: {
                molecule: true
            },
            distinct: ['molecule'],
            orderBy: {
                molecule: 'asc'
            }
        });

        // Filter out nulls explicitly just in case type narrowing didn't catch it
        const list = molecules
            .map(p => p.molecule)
            .filter(m => m !== null && m !== '') as string[];

        return NextResponse.json(list);
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching molecules' }, { status: 500 });
    }
}
