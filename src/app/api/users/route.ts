import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// GET - Listar usuarios
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const includeInactive = searchParams.get('includeInactive') === 'true'

        const users = await prisma.user.findMany({
            where: {
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } }
                    ]
                }),
                ...(includeInactive ? {} : { isActive: true })
            },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: { permission: true }
                                }
                            }
                        }
                    }
                },
                warehouseUsers: {
                    include: { warehouse: true }
                }
            },
            orderBy: { name: 'asc' }
        })

        // Transformar para ocultar hash
        const safeUsers = users.map(u => ({
            id: u.id,
            email: u.email,
            name: u.name,
            phone: u.phone,
            isActive: u.isActive,
            createdAt: u.createdAt,
            roles: u.roles.map(r => ({
                id: r.role.id,
                name: r.role.name,
                permissions: r.role.permissions.map(p => p.permission.code)
            })),
            warehouses: u.warehouseUsers.map(wu => ({
                id: wu.warehouse.id,
                name: wu.warehouse.name,
                code: wu.warehouse.code
            }))
        }))

        return NextResponse.json({ users: safeUsers })
    } catch (error) {
        console.error('Error listando usuarios:', error)
        return NextResponse.json(
            { error: 'Error listando usuarios', details: String(error) },
            { status: 500 }
        )
    }
}

// POST - Crear usuario
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, password, name, phone, roleIds, warehouseIds } = body

        if (!email || !password || !name) {
            return NextResponse.json(
                { error: 'Email, contraseña y nombre son requeridos' },
                { status: 400 }
            )
        }

        // Verificar email único
        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing) {
            return NextResponse.json(
                { error: 'El email ya está registrado' },
                { status: 400 }
            )
        }

        // Hash de contraseña
        const passwordHash = await bcrypt.hash(password, 10)

        // Crear usuario con roles y bodegas
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                name,
                phone,
                roles: {
                    create: roleIds?.map((roleId: string) => ({ roleId })) || []
                },
                warehouseUsers: {
                    create: warehouseIds?.map((warehouseId: string) => ({ warehouseId })) || []
                }
            },
            include: {
                roles: { include: { role: true } }
            }
        })

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                roles: user.roles.map(r => r.role.name)
            }
        }, { status: 201 })
    } catch (error) {
        console.error('Error creando usuario:', error)
        return NextResponse.json(
            { error: 'Error creando usuario', details: String(error) },
            { status: 500 }
        )
    }
}

// PUT - Actualizar usuario
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { id, email, password, name, phone, roleIds, warehouseIds, isActive } = body

        if (!id) {
            return NextResponse.json(
                { error: 'ID de usuario requerido' },
                { status: 400 }
            )
        }

        const updateData: any = {}
        if (email) updateData.email = email
        if (name) updateData.name = name
        if (phone !== undefined) updateData.phone = phone
        if (isActive !== undefined) updateData.isActive = isActive
        if (password) updateData.passwordHash = await bcrypt.hash(password, 10)

        // Actualizar usuario
        const user = await prisma.user.update({
            where: { id },
            data: updateData
        })

        // Actualizar roles si se proporcionan
        if (roleIds) {
            await prisma.userRole.deleteMany({ where: { userId: id } })
            await prisma.userRole.createMany({
                data: roleIds.map((roleId: string) => ({ userId: id, roleId }))
            })
        }

        // Actualizar bodegas si se proporcionan
        if (warehouseIds) {
            await prisma.warehouseUser.deleteMany({ where: { userId: id } })
            await prisma.warehouseUser.createMany({
                data: warehouseIds.map((warehouseId: string) => ({ userId: id, warehouseId }))
            })
        }

        return NextResponse.json({
            success: true,
            user: { id: user.id, email: user.email, name: user.name }
        })
    } catch (error) {
        console.error('Error actualizando usuario:', error)
        return NextResponse.json(
            { error: 'Error actualizando usuario', details: String(error) },
            { status: 500 }
        )
    }
}

// DELETE - Desactivar usuario (soft delete)
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json(
                { error: 'ID de usuario requerido' },
                { status: 400 }
            )
        }

        await prisma.user.update({
            where: { id },
            data: { isActive: false }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error desactivando usuario:', error)
        return NextResponse.json(
            { error: 'Error desactivando usuario', details: String(error) },
            { status: 500 }
        )
    }
}
