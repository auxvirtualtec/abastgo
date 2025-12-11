import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET - Listar roles con permisos
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const organizationId = session.user.organizationId

        const roles = await prisma.role.findMany({
            where: { organizationId },
            include: {
                permissions: {
                    include: { permission: true }
                },
                _count: { select: { users: true } }
            },
            orderBy: { name: 'asc' }
        })

        const rolesData = roles.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            permissions: r.permissions.map(p => ({
                id: p.permission.id,
                code: p.permission.code,
                module: p.permission.module,
                description: p.permission.description
            })),
            usersCount: r._count.users
        }))

        // También obtener todos los permisos disponibles (Globales del sistema)
        const permissions = await prisma.permission.findMany({
            orderBy: [{ module: 'asc' }, { code: 'asc' }]
        })

        return NextResponse.json({ roles: rolesData, permissions })
    } catch (error) {
        console.error('Error listando roles:', error)
        return NextResponse.json(
            { error: 'Error listando roles', details: String(error) },
            { status: 500 }
        )
    }
}

// POST - Crear rol
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const organizationId = session?.user?.organizationId

        if (!organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { name, description, permissionIds } = body

        if (!name) {
            return NextResponse.json(
                { error: 'Nombre del rol requerido' },
                { status: 400 }
            )
        }

        const role = await prisma.role.create({
            data: {
                organizationId,
                name,
                description,
                permissions: {
                    create: permissionIds?.map((permissionId: string) => ({ permissionId })) || []
                }
            }
        })

        return NextResponse.json({ success: true, role }, { status: 201 })
    } catch (error) {
        console.error('Error creando rol:', error)
        return NextResponse.json(
            { error: 'Error creando rol', details: String(error) },
            { status: 500 }
        )
    }
}

// PUT - Actualizar rol
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const organizationId = session?.user?.organizationId

        if (!organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { id, name, description, permissionIds } = body

        if (!id) {
            return NextResponse.json(
                { error: 'ID de rol requerido' },
                { status: 400 }
            )
        }

        // Verify ownership
        const existingRole = await prisma.role.findUnique({ where: { id } })
        if (!existingRole || existingRole.organizationId !== organizationId) {
            return NextResponse.json(
                { error: 'Rol no encontrado' },
                { status: 404 }
            )
        }

        await prisma.role.update({
            where: { id },
            data: { name, description }
        })

        if (permissionIds) {
            await prisma.rolePermission.deleteMany({ where: { roleId: id } })
            await prisma.rolePermission.createMany({
                data: permissionIds.map((permissionId: string) => ({ roleId: id, permissionId }))
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error actualizando rol:', error)
        return NextResponse.json(
            { error: 'Error actualizando rol', details: String(error) },
            { status: 500 }
        )
    }
}

// DELETE - Eliminar rol
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const organizationId = session?.user?.organizationId

        if (!organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json(
                { error: 'ID de rol requerido' },
                { status: 400 }
            )
        }

        // Verify ownership
        const existingRole = await prisma.role.findUnique({ where: { id } })
        if (!existingRole || existingRole.organizationId !== organizationId) {
            return NextResponse.json(
                { error: 'Rol no encontrado' },
                { status: 404 }
            )
        }

        // Verificar que no tenga usuarios asignados
        const usersCount = await prisma.userRole.count({ where: { roleId: id } })
        if (usersCount > 0) {
            return NextResponse.json(
                { error: `No se puede eliminar: ${usersCount} usuarios tienen este rol` },
                { status: 400 }
            )
        }

        await prisma.rolePermission.deleteMany({ where: { roleId: id } })
        await prisma.role.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error eliminando rol:', error)
        return NextResponse.json(
            { error: 'Error eliminando rol', details: String(error) },
            { status: 500 }
        )
    }
}
