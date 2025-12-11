
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { organizationId } = await req.json();

        if (!organizationId) {
            return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
        }

        // Add user as ADMIN to the target organization
        // Upsert to handle if they are already a member
        const membership = await prisma.organizationMember.upsert({
            where: {
                organizationId_userId: {
                    organizationId: organizationId,
                    userId: session.user.id
                }
            },
            update: {
                role: 'ADMIN' // Upgrade to admin if already exists
            },
            create: {
                organizationId: organizationId,
                userId: session.user.id,
                role: 'ADMIN'
            }
        });

        // Also add logic to assign default role if needed, but Member table role is primary for auth now.
        // Let's ensure a Role exists in the org for them if we were using Role table strictly, 
        // but current auth relies on OrganizationMember context primarily.

        return NextResponse.json({ success: true, membership });

    } catch (error: any) {
        console.error("Join Org Error:", error);
        return NextResponse.json(
            { error: "Failed to join organization", details: error.message },
            { status: 500 }
        );
    }
}
