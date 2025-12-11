import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET - Listar organizaciones del usuario
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // Obtener organizaciones donde el usuario es miembro
        const memberships = await prisma.organizationMember.findMany({
            where: {
                userId: session.user.id,
            },
            include: {
                organization: true,
            },
        });

        const organizations = memberships.map((m) => ({
            ...m.organization,
            role: m.role,
        }));

        return NextResponse.json({ organizations });
    } catch (error) {
        console.error("Error listando organizaciones:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}

// POST - Crear nueva organización
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { name, slug } = await req.json();

        if (!name || !slug) {
            return NextResponse.json(
                { error: "Nombre y slug son requeridos" },
                { status: 400 }
            );
        }

        // Validar slug único
        const existingOrg = await prisma.organization.findUnique({
            where: { slug },
        });

        if (existingOrg) {
            return NextResponse.json(
                { error: "El slug de la organización ya existe" },
                { status: 409 }
            );
        }

        // Crear organización y membresía de OWNER en una transacción
        const organization = await prisma.$transaction(async (tx) => {
            // 1. Crear Organización
            const org = await tx.organization.create({
                data: {
                    name,
                    slug,
                    members: {
                        create: {
                            userId: session.user.id,
                            role: "OWNER",
                        },
                    },
                },
            });

            // 2. Crear Roles por Defecto para esa Organización
            // ADMIN
            const adminRole = await tx.role.create({
                data: {
                    organizationId: org.id,
                    name: "ADMIN",
                    description: "Administrador con acceso total",
                },
            });
            // Asignar permisos globales (simplificado: todos los permisos existentes se asumen 'system' o se crean bajo demanda)
            // Por ahora creamos el rol vacío, luego se asignan permisos.

            // MEMBER
            await tx.role.create({
                data: {
                    organizationId: org.id,
                    name: "MEMBER",
                    description: "Miembro regular con acceso limitado",
                }
            });

            // 3. Asignar rol ADMIN al creador (además de ser OWNER en membresía, le damos el rol funcional)
            await tx.userRole.create({
                data: {
                    userId: session.user.id,
                    roleId: adminRole.id
                }
            });

            return org;
        });

        return NextResponse.json({ success: true, organization }, { status: 201 });
    } catch (error) {
        console.error("Error creando organización:", error);
        return NextResponse.json(
            { error: "Error interno del servidor", details: String(error) },
            { status: 500 }
        );
    }
}
