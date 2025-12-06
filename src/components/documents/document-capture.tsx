"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Upload, X, Check, RotateCcw, Image as ImageIcon } from "lucide-react";

interface DocumentCaptureProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCapture: (imagePath: string) => void;
    title: string;
    description?: string;
    type: string; // 'patient_document', 'prescription', 'authorization', 'signature'
    entityId: string;
}

export function DocumentCapture({
    open,
    onOpenChange,
    onCapture,
    title,
    description,
    type,
    entityId
}: DocumentCaptureProps) {
    const [mode, setMode] = useState<'select' | 'camera' | 'preview'>('select');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: 1280, height: 720 }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setMode('camera');
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('No se pudo acceder a la cámara. Intente subir una imagen.');
        }
    };

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0);
                const imageData = canvas.toDataURL('image/jpeg', 0.85);
                setCapturedImage(imageData);
                stopCamera();
                setMode('preview');
            }
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setCapturedImage(event.target?.result as string);
                setMode('preview');
            };
            reader.readAsDataURL(file);
        }
    };

    const retake = () => {
        setCapturedImage(null);
        setMode('select');
    };

    const uploadImage = async () => {
        if (!capturedImage) return;

        setUploading(true);
        try {
            // Convertir base64 a blob
            const response = await fetch(capturedImage);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append('file', blob, `${type}_${entityId}.jpg`);
            formData.append('type', type);
            formData.append('entityId', entityId);

            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (uploadResponse.ok) {
                const data = await uploadResponse.json();
                onCapture(data.path);
                handleClose();
            } else {
                const error = await uploadResponse.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Error uploading:', error);
            alert('Error subiendo imagen');
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        stopCamera();
        setCapturedImage(null);
        setMode('select');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        {title}
                    </DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>

                <div className="mt-4">
                    {mode === 'select' && (
                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={startCamera}
                                className="h-24 flex-col gap-2"
                                variant="outline"
                            >
                                <Camera className="h-8 w-8" />
                                <span>Tomar Foto</span>
                            </Button>
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                className="h-24 flex-col gap-2"
                                variant="outline"
                            >
                                <Upload className="h-8 w-8" />
                                <span>Subir Imagen</span>
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                            />
                        </div>
                    )}

                    {mode === 'camera' && (
                        <div className="space-y-4">
                            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 border-4 border-dashed border-white/30 m-4 rounded pointer-events-none" />
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={handleClose}>
                                    <X className="h-4 w-4 mr-2" />
                                    Cancelar
                                </Button>
                                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={capturePhoto}>
                                    <Camera className="h-4 w-4 mr-2" />
                                    Capturar
                                </Button>
                            </div>
                        </div>
                    )}

                    {mode === 'preview' && capturedImage && (
                        <div className="space-y-4">
                            <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video">
                                <img
                                    src={capturedImage}
                                    alt="Preview"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={retake} disabled={uploading}>
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Repetir
                                </Button>
                                <Button
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                    onClick={uploadImage}
                                    disabled={uploading}
                                >
                                    {uploading ? (
                                        <span className="animate-pulse">Subiendo...</span>
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4 mr-2" />
                                            Confirmar
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Componente para mostrar miniatura de documento capturado
interface DocumentThumbnailProps {
    path?: string | null;
    label: string;
    onCapture: () => void;
    onView?: () => void;
}

export function DocumentThumbnail({ path, label, onCapture, onView }: DocumentThumbnailProps) {
    return (
        <div className="flex items-center gap-2">
            {path ? (
                <div className="flex items-center gap-2">
                    <div
                        className="w-12 h-12 rounded bg-green-50 border border-green-300 overflow-hidden cursor-pointer"
                        onClick={onView}
                    >
                        <img src={path} alt={label} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs font-medium text-green-700">{label}</p>
                        <p className="text-xs text-green-600">✓ Capturado</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={onCapture}>
                        <RotateCcw className="h-3 w-3" />
                    </Button>
                </div>
            ) : (
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={onCapture}
                >
                    <Camera className="h-4 w-4" />
                    {label}
                </Button>
            )}
        </div>
    );
}
