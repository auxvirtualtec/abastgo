import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const organizationId = session.user.organizationId

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const skip = (page - 1) * limit;

        const whereClause: Prisma.PatientWhereInput = {
            organizationId
        };

        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { documentNumber: { contains: search, mode: 'insensitive' } },
                { contracts: { some: { eps: { name: { contains: search, mode: 'insensitive' } } } } }
            ];
        }

        const [total, patients] = await Promise.all([
            prisma.patient.count({ where: whereClause }),
            prisma.patient.findMany({
                where: whereClause,
                take: limit,
                skip: skip,
                orderBy: { name: 'asc' },
                include: {
                    contracts: {
                        where: { isActive: true },
                        include: { eps: true },
                        take: 1
                    }
                }
            })
        ]);

        return NextResponse.json({
            patients: patients.map(p => ({
                id: p.id,
                name: p.name,
                documentType: p.documentType,
                documentNumber: p.documentNumber,
                epsName: p.contracts[0]?.eps.name || 'Sin EPS activa',
                phone: p.phone,
                city: p.city
            })),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error buscando pacientes:', error);
        return NextResponse.json(
            { error: 'Error buscando pacientes' },
            { status: 500 }
        );
    }
}
