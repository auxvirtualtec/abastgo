import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET - Listar EPS de la organización
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const organizationId = session.user.organizationId;
        if (!organizationId) {
            return NextResponse.json({ eps: [] }); // User without org sees nothing
        }

        const epsList = await prisma.ePS.findMany({
            where: {
                organizationId,
                isActive: true
            },
            orderBy: { name: 'asc' }
        });

        return NextResponse.json({ eps: epsList });
    } catch (error) {
        console.error("Error listando EPS:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}

// POST - Crear nueva EPS
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || !session.user.organizationId) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { code, name, hasApi, apiEndpoint } = body;

        if (!code || !name) {
            return NextResponse.json(
                { error: "Código y Nombre son requeridos" },
                { status: 400 }
            );
        }

        const existing = await prisma.ePS.findFirst({
            where: {
                organizationId: session.user.organizationId,
                code
            }
        });

        if (existing) {
            return NextResponse.json(
                { error: "Ya existe una EPS con este código" },
                { status: 409 }
            );
        }

        const eps = await prisma.ePS.create({
            data: {
                organizationId: session.user.organizationId,
                code,
                name,
                hasApi: hasApi || false,
                apiEndpoint,
                isActive: true
            }
        });

        return NextResponse.json({ success: true, eps }, { status: 201 });
    } catch (error) {
        console.error("Error creando EPS:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
