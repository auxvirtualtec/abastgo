"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
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
import { Eye, EyeOff } from "lucide-react";

function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    // Obtener URL de callback (a dónde redirigir después del login)
    const callbackUrl = searchParams.get("callbackUrl") || "/";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError("Credenciales inválidas");
            } else {
                // Fetch session to check if Super Admin
                const sessionRes = await fetch("/api/auth/session");
                const session = await sessionRes.json();

                if (session?.user?.isSuperAdmin) {
                    // Super Admin goes to admin panel
                    router.push("/admin");
                } else {
                    router.push(callbackUrl);
                }
                router.refresh();
            }
        } catch {
            setError("Error al iniciar sesión");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md mx-4 shadow-2xl border-0 backdrop-blur-sm bg-white/80 dark:bg-gray-900/80">
            <CardHeader className="space-y-4 pb-8">
                <div className="flex items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg">
                        <svg
                            className="w-7 h-7 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                            />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-center mb-6">DispenzaBot</h1>
                </div>
                <CardDescription className="text-center text-base text-gray-600 dark:text-gray-400">
                    Sistema de Gestión de Dispensarios
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-medium">
                            Correo electrónico
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="usuario@empresa.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="h-11 transition-all focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-sm font-medium">
                            Contraseña
                        </Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="h-11 pr-10 transition-all focus:ring-2 focus:ring-blue-500/20"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-5 w-5" />
                                ) : (
                                    <Eye className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    </div>
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">
                            {error}
                        </div>
                    )}
                    <Button
                        type="submit"
                        className="w-full h-11 text-base font-semibold bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        fill="none"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                    />
                                </svg>
                                Iniciando sesión...
                            </span>
                        ) : (
                            "Iniciar Sesión"
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <LoginForm />
        </Suspense>
    );
}
