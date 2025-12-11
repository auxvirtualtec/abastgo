"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Shield, Key } from "lucide-react";

export default function ProfilePage() {
    const { data: session } = useSession();

    if (!session?.user) {
        return null;
    }

    const initials = session.user.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "U";

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold flex items-center gap-2">
                <User className="h-6 w-6" />
                Mi Perfil
            </h1>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Tarjeta de Resumen */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg">Información Personal</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center text-center space-y-4">
                        <Avatar className="h-24 w-24">
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-emerald-500 text-white text-2xl font-bold">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h2 className="font-semibold text-lg">{session.user.name}</h2>
                            <p className="text-sm text-gray-500">{session.user.email}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {session.user.roles?.map((role) => (
                                <span key={role} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                                    <Shield className="w-3 h-3 mr-1" />
                                    {role}
                                </span>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Formulario de Datos */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg">Detalles de la Cuenta</CardTitle>
                        <CardDescription>
                            Información de tu cuenta y sesión actual
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nombre Completo</Label>
                                <Input value={session.user.name || ''} disabled className="bg-gray-50 dark:bg-gray-800" />
                            </div>
                            <div className="space-y-2">
                                <Label>Correo Electrónico</Label>
                                <Input value={session.user.email || ''} disabled className="bg-gray-50 dark:bg-gray-800" />
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <Key className="h-4 w-4" />
                                Seguridad
                            </h3>
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div>
                                    <p className="text-sm font-medium">Contraseña</p>
                                    <p className="text-xs text-gray-500">Última actualización: hace 3 meses</p>
                                </div>
                                <Button variant="outline" size="sm" disabled>
                                    Cambiar Contraseña
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
