"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Loader2, BarChart3, ArrowLeft, Download, FileSpreadsheet, FileText } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface RotationData {
    molecule: string;
    totalQuantity: number;
    averageRotation: number;
}

export default function RotationReportPage() {
    const [period, setPeriod] = useState<string>("day");
    const [date, setDate] = useState<{ from: Date; to: Date }>({
        from: subDays(new Date(), 30),
        to: new Date()
    });
    const [molecule, setMolecule] = useState<string>("all");
    const [moleculesList, setMoleculesList] = useState<string[]>([]);

    const [data, setData] = useState<RotationData[]>([]);
    const [loading, setLoading] = useState(true);

    // Cargar lista de moléculas
    useEffect(() => {
        fetch('/api/products/molecules')
            .then(res => res.json())
            .then(list => setMoleculesList(list))
            .catch(err => console.error("Error loading molecules", err));
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                period,
                startDate: date.from.toISOString(),
                endDate: date.to.toISOString(),
                molecule
            });
            const res = await fetch(`/api/reports/rotation?${query}`);
            if (res.ok) {
                const json = await res.json();
                setData(json.data);
            }
        } catch (error) {
            console.error("Error cargando reporte:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (date.from && date.to) {
            loadData();
        }
    }, [period, date, molecule]);

    // Calcular máximo para barras relativas
    const maxRotation = Math.max(...data.map(d => d.averageRotation), 0);

    const exportCSV = () => {
        const headers = ["Molécula", "Total Unidades", "Rotación Promedio"];
        const csvRows = [
            headers.join(','),
            ...data.map(row =>
                `"${row.molecule.replace(/"/g, '""')}",${row.totalQuantity},${row.averageRotation}`
            )
        ];
        const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rotacion_moleculas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Reporte de Rotación por Molécula", 14, 22);

        doc.setFontSize(11);
        doc.text(`Periodo: ${format(date.from, "dd/MM/yyyy")} - ${format(date.to, "dd/MM/yyyy")}`, 14, 30);
        doc.text(`Base: Promedio ${period === 'day' ? 'Diario' : period === 'week' ? 'Semanal' : 'Mensual'}`, 14, 36);

        autoTable(doc, {
            startY: 44,
            head: [['Molécula', 'Total Unidades', 'Rotación Promedio']],
            body: data.map(row => [row.molecule, row.totalQuantity, row.averageRotation.toFixed(2)]),
        });

        doc.save(`rotacion_moleculas_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <Link href="/reportes" className="flex items-center text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors w-fit">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Volver a Reportes
                </Link>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Rotación por Molécula</h1>
                        <p className="text-gray-500">Analiza el consumo promedio según el principio activo.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-wrap">
                        {/* Filtro Molécula */}
                        <Select value={molecule} onValueChange={setMolecule}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Todas las moléculas" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                <SelectItem value="all">Todas las moléculas</SelectItem>
                                {moleculesList.map(m => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Periodo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="day">Promedio Diario</SelectItem>
                                <SelectItem value="week">Promedio Semanal</SelectItem>
                                <SelectItem value="month">Promedio Mensual</SelectItem>
                            </SelectContent>
                        </Select>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-[240px] justify-start text-left font-normal",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date?.from ? (
                                        date.to ? (
                                            <>
                                                {format(date.from, "dd/MM/y", { locale: es })} -{" "}
                                                {format(date.to, "dd/MM/y", { locale: es })}
                                            </>
                                        ) : (
                                            format(date.from, "dd/MM/y", { locale: es })
                                        )
                                    ) : (
                                        <span>Seleccionar fechas</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={date?.from}
                                    selected={date}
                                    onSelect={(val: any) => setDate(val || { from: new Date(), to: new Date() })}
                                    numberOfMonths={2}
                                    locale={es}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* Botones de Exportación */}
                <div className="flex justify-end gap-2 mt-2">
                    <Button variant="outline" size="sm" onClick={exportCSV} disabled={data.length === 0}>
                        <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
                        Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportPDF} disabled={data.length === 0}>
                        <FileText className="h-4 w-4 mr-2 text-red-600" />
                        PDF
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex h-[400px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            ) : data.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-10">
                        <BarChart3 className="h-12 w-12 text-gray-300 mb-4" />
                        <p className="text-gray-500">No hay datos de rotación para este periodo.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {/* Gráfico de Barras Simple */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Top 10 Moléculas</CardTitle>
                            <CardDescription>
                                Mostrando las moléculas con mayor rotación {period === 'day' ? 'diaria' : period === 'week' ? 'semanal' : 'mensual'}.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {data.slice(0, 10).map((item, i) => (
                                    <div key={i} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium truncate max-w-[200px] md:max-w-md" title={item.molecule}>
                                                {item.molecule}
                                            </span>
                                            <span className="text-gray-500">
                                                {item.averageRotation.toFixed(1)} / {period === 'day' ? 'día' : period === 'week' ? 'sem' : 'mes'}
                                            </span>
                                        </div>
                                        <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                                style={{ width: `${(item.averageRotation / maxRotation) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tabla Detallada */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Detalle Completo</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-gray-500 border-b border-gray-200 dark:border-gray-800">
                                        <tr>
                                            <th className="py-3 font-medium">Molécula</th>
                                            <th className="py-3 font-medium text-right">Total Unidades</th>
                                            <th className="py-3 font-medium text-right">Rotación Promedio</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {data.map((item, i) => (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                                                <td className="py-3 font-medium">{item.molecule}</td>
                                                <td className="py-3 text-right">{item.totalQuantity.toLocaleString()}</td>
                                                <td className="py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                                                    {item.averageRotation.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
