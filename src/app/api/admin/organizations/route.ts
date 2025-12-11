import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Super Admin: Create organization
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Solo Super Admins" }, { status: 403 });
        }

        const { name, slug, ownerEmail } = await req.json();

        if (!name || !slug) {
            return NextResponse.json({ error: "Nombre y slug requeridos" }, { status: 400 });
        }

        // Check if slug exists
        const existing = await prisma.organization.findUnique({ where: { slug } });
        if (existing) {
            return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });
        }

        // Create organization
        const org = await prisma.organization.create({
            data: { name, slug }
        });

        // If owner email provided, add as owner
        if (ownerEmail) {
            const user = await prisma.user.findUnique({ where: { email: ownerEmail } });
            if (user) {
                await prisma.organizationMember.create({
                    data: {
                        organizationId: org.id,
                        userId: user.id,
                        role: "OWNER"
                    }
                });
            }
        }

        return NextResponse.json({ success: true, organization: org });
    } catch (error: any) {
        console.error("Create Org Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Super Admin: Update organization
export async function PUT(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Solo Super Admins" }, { status: 403 });
        }

        const { id, name, slug } = await req.json();

        if (!id) {
            return NextResponse.json({ error: "ID requerido" }, { status: 400 });
        }

        const org = await prisma.organization.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(slug && { slug })
            }
        });

        return NextResponse.json({ success: true, organization: org });
    } catch (error: any) {
        console.error("Update Org Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Super Admin: Delete organization
export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Solo Super Admins" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "ID requerido" }, { status: 400 });
        }

        // Delete organization (cascades will handle related data based on schema)
        await prisma.organization.delete({ where: { id } });

        return NextResponse.json({ success: true, message: "Organización eliminada" });
    } catch (error: any) {
        console.error("Delete Org Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
