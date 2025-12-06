import { NextRequest, NextResponse } from 'next/server'
import { verificarAfiliacionEPSFamiliar } from '@/lib/integrations/eps-familiar'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { tipoDocumento, numeroDocumento } = body

        if (!tipoDocumento || !numeroDocumento) {
            return NextResponse.json(
                { error: 'tipoDocumento y numeroDocumento son requeridos' },
                { status: 400 }
            )
        }

        const resultado = await verificarAfiliacionEPSFamiliar(
            tipoDocumento,
            numeroDocumento
        )

        return NextResponse.json(resultado)
    } catch (error) {
        console.error('Error en API EPS Familiar:', error)
        return NextResponse.json(
            { error: 'Error consultando EPS Familiar', details: String(error) },
            { status: 500 }
        )
    }
}
