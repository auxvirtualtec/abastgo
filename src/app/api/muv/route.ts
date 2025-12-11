import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
    enviarRIPSAlMUV,
    validarEstructuraRIPS,
    guardarLogMUV,
    estadoConfiguracionMUV,
    consultarEstadoCUV
} from '@/lib/integrations/muv'

/**
 * API para interactuar con el MUV (Mecanismo Único de Validación)
 * 
 * GET - Verificar estado de configuración o consultar CUV
 * POST - Enviar RIPS para validación
 */

// GET - Verificar configuración o consultar estado de CUV
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const action = searchParams.get('action')
        const cuv = searchParams.get('cuv')

        // Verificar configuración del MUV
        if (action === 'status' || !action) {
            const config = estadoConfiguracionMUV()
            return NextResponse.json({
                configurado: config.configurado,
                detalles: config.detalles,
                mensaje: config.configurado
                    ? 'MUV configurado correctamente'
                    : 'Configure las variables de entorno del MUV'
            })
        }

        // Consultar estado de un CUV
        if (action === 'consultar' && cuv) {
            const resultado = await consultarEstadoCUV(cuv)
            return NextResponse.json(resultado)
        }

        // Obtener historial de envíos
        if (action === 'historial') {
            const logs = await prisma.auditLog.findMany({
                where: { entity: 'muv_validation' },
                orderBy: { createdAt: 'desc' },
                take: 50,
                include: {
                    user: { select: { name: true } }
                }
            })

            return NextResponse.json({
                envios: logs.map(log => ({
                    id: log.id,
                    cuv: log.entityId,
                    fecha: log.createdAt,
                    estado: (log.newValues as any)?.estado,
                    mensaje: (log.newValues as any)?.mensaje,
                    numFactura: (log.newValues as any)?.numFactura,
                    usuario: log.user?.name || 'Sistema'
                }))
            })
        }

        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
    } catch (error) {
        console.error('Error en MUV API:', error)
        return NextResponse.json(
            { error: 'Error en API MUV', details: String(error) },
            { status: 500 }
        )
    }
}

// POST - Enviar RIPS al MUV para validación
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { ripsJson, fevXml, validarSolo } = body

        if (!ripsJson) {
            return NextResponse.json(
                { error: 'ripsJson es requerido' },
                { status: 400 }
            )
        }

        // Paso 1: Validar estructura local primero
        const validacionLocal = validarEstructuraRIPS(ripsJson)

        if (!validacionLocal.valido) {
            return NextResponse.json({
                success: false,
                etapa: 'VALIDACION_LOCAL',
                mensaje: 'RIPS no pasa validación local',
                errores: validacionLocal.errores
            })
        }

        // Si solo se quiere validar localmente
        if (validarSolo) {
            return NextResponse.json({
                success: true,
                etapa: 'VALIDACION_LOCAL',
                mensaje: 'RIPS válidos para envío al MUV',
                errores: []
            })
        }

        // Paso 2: Enviar al MUV
        const resultado = await enviarRIPSAlMUV(ripsJson, fevXml)

        // Paso 3: Guardar log
        await guardarLogMUV(ripsJson, resultado)

        if (resultado.success) {
            return NextResponse.json({
                success: true,
                etapa: 'MUV',
                cuv: resultado.cuv,
                mensaje: resultado.mensaje,
                fechaValidacion: resultado.fechaValidacion
            })
        } else {
            return NextResponse.json({
                success: false,
                etapa: 'MUV',
                mensaje: resultado.mensaje,
                errores: resultado.errores,
                estado: resultado.estado
            })
        }
    } catch (error) {
        console.error('Error enviando al MUV:', error)
        return NextResponse.json(
            { error: 'Error enviando al MUV', details: String(error) },
            { status: 500 }
        )
    }
}
