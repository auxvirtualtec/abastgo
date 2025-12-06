import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

// Extender tipos para Next-Auth v4
declare module "next-auth" {
    interface User {
        roles?: string[]
        permissions?: string[]
    }
    interface Session {
        user: {
            id: string
            email: string
            name: string
            roles: string[]
            permissions: string[]
        }
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id?: string
        roles?: string[]
        permissions?: string[]
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
                    // Buscar usuario en la base de datos
                    const user = await prisma.user.findUnique({
                        where: { email: credentials.email },
                        include: {
                            roles: {
                                include: {
                                    role: {
                                        include: {
                                            permissions: {
                                                include: {
                                                    permission: true
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    })

                    if (!user || !user.isActive) {
                        return null
                    }

                    // Verificar contraseña
                    const isValidPassword = await bcrypt.compare(
                        credentials.password,
                        user.passwordHash
                    )

                    if (!isValidPassword) {
                        return null
                    }

                    // Extraer roles y permisos
                    const roles = user.roles.map(ur => ur.role.name)
                    const permissions = user.roles.flatMap(ur =>
                        ur.role.permissions.map(rp => rp.permission.code)
                    )

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        roles,
                        permissions
                    }
                } catch (error) {
                    console.error('Error en autenticación:', error)
                    return null
                }
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.roles = user.roles
                token.permissions = user.permissions
            }
            return token
        },
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id as string
                session.user.roles = token.roles as string[]
                session.user.permissions = token.permissions as string[]
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
