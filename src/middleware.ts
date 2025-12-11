import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Rutas que NO requieren autenticación
const publicRoutes = [
    '/login',
    '/api/auth',
]

// Rutas de API que son públicas
const publicApiRoutes = [
    '/api/auth/',
    '/api/debug',
    '/api/admin/set-super-admin', // TEMPORARY - DELETE AFTER USE
]

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Permitir archivos estáticos y recursos
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.') // archivos con extensión
    ) {
        return NextResponse.next()
    }

    // Verificar si es ruta pública
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
    const isPublicApiRoute = publicApiRoutes.some(route => pathname.startsWith(route))

    if (isPublicRoute || isPublicApiRoute) {
        return NextResponse.next()
    }

    // Obtener token de sesión
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
    })

    // Si no hay sesión, redirigir a login (para páginas) o devolver 401 (para API)
    if (!token) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'No autorizado. Inicia sesión.' },
                { status: 401 }
            )
        }

        // Guardar la URL original para redirigir después del login
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(loginUrl)
    }

    // Usuario autenticado - permitir acceso
    return NextResponse.next()
}

// Configuración: aplicar a todas las rutas excepto las excluidas
export const config = {
    matcher: [
        /*
         * Aplicar a todas las rutas excepto:
         * - _next/static (archivos estáticos)
         * - _next/image (optimización de imágenes)
         * - favicon.ico
         * - archivos públicos
         */
        '/((?!_next/static|_next/image|favicon.ico|uploads/).*)',
    ],
}
