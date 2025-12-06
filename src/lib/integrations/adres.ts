/**
 * Cliente de integración con API ADRES
 * 
 * Endpoint automático con resolución de captcha por IA
 * Base URL: https://api-adres-ghg.virtual-tec.com
 */

export type TipoDocumento = 'CC' | 'TI' | 'CE' | 'PA' | 'RC' | 'NU' | 'AS' | 'MS' | 'CD' | 'CN' | 'SC' | 'PE' | 'PT'

export interface ADRESAfiliadoInfo {
    tipo_identificacion: string | null
    numero_identificacion: string | null
    nombres: string | null
    apellidos: string | null
    fecha_nacimiento: string | null
}

export interface ADRESAfiliacionData {
    estado: string
    entidad: string
    regimen: string
    fecha_afiliacion: string
    fecha_finalizacion: string
    tipo_afiliado: string
}

export interface ADRESStructuredData {
    basic_info: ADRESAfiliadoInfo
    affiliation_data: ADRESAfiliacionData[]
}

export interface ADRESResponse {
    success: boolean
    message: string
    data?: {
        timestamp: string
        url: string
        title: string
        full_text: string
        tables_data: { index: number; text: string }[]
        structured_data: ADRESStructuredData
        extraction_success: boolean
    }
}

/**
 * Consulta automática de afiliación en ADRES
 * Usa OpenAI para resolver el captcha automáticamente
 */
export async function consultarADRES(
    tipoDocumento: TipoDocumento,
    numeroDocumento: string,
    maxRetries: number = 3
): Promise<ADRESResponse> {
    const baseUrl = process.env.ADRES_API_URL

    if (!baseUrl) {
        throw new Error('ADRES_API_URL no configurada en variables de entorno')
    }

    const response = await fetch(`${baseUrl}/api/auto/query-with-retry?max_retries=${maxRetries}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            tipo_documento: tipoDocumento,
            numero_documento: numeroDocumento
        })
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Error consultando ADRES: ${response.status} - ${errorText}`)
    }

    return response.json()
}

/**
 * Verifica si un paciente está activo en ADRES
 */
export async function verificarAfiliacionADRES(
    tipoDocumento: TipoDocumento,
    numeroDocumento: string
): Promise<{
    afiliado: boolean
    estado: string
    entidad: string | null
    regimen: string | null
    tipoAfiliado: string | null
    nombreCompleto: string | null
}> {
    try {
        const response = await consultarADRES(tipoDocumento, numeroDocumento)

        if (!response.success || !response.data?.structured_data) {
            return {
                afiliado: false,
                estado: 'NO_ENCONTRADO',
                entidad: null,
                regimen: null,
                tipoAfiliado: null,
                nombreCompleto: null
            }
        }

        const { basic_info, affiliation_data } = response.data.structured_data

        // Buscar afiliación activa
        const afiliacionActiva = affiliation_data.find(
            a => a.estado?.toUpperCase() === 'ACTIVO'
        )

        const nombreCompleto = [basic_info.nombres, basic_info.apellidos]
            .filter(Boolean)
            .join(' ') || null

        if (afiliacionActiva) {
            return {
                afiliado: true,
                estado: 'ACTIVO',
                entidad: afiliacionActiva.entidad,
                regimen: afiliacionActiva.regimen,
                tipoAfiliado: afiliacionActiva.tipo_afiliado,
                nombreCompleto
            }
        }

        // Si no hay afiliación activa, retornar el último estado
        const ultimaAfiliacion = affiliation_data[0]
        return {
            afiliado: false,
            estado: ultimaAfiliacion?.estado || 'INACTIVO',
            entidad: ultimaAfiliacion?.entidad || null,
            regimen: ultimaAfiliacion?.regimen || null,
            tipoAfiliado: ultimaAfiliacion?.tipo_afiliado || null,
            nombreCompleto
        }
    } catch (error) {
        console.error('Error verificando afiliación ADRES:', error)
        throw error
    }
}
