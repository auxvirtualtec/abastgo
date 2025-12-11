import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// GET - List users in the current organization
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Sin organización activa' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const includeInactive = searchParams.get('includeInactive') === 'true'

        // Get organization members
        const members = await prisma.organizationMember.findMany({
            where: {
                organizationId: session.user.organizationId
            },
            include: {
                user: {
                    include: {
                        warehouseUsers: {
                            include: { warehouse: true }
                        }
                    }
                }
            }
        })

        // Filter and transform
        let users = members
            .filter(m => {
                if (!includeInactive && !m.user.isActive) return false
                if (search) {
                    const s = search.toLowerCase()
                    return m.user.name?.toLowerCase().includes(s) ||
                        m.user.email.toLowerCase().includes(s)
                }
                return true
            })
            .map(m => ({
                id: m.user.id,
                email: m.user.email,
                name: m.user.name || 'Sin nombre',
                phone: m.user.phone,
                isActive: m.user.isActive,
                createdAt: m.user.createdAt,
                role: m.role, // MemberRole from OrganizationMember
                warehouses: m.user.warehouseUsers
                    .filter(wu => wu.warehouse.organizationId === session.user.organizationId)
                    .map(wu => ({
                        id: wu.warehouse.id,
                        name: wu.warehouse.name,
                        code: wu.warehouse.code
                    }))
            }))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

        return NextResponse.json({ users })
    } catch (error) {
        console.error('Error listing users:', error)
        return NextResponse.json(
            { error: 'Error listando usuarios', details: String(error) },
            { status: 500 }
        )
    }
}

// POST - Create user and add to organization
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Sin organización activa' }, { status: 403 })
        }

        // Check admin permission
        if (!session.user.orgRole || !['OWNER', 'ADMIN'].includes(session.user.orgRole)) {
            return NextResponse.json({ error: 'Solo administradores pueden crear usuarios' }, { status: 403 })
        }

        const body = await request.json()
        const { email, password, name, phone, role, warehouseIds } = body

        if (!email || !password || !name) {
            return NextResponse.json(
                { error: 'Email, contraseña y nombre son requeridos' },
                { status: 400 }
            )
        }

        // Check if user already exists
        let user = await prisma.user.findUnique({ where: { email } })

        if (user) {
            // Check if already in this org
            const existingMember = await prisma.organizationMember.findUnique({
                where: {
                    organizationId_userId: {
                        organizationId: session.user.organizationId,
                        userId: user.id
                    }
                }
            })
            if (existingMember) {
                return NextResponse.json(
                    { error: 'El usuario ya pertenece a esta organización' },
                    { status: 400 }
                )
            }
        } else {
            // Create new user
            const passwordHash = await bcrypt.hash(password, 10)
            user = await prisma.user.create({
                data: {
                    email,
                    passwordHash,
                    name,
                    phone
                }
            })
        }

        // Add to organization with role
        await prisma.organizationMember.create({
            data: {
                organizationId: session.user.organizationId,
                userId: user.id,
                role: role || 'DISPENSER'
            }
        })

        // Assign warehouses
        if (warehouseIds && warehouseIds.length > 0) {
            await prisma.warehouseUser.createMany({
                data: warehouseIds.map((warehouseId: string) => ({
                    userId: user!.id,
                    warehouseId
                })),
                skipDuplicates: true
            })
        }

        return NextResponse.json({
            success: true,
            user: { id: user.id, email: user.email, name: user.name, role }
        }, { status: 201 })
    } catch (error) {
        console.error('Error creating user:', error)
        return NextResponse.json(
            { error: 'Error creando usuario', details: String(error) },
            { status: 500 }
        )
    }
}

// PUT - Update user role and warehouses
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Sin organización activa' }, { status: 403 })
        }

        const body = await request.json()
        const { id, name, phone, role, warehouseIds, isActive } = body

        if (!id) {
            return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 })
        }

        // Update user basic info
        const updateData: any = {}
        if (name) updateData.name = name
        if (phone !== undefined) updateData.phone = phone
        if (isActive !== undefined) updateData.isActive = isActive

        if (Object.keys(updateData).length > 0) {
            await prisma.user.update({ where: { id }, data: updateData })
        }

        // Update role in OrganizationMember
        if (role) {
            await prisma.organizationMember.update({
                where: {
                    organizationId_userId: {
                        organizationId: session.user.organizationId,
                        userId: id
                    }
                },
                data: { role }
            })
        }

        // Update warehouse assignments (for this org only)
        if (warehouseIds !== undefined) {
            // Get org's warehouses
            const orgWarehouses = await prisma.warehouse.findMany({
                where: { organizationId: session.user.organizationId },
                select: { id: true }
            })
            const orgWarehouseIds = orgWarehouses.map(w => w.id)

            // Delete user's assignments for this org's warehouses
            await prisma.warehouseUser.deleteMany({
                where: {
                    userId: id,
                    warehouseId: { in: orgWarehouseIds }
                }
            })

            // Create new assignments
            if (warehouseIds.length > 0) {
                await prisma.warehouseUser.createMany({
                    data: warehouseIds.map((warehouseId: string) => ({
                        userId: id,
                        warehouseId
                    })),
                    skipDuplicates: true
                })
            }
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error updating user:', error)
        return NextResponse.json(
            { error: 'Error actualizando usuario', details: String(error) },
            { status: 500 }
        )
    }
}

// DELETE - Remove user from organization (soft)
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.organizationId) {
            return NextResponse.json({ error: 'Sin organización activa' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 })
        }

        // Deactivate user (don't remove from org, just deactivate)
        await prisma.user.update({
            where: { id },
            data: { isActive: false }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deactivating user:', error)
        return NextResponse.json(
            { error: 'Error desactivando usuario', details: String(error) },
            { status: 500 }
        )
    }
}
