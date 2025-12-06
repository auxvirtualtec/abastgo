import { NextRequest, NextResponse } from 'next/server'
import { verificarAfiliacionADRES, type TipoDocumento } from '@/lib/integrations/adres'

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

        const resultado = await verificarAfiliacionADRES(
            tipoDocumento as TipoDocumento,
            numeroDocumento
        )

        return NextResponse.json(resultado)
    } catch (error) {
        console.error('Error en API ADRES:', error)
        return NextResponse.json(
            { error: 'Error consultando ADRES', details: String(error) },
            { status: 500 }
        )
    }
}
