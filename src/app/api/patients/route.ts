import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verificarAfiliacionADRES, type TipoDocumento } from '@/lib/integrations/adres'

// GET - Buscar paciente por documento
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const documentType = searchParams.get('documentType') || 'CC'
        const documentNumber = searchParams.get('documentNumber')
        const checkAdres = searchParams.get('checkAdres') === 'true' // Solo consultar ADRES si se pide explícitamente

        if (!documentNumber) {
            return NextResponse.json(
                { error: 'documentNumber es requerido' },
                { status: 400 }
            )
        }

        // Buscar paciente en BD local
        const patient = await prisma.patient.findFirst({
            where: {
                documentNumber,
                documentType: documentType as any
            },
            include: {
                contracts: {
                    where: { isActive: true },
                    include: { eps: true }
                }
            }
        })

        if (patient) {
            return NextResponse.json({
                found: true,
                source: 'local',
                patient: {
                    id: patient.id,
                    documentType: patient.documentType,
                    documentNumber: patient.documentNumber,
                    name: patient.name,
                    phone: patient.phone,
                    address: patient.address,
                    city: patient.city,
                    diagnosis: patient.diagnosis,
                    documentPhotoPath: patient.documentPhotoPath,
                    contracts: patient.contracts.map(c => ({
                        epsCode: c.eps.code,
                        epsName: c.eps.name,
                        affiliationType: c.affiliationType,
                        regime: c.regime,
                        isActive: c.isActive
                    }))
                }
            })
        }

        // Si no se pide consultar ADRES, responder inmediatamente
        if (!checkAdres) {
            return NextResponse.json({
                found: false,
                message: 'Paciente no encontrado en base de datos local'
            })
        }

        // Consultar ADRES solo si se pidió explícitamente (con timeout de 5 segundos)
        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 5000)

            const adresResult = await verificarAfiliacionADRES(
                documentType as TipoDocumento,
                documentNumber
            )

            clearTimeout(timeoutId)

            if (adresResult.afiliado) {
                return NextResponse.json({
                    found: true,
                    source: 'adres',
                    patient: {
                        documentType,
                        documentNumber,
                        name: adresResult.nombreCompleto,
                        epsName: adresResult.entidad,
                        regime: adresResult.regimen,
                        affiliationType: adresResult.tipoAfiliado,
                        estado: adresResult.estado
                    }
                })
            }

            return NextResponse.json({
                found: false,
                message: 'Paciente no encontrado en BD local ni en ADRES'
            })
        } catch (adresError) {
            console.error('Error consultando ADRES:', adresError)
            return NextResponse.json({
                found: false,
                message: 'Paciente no encontrado. Consulta ADRES no disponible.'
            })
        }
    } catch (error) {
        console.error('Error buscando paciente:', error)
        return NextResponse.json(
            { found: false, message: 'Error buscando paciente' },
            { status: 500 }
        )
    }
}

// POST - Crear nuevo paciente
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            documentType,
            documentNumber,
            name,
            phone,
            address,
            city,
            diagnosis,
            epsCode,
            affiliationType,
            regime
        } = body

        if (!documentType || !documentNumber || !name) {
            return NextResponse.json(
                { error: 'documentType, documentNumber y name son requeridos' },
                { status: 400 }
            )
        }

        // Buscar o crear EPS
        let eps = null
        if (epsCode) {
            eps = await prisma.ePS.findUnique({ where: { code: epsCode } })
        }

        // Crear paciente
        const patient = await prisma.patient.create({
            data: {
                documentType: documentType as any,
                documentNumber,
                name,
                phone,
                address,
                city,
                diagnosis,
                contracts: eps ? {
                    create: {
                        epsId: eps.id,
                        affiliationType: affiliationType || 'COTIZANTE',
                        regime: regime || 'CONTRIBUTIVO',
                        startDate: new Date(),
                        isActive: true
                    }
                } : undefined
            },
            include: {
                contracts: {
                    include: { eps: true }
                }
            }
        })

        return NextResponse.json({ success: true, patient }, { status: 201 })
    } catch (error) {
        console.error('Error creando paciente:', error)
        return NextResponse.json(
            { error: 'Error creando paciente', details: String(error) },
            { status: 500 }
        )
    }
}
