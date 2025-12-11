import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TEMPORARY: Set user as Super Admin
// DELETE THIS FILE AFTER FIRST USE
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get("email");
        const secretKey = searchParams.get("key");

        // Security: Require a secret key to prevent abuse
        if (secretKey !== "DISPENZABOT_SUPER_ADMIN_KEY_2024") {
            return NextResponse.json({ error: "Invalid secret key" }, { status: 403 });
        }

        if (!email) {
            return NextResponse.json({ error: "Email required" }, { status: 400 });
        }

        const user = await prisma.user.update({
            where: { email },
            data: { isSuperAdmin: true },
            select: { id: true, email: true, name: true, isSuperAdmin: true }
        });

        return NextResponse.json({
            success: true,
            message: `${user.email} is now a Super Admin`,
            user
        });

    } catch (error: any) {
        console.error("Set Super Admin Error:", error);
        return NextResponse.json(
            { error: "Failed to set super admin", details: error.message },
            { status: 500 }
        );
    }
}
