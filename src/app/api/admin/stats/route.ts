
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        // Only Super Admins can access this
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json(
                { error: "Acceso denegado. Solo Super Admins." },
                { status: 403 }
            );
        }

        const [orgs, users] = await Promise.all([
            prisma.organization.findMany({
                include: {
                    _count: { select: { members: true } },
                    members: {
                        where: { role: 'OWNER' },
                        include: { user: true },
                        take: 1
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.user.findMany({
                include: {
                    memberships: {
                        include: { organization: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 50 // Limit for safety
            })
        ]);

        const stats = {
            counts: {
                organizations: orgs.length,
                users: await prisma.user.count()
            },
            organizations: orgs.map(org => ({
                ...org,
                admins: org.members // Taking the fetched owners
            })),
            users: users
        };

        return NextResponse.json(stats);

    } catch (error: any) {
        console.error("Admin Stats Error:", error);
        return NextResponse.json(
            { error: "Error fetching admin stats", details: error.message },
            { status: 500 }
        );
    }
}
