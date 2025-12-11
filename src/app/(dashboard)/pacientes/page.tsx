"use client";

import { useState, useEffect } from "react";
import { Link } from "lucide-react"; // Import incorrecto, Link de next/link
import NextLink from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, User, FileText, ArrowRight, Loader2 } from "lucide-react";
// import { useDebounce } from "@/hooks/use-debounce"; 

interface Patient {
    id: string;
    name: string;
    documentType: string;
    documentNumber: string;
    epsName: string;
    phone: string;
    city: string;
}

export default function PacientesPage() {
    const [search, setSearch] = useState("");
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Debounce manual
    useEffect(() => {
        const timer = setTimeout(() => {
            loadPatients();
        }, 500);
        return () => clearTimeout(timer);
    }, [search, page]);

    const loadPatients = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                search,
                page: page.toString(),
                limit: "10"
            });
            const res = await fetch(`/api/patients?${params}`);
            if (res.ok) {
                const data = await res.json();
                setPatients(data.patients);
                setTotalPages(data.meta.totalPages);
            }
        } catch (error) {
            console.error("Error cargando pacientes", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Directorio de Pacientes</h1>
                <p className="text-gray-500">Consulta y gestiona la información de pacientes y sus historias clínicas.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Búsqueda</CardTitle>
                    <CardDescription>Busca por nombre, número de documento o EPS.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Buscar paciente..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }} // Reset page on search
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Paciente</TableHead>
                                <TableHead>Documento</TableHead>
                                <TableHead>EPS Actual</TableHead>
                                <TableHead>Ubicación</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                                    </TableCell>
                                </TableRow>
                            ) : patients.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                                        No se encontraron pacientes
                                    </TableCell>
                                </TableRow>
                            ) : (
                                patients.map((patient) => (
                                    <TableRow key={patient.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                    {patient.name.charAt(0)}
                                                </div>
                                                <div className="font-medium">{patient.name}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {patient.documentType} {patient.documentNumber}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal">
                                                {patient.epsName}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-gray-500 text-sm">
                                            {patient.city || '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild size="sm" variant="ghost">
                                                <NextLink href={`/pacientes/${patient.id}`}>
                                                    Ver Historia <ArrowRight className="ml-2 h-4 w-4" />
                                                </NextLink>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Paginación simple */}
            <div className="flex items-center justify-between">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                >
                    Anterior
                </Button>
                <span className="text-sm text-gray-500">
                    Página {page} de {totalPages || 1}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                >
                    Siguiente
                </Button>
            </div>
        </div>
    );
}
