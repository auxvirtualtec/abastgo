import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

// Extender tipos para Next-Auth v4
declare module "next-auth" {
    interface User {
        organizationId?: string | null
        orgRole?: string | null
        isSuperAdmin?: boolean
        // Legacy
        roles?: string[]
        permissions?: string[]
        warehouseIds?: string[]
    }
    interface Session {
        user: {
            id: string
            email: string
            name?: string | null
            organizationId?: string | null
            orgRole?: string | null
            isSuperAdmin?: boolean
            // Legacy
            roles?: string[]
            permissions?: string[]
            warehouseIds?: string[]
        }
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id?: string
        organizationId?: string | null
        orgRole?: string | null
        isSuperAdmin?: boolean
        // Legacy
        roles?: string[]
        permissions?: string[]
        warehouseIds?: string[]
    }
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Contraseña", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                try {
                    // Buscar usuario
                    const user = await prisma.user.findUnique({
                        where: { email: credentials.email },
                        include: {
                            memberships: {
                                include: {
                                    organization: true
                                }
                            },
                            warehouseUsers: {
                                select: { warehouseId: true }
                            }
                        }
                    })

                    if (!user || !user.isActive) {
                        return null
                    }

                    // Verificar contraseña (si tiene passwordHash)
                    if (user.passwordHash) {
                        const isValidPassword = await bcrypt.compare(
                            credentials.password,
                            user.passwordHash
                        )
                        if (!isValidPassword) return null
                    } else {
                        // Si no tiene password (login social?), denegar por credenciales
                        return null
                    }

                    // Seleccionar organización activa (por ahora la primera)
                    const activeMembership = user.memberships[0]
                    const organizationId = activeMembership?.organizationId || null
                    const orgRole = activeMembership?.role || null

                    // Definir permisos basados en el rol
                    let permissions: string[] = []
                    let roles: string[] = []

                    if (orgRole === 'OWNER' || orgRole === 'ADMIN') {
                        roles = ['admin'] // Esto habilita todo en el sidebar según la lógica actual
                        permissions = ['*'] // Wildcard por si acaso
                    } else if (orgRole === 'OPERATOR') {
                        roles = ['operator']
                        permissions = ['inventory.*']
                    } else if (orgRole === 'DISPENSER') {
                        roles = ['dispenser']
                        permissions = ['dispensation.*']
                    }

                    // Cargar bodegas asignadas del usuario
                    const warehouseIds = user.warehouseUsers.map(wu => wu.warehouseId)

                    return {
                        id: user.id,
                        email: user.email!,
                        name: user.name!,
                        organizationId,
                        orgRole,
                        isSuperAdmin: user.isSuperAdmin,
                        roles,
                        permissions,
                        warehouseIds
                    }
                } catch (error) {
                    console.error('Error en autenticación:', error)
                    return null
                }
            }
        })
    ],
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id
                token.organizationId = user.organizationId
                token.orgRole = user.orgRole
                token.isSuperAdmin = user.isSuperAdmin
                // @ts-ignore
                token.roles = user.roles
                // @ts-ignore
                token.permissions = user.permissions
                // @ts-ignore
                token.warehouseIds = user.warehouseIds || []
            }

            // Permitir actualizar la organización activa desde el cliente
            if (trigger === "update") {
                try {
                    // If a specific organizationId is provided, switch to it
                    if (session?.organizationId) {
                        // Super Admin can switch to any organization
                        if (token.isSuperAdmin) {
                            // Verify org exists
                            const org = await prisma.organization.findUnique({
                                where: { id: session.organizationId }
                            })

                            if (org) {
                                token.organizationId = session.organizationId
                                token.orgRole = 'ADMIN' // Super Admin acts as admin in any org
                                token.roles = ['admin']
                                token.permissions = ['*']
                                token.warehouseIds = [] // Super Admin/Admin ve todas las bodegas
                            }
                        } else {
                            // Regular user - verify membership
                            const membership = await prisma.organizationMember.findUnique({
                                where: {
                                    organizationId_userId: {
                                        organizationId: session.organizationId,
                                        userId: token.id as string
                                    }
                                }
                            })

                            if (membership) {
                                token.organizationId = session.organizationId
                                token.orgRole = membership.role

                                // Recalcular permisos
                                if (membership.role === 'OWNER' || membership.role === 'ADMIN') {
                                    token.roles = ['admin']
                                    token.permissions = ['*']
                                    token.warehouseIds = [] // Admin ve todas las bodegas
                                } else {
                                    token.roles = ['user']
                                    token.permissions = []
                                    // Cargar bodegas asignadas para OPERATOR/DISPENSER
                                    const warehouseUsers = await prisma.warehouseUser.findMany({
                                        where: { userId: token.id as string },
                                        select: { warehouseId: true }
                                    })
                                    token.warehouseIds = warehouseUsers.map(wu => wu.warehouseId)
                                }
                            }
                        }
                    } else {
                        // No specific org provided - refetch memberships (e.g., after creating first org)
                        const memberships = await prisma.organizationMember.findMany({
                            where: { userId: token.id as string }
                        })

                        if (memberships.length > 0 && !token.organizationId) {
                            // User now has memberships but session didn't have an org - set first one
                            const firstMembership = memberships[0]
                            token.organizationId = firstMembership.organizationId
                            token.orgRole = firstMembership.role

                            if (firstMembership.role === 'OWNER' || firstMembership.role === 'ADMIN') {
                                token.roles = ['admin']
                                token.permissions = ['*']
                            } else {
                                token.roles = ['user']
                                token.permissions = []
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error updating session org:", e)
                }
            }

            return token
        },
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id as string
                session.user.organizationId = token.organizationId as string | null
                session.user.orgRole = token.orgRole as string | null
                session.user.isSuperAdmin = token.isSuperAdmin || false
                session.user.roles = (token.roles as string[]) || []
                session.user.permissions = (token.permissions as string[]) || []
                session.user.warehouseIds = (token.warehouseIds as string[]) || []
            }
            return session
        }
    },
    pages: {
        signIn: "/login"
    },
    session: {
        strategy: "jwt"
    },
    secret: process.env.NEXTAUTH_SECRET
}
