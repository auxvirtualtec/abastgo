"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { Building2 } from "lucide-react";

export default function OnboardingPage() {
    const { data: session, update } = useSession();
    const [step, setStep] = useState<"welcome" | "create-org">("welcome");
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/organizations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, slug }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Error al crear la organización");
                return;
            }

            // Actualizar la sesión para que incluya la nueva organización y rol
            await update();

            // Redirigir al dashboard principal
            router.push("/");
            router.refresh();

        } catch (err) {
            setError("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    // Auto-generar slug simple
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setName(val);
        if (!slug) {
            setSlug(val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <Card className="w-full max-w-lg shadow-xl">
                <CardHeader className="text-center pb-8 border-b dark:border-gray-800">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <CardTitle className="text-2xl">Bienvenido a DispenzaBot</CardTitle>
                    <CardDescription className="text-base mt-2">
                        {step === "welcome"
                            ? "Vamos a configurar tu espacio de trabajo"
                            : "Crea tu primera organización"}
                    </CardDescription>
                </CardHeader>

                <CardContent className="pt-8">
                    {step === "welcome" ? (
                        <div className="space-y-6 text-center">
                            <p className="text-gray-600 dark:text-gray-400">
                                DispenzaBot funciona con <strong>Organizaciones</strong>.
                                Necesitas crear una o ser invitado a una existente para comenzar a gestionar tu inventario y dispensaciones.
                            </p>

                            <div className="grid gap-4">
                                <Button
                                    size="lg"
                                    onClick={() => setStep("create-org")}
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                >
                                    Crear mi Organización
                                </Button>
                                <p className="text-xs text-gray-500">
                                    Si te han invitado, pide al administrador que te envíe el enlace de invitación.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleCreateOrg} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="orgName">Nombre de la Organización</Label>
                                <Input
                                    id="orgName"
                                    placeholder="Ej: Farmacia Central"
                                    value={name}
                                    onChange={handleNameChange}
                                    required
                                    className="h-11"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="orgSlug">URL del espacio (Slug)</Label>
                                <div className="flex items-center">
                                    <span className="bg-gray-100 dark:bg-gray-800 border border-r-0 rounded-l-md px-3 h-11 flex items-center text-sm text-gray-500 border-gray-200 dark:border-gray-700">
                                        dispenzabot.com/
                                    </span>
                                    <Input
                                        id="orgSlug"
                                        placeholder="farmacia-central"
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                        required
                                        className="h-11 rounded-l-none"
                                    />
                                </div>
                                <p className="text-xs text-gray-500">Este será el identificador único de tu organización.</p>
                            </div>

                            {error && (
                                <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setStep("welcome")}
                                    disabled={loading}
                                >
                                    Atrás
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                                    disabled={loading}
                                >
                                    {loading ? "Creando..." : "Crear Organización"}
                                </Button>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
