import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// POST - Subir imagen/documento
export async function POST(request: NextRequest) {
    try {
        const data = await request.formData()
        const file: File | null = data.get('file') as unknown as File
        const type = data.get('type') as string // 'patient_document', 'prescription', 'authorization', 'signature', etc.
        const entityId = data.get('entityId') as string // ID del paciente o entrega

        if (!file) {
            return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
        }

        if (!type || !entityId) {
            return NextResponse.json({ error: 'Tipo y entityId son requeridos' }, { status: 400 })
        }

        // Validar tipo de archivo
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Tipo de archivo no permitido. Use: JPG, PNG, WebP' },
                { status: 400 }
            )
        }

        // Crear directorio según tipo
        const baseDir = path.join(process.cwd(), 'public', 'uploads', type)
        await mkdir(baseDir, { recursive: true })

        // Generar nombre de archivo único
        const timestamp = Date.now()
        const extension = file.name.split('.').pop() || 'jpg'
        const filename = `${entityId}_${timestamp}.${extension}`
        const filepath = path.join(baseDir, filename)

        // Guardar archivo
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        await writeFile(filepath, buffer)

        // Ruta relativa para guardar en base de datos
        const relativePath = `/uploads/${type}/${filename}`

        return NextResponse.json({
            success: true,
            path: relativePath,
            filename,
            size: file.size,
            type: file.type
        })
    } catch (error) {
        console.error('Error subiendo archivo:', error)
        return NextResponse.json(
            { error: 'Error subiendo archivo', details: String(error) },
            { status: 500 }
        )
    }
}
