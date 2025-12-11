import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Super Admin: List ALL organizations for the switcher
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Solo Super Admins" }, { status: 403 });
        }

        const organizations = await prisma.organization.findMany({
            select: {
                id: true,
                name: true,
                slug: true,
            },
            orderBy: { name: 'asc' }
        });

        return NextResponse.json({ organizations });
    } catch (error: any) {
        console.error("List Orgs Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
