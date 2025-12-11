import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
    try {
        const { email, password, name } = await req.json();

        if (!email || !password || !name) {
            return NextResponse.json(
                { error: "Faltan campos requeridos" },
                { status: 400 }
            );
        }

        // Verificar si el usuario ya existe
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: "El correo electrónico ya está registrado" },
                { status: 409 }
            );
        }

        // Hash de contraseña
        const passwordHash = await bcrypt.hash(password, 10);

        // Crear usuario
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                name,
                isActive: true,
            },
        });

        // No devolvemos el hash de la contraseña
        const { passwordHash: _, ...userWithoutPassword } = user;

        return NextResponse.json({
            success: true,
            user: userWithoutPassword
        }, { status: 201 });

    } catch (error) {
        console.error("Error en registro:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
