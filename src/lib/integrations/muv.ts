/**
 * Cliente de integración con el MUV (Mecanismo Único de Validación)
 * del Ministerio de Salud de Colombia
 * 
 * Permite enviar RIPS JSON y FEV para obtener el CUV (Código Único de Validación)
 * 
 * Documentación: Manual de Consumo API Docker FEV-RIPS MinSalud
 */

import { prisma } from '@/lib/prisma'

// Configuración del MUV
const MUV_BASE_URL = process.env.MUV_API_URL || 'https://fev-rips.minsalud.gov.co/api'
const MUV_USERNAME = process.env.MUV_USERNAME || ''
const MUV_PASSWORD = process.env.MUV_PASSWORD || ''
const PRESTADOR_NIT = process.env.PRESTADOR_NIT || ''
const PRESTADOR_CODIGO = process.env.PRESTADOR_CODIGO || ''

interface MUVResponse {
    success: boolean
    cuv?: string
    mensaje?: string
    errores?: string[]
    fechaValidacion?: string
    estado?: string
}

interface RIPSValidacion {
    id: string
    ripsJson: any
    fevXml?: string
    cuv?: string
    estado: 'PENDIENTE' | 'ENVIADO' | 'VALIDADO' | 'RECHAZADO' | 'ERROR'
    errores?: string[]
    fechaEnvio?: Date
    fechaRespuesta?: Date
}

/**
 * Obtener token de autenticación del MUV
 */
async function obtenerTokenMUV(): Promise<string | null> {
    try {
        const response = await fetch(`${MUV_BASE_URL}/auth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: MUV_USERNAME,
                password: MUV_PASSWORD,
                nit: PRESTADOR_NIT
            })
        })

        if (!response.ok) {
            console.error('Error obteniendo token MUV:', response.statusText)
            return null
        }

        const data = await response.json()
        return data.token || null
    } catch (error) {
        console.error('Error de conexión con MUV:', error)
        return null
    }
}

/**
 * Enviar RIPS JSON al MUV para validación
 */
export async function enviarRIPSAlMUV(
    ripsJson: any,
    fevXml?: string
): Promise<MUVResponse> {
    try {
        // Validar configuración
        if (!MUV_USERNAME || !MUV_PASSWORD || !PRESTADOR_NIT) {
            return {
                success: false,
                mensaje: 'Configuración MUV incompleta. Verifique variables de entorno.',
                errores: ['Faltan credenciales MUV_USERNAME, MUV_PASSWORD o PRESTADOR_NIT']
            }
        }

        // Obtener token
        const token = await obtenerTokenMUV()
        if (!token) {
            return {
                success: false,
                mensaje: 'No se pudo autenticar con el MUV',
                errores: ['Error de autenticación']
            }
        }

        // Preparar payload
        const payload = {
            nitPrestador: PRESTADOR_NIT,
            codigoPrestador: PRESTADOR_CODIGO,
            ripsJson: ripsJson,
            ...(fevXml && { fevXml })
        }

        // Comprimir si es mayor a 50MB (según documentación)
        const jsonString = JSON.stringify(payload)
        const sizeInMB = Buffer.byteLength(jsonString, 'utf8') / (1024 * 1024)

        let body: any = jsonString
        let headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }

        // Si es muy grande, usar GZIP (simplificado - en producción usar zlib)
        if (sizeInMB > 50) {
            console.log('Archivo mayor a 50MB, se recomienda compresión GZIP')
            // En producción: comprimir con zlib.gzipSync(jsonString)
        }

        // Enviar al MUV
        const response = await fetch(`${MUV_BASE_URL}/validacion/rips`, {
            method: 'POST',
            headers,
            body
        })

        const data = await response.json()

        if (response.ok && data.cuv) {
            return {
                success: true,
                cuv: data.cuv,
                mensaje: 'RIPS validados exitosamente',
                fechaValidacion: data.fechaValidacion || new Date().toISOString(),
                estado: 'VALIDADO'
            }
        } else {
            return {
                success: false,
                mensaje: data.mensaje || 'Error en validación',
                errores: data.errores || [data.mensaje || 'Error desconocido'],
                estado: 'RECHAZADO'
            }
        }
    } catch (error) {
        console.error('Error enviando RIPS al MUV:', error)
        return {
            success: false,
            mensaje: 'Error de conexión con el MUV',
            errores: [String(error)],
            estado: 'ERROR'
        }
    }
}

/**
 * Consultar estado de validación por CUV
 */
export async function consultarEstadoCUV(cuv: string): Promise<MUVResponse> {
    try {
        const token = await obtenerTokenMUV()
        if (!token) {
            return {
                success: false,
                mensaje: 'No se pudo autenticar con el MUV'
            }
        }

        const response = await fetch(`${MUV_BASE_URL}/validacion/estado/${cuv}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })

        const data = await response.json()

        return {
            success: response.ok,
            cuv,
            estado: data.estado,
            mensaje: data.mensaje,
            fechaValidacion: data.fechaValidacion
        }
    } catch (error) {
        console.error('Error consultando estado CUV:', error)
        return {
            success: false,
            mensaje: 'Error de conexión',
            errores: [String(error)]
        }
    }
}

/**
 * Validación local de estructura RIPS antes de envío
 * Según Resolución 2275/2023
 */
export function validarEstructuraRIPS(ripsJson: any): { valido: boolean; errores: string[] } {
    const errores: string[] = []

    // Validar campos obligatorios del encabezado
    if (!ripsJson.numDocumentoIdObligado) {
        errores.push('Falta numDocumentoIdObligado (NIT del prestador)')
    }
    if (!ripsJson.numFactura) {
        errores.push('Falta numFactura')
    }

    // Validar usuarios
    if (!ripsJson.usuarios || !Array.isArray(ripsJson.usuarios)) {
        errores.push('Falta array de usuarios')
    } else {
        ripsJson.usuarios.forEach((u: any, i: number) => {
            if (!u.tipoDocumentoIdentificacion) {
                errores.push(`Usuario ${i + 1}: falta tipoDocumentoIdentificacion`)
            }
            if (!u.numDocumentoIdentificacion) {
                errores.push(`Usuario ${i + 1}: falta numDocumentoIdentificacion`)
            }
        })
    }

    // Validar medicamentos
    if (!ripsJson.medicamentos || !Array.isArray(ripsJson.medicamentos)) {
        errores.push('Falta array de medicamentos')
    } else {
        ripsJson.medicamentos.forEach((m: any, i: number) => {
            if (!m.codMedicamento) {
                errores.push(`Medicamento ${i + 1}: falta codMedicamento`)
            }
            if (!m.numUnidades || m.numUnidades <= 0) {
                errores.push(`Medicamento ${i + 1}: numUnidades debe ser mayor a 0`)
            }
        })
    }

    return {
        valido: errores.length === 0,
        errores
    }
}

/**
 * Guardar log de envío al MUV
 */
export async function guardarLogMUV(
    ripsJson: any,
    response: MUVResponse,
    userId?: string,
    organizationId?: string
): Promise<void> {
    try {
        let finalOrgId = organizationId;

        if (!finalOrgId && userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { memberships: { select: { organizationId: true }, take: 1 } }
            })
            finalOrgId = user?.memberships[0]?.organizationId
        }

        if (!finalOrgId) {
            console.warn('Cannot save MUV log: Missing organizationId')
            return;
        }

        await prisma.auditLog.create({
            data: {
                organizationId: finalOrgId,
                userId: userId || null,
                action: response.success ? 'CREATE' : 'UPDATE',
                entity: 'muv_validation',
                entityId: response.cuv || `pending-${Date.now()}`,
                newValues: {
                    cuv: response.cuv,
                    estado: response.estado,
                    mensaje: response.mensaje,
                    errores: response.errores,
                    fechaValidacion: response.fechaValidacion,
                    numFactura: ripsJson.numFactura,
                    totalUsuarios: ripsJson.usuarios?.length || 0,
                    totalMedicamentos: ripsJson.medicamentos?.length || 0
                }
            }
        })
    } catch (error) {
        console.error('Error guardando log MUV:', error)
    }
}

/**
 * Estado de configuración del MUV
 */
export function estadoConfiguracionMUV(): {
    configurado: boolean
    detalles: Record<string, boolean>
} {
    return {
        configurado: !!(MUV_USERNAME && MUV_PASSWORD && PRESTADOR_NIT),
        detalles: {
            MUV_API_URL: !!MUV_BASE_URL,
            MUV_USERNAME: !!MUV_USERNAME,
            MUV_PASSWORD: !!MUV_PASSWORD,
            PRESTADOR_NIT: !!PRESTADOR_NIT,
            PRESTADOR_CODIGO: !!PRESTADOR_CODIGO
        }
    }
}
