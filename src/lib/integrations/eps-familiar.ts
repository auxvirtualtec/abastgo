/**
 * Cliente de integración con API EPS Familiar de Colombia
 * 
 * Base URL: http://integrationbridge.familiardecolombia.com:5000
 */

interface EPSFamiliarLoginResponse {
    token?: string
    access_token?: string
    error?: string
}

interface EPSFamiliarAfiliadoResponse {
    afiliado?: {
        tipo_documento: number
        numero_identificacion: string
        nombres: string
        apellidos: string
        estado: string
        regimen: string
        tipo_afiliado: string
        fecha_afiliacion: string
        ips_asignada: string
    }
    error?: string
    message?: string
}

// Tipos de documento según la API
// 3 = CC (Cédula de ciudadanía)
const TIPO_DOCUMENTO_MAP: Record<string, number> = {
    'CC': 3,
    'TI': 2,
    'CE': 4,
    'PA': 5,
    'RC': 1,
    'NU': 6
}

let cachedToken: string | null = null
let tokenExpiry: Date | null = null

/**
 * Autenticación con la API de EPS Familiar
 */
async function autenticarEPSFamiliar(): Promise<string> {
    // Si el token está en caché y no ha expirado, usarlo
    if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
        return cachedToken
    }

    const baseUrl = process.env.EPS_FAMILIAR_API_URL
    const username = process.env.EPS_FAMILIAR_USERNAME
    const password = process.env.EPS_FAMILIAR_PASSWORD

    if (!baseUrl || !username || !password) {
        throw new Error('Credenciales de EPS Familiar no configuradas en variables de entorno')
    }

    const response = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username,
            password
        })
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Error autenticando con EPS Familiar: ${response.status} - ${errorText}`)
    }

    const data: EPSFamiliarLoginResponse = await response.json()

    const token = data.token || data.access_token
    if (!token) {
        throw new Error('No se recibió token de autenticación')
    }

    // Cachear token por 1 hora
    cachedToken = token
    tokenExpiry = new Date(Date.now() + 60 * 60 * 1000)

    return token
}

/**
 * Consulta afiliado en EPS Familiar
 */
export async function consultarAfiliadoEPSFamiliar(
    tipoDocumento: string,
    numeroIdentificacion: string
): Promise<EPSFamiliarAfiliadoResponse> {
    const baseUrl = process.env.EPS_FAMILIAR_API_URL

    if (!baseUrl) {
        throw new Error('EPS_FAMILIAR_API_URL no configurada en variables de entorno')
    }

    const token = await autenticarEPSFamiliar()
    const tipoDoc = TIPO_DOCUMENTO_MAP[tipoDocumento] || 3

    const url = new URL(`${baseUrl}/api/afiliado`)
    url.searchParams.set('tipo_documento', tipoDoc.toString())
    url.searchParams.set('numero_identificacion', numeroIdentificacion)
    url.searchParams.set('oper', '0')

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Error consultando afiliado: ${response.status} - ${errorText}`)
    }

    return response.json()
}

/**
 * Verifica si un paciente está afiliado a EPS Familiar
 */
export async function verificarAfiliacionEPSFamiliar(
    tipoDocumento: string,
    numeroIdentificacion: string
): Promise<{
    afiliado: boolean
    estado: string
    regimen: string | null
    tipoAfiliado: string | null
    nombreCompleto: string | null
    ipsAsignada: string | null
}> {
    try {
        const response = await consultarAfiliadoEPSFamiliar(tipoDocumento, numeroIdentificacion)

        if (!response.afiliado) {
            return {
                afiliado: false,
                estado: 'NO_ENCONTRADO',
                regimen: null,
                tipoAfiliado: null,
                nombreCompleto: null,
                ipsAsignada: null
            }
        }

        const { afiliado } = response
        const nombreCompleto = [afiliado.nombres, afiliado.apellidos]
            .filter(Boolean)
            .join(' ')

        return {
            afiliado: afiliado.estado?.toUpperCase() === 'ACTIVO',
            estado: afiliado.estado,
            regimen: afiliado.regimen,
            tipoAfiliado: afiliado.tipo_afiliado,
            nombreCompleto,
            ipsAsignada: afiliado.ips_asignada
        }
    } catch (error) {
        console.error('Error verificando afiliación EPS Familiar:', error)
        throw error
    }
}
