import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Debug endpoint to list all organizations
export async function GET() {
    const orgs = await prisma.organization.findMany({
        select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            _count: { select: { members: true } }
        }
    });

    return NextResponse.json({
        count: orgs.length,
        organizations: orgs
    });
}
