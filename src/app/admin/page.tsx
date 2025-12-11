'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Building2, Users, ShieldX, Plus, Pencil, Trash2 } from 'lucide-react'

interface Organization {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    admins: { user: { name: string; email: string } }[];
    _count: { members: number };
}

export default function AdminDashboardPage() {
    const { data: session, status } = useSession()
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)

    // Form states
    const [formName, setFormName] = useState('')
    const [formSlug, setFormSlug] = useState('')
    const [formOwnerEmail, setFormOwnerEmail] = useState('')
    const [formError, setFormError] = useState('')
    const [formLoading, setFormLoading] = useState(false)

    const fetchStats = () => {
        fetch('/api/admin/stats')
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    console.error(data.error)
                } else {
                    setStats(data)
                }
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }

    useEffect(() => {
        if (session?.user?.isSuperAdmin) {
            fetchStats()
        } else if (status !== 'loading') {
            setLoading(false)
        }
    }, [session, status])

    // Create Organization
    const handleCreate = async () => {
        setFormLoading(true)
        setFormError('')
        try {
            const res = await fetch('/api/admin/organizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formName,
                    slug: formSlug,
                    ownerEmail: formOwnerEmail || undefined
                })
            })
            const data = await res.json()
            if (!res.ok) {
                setFormError(data.error || 'Error al crear')
            } else {
                setShowCreateModal(false)
                resetForm()
                fetchStats()
            }
        } catch (e) {
            setFormError('Error de conexión')
        } finally {
            setFormLoading(false)
        }
    }

    // Edit Organization
    const handleEdit = async () => {
        if (!selectedOrg) return
        setFormLoading(true)
        setFormError('')
        try {
            const res = await fetch('/api/admin/organizations', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedOrg.id,
                    name: formName,
                    slug: formSlug
                })
            })
            const data = await res.json()
            if (!res.ok) {
                setFormError(data.error || 'Error al actualizar')
            } else {
                setShowEditModal(false)
                resetForm()
                fetchStats()
            }
        } catch (e) {
            setFormError('Error de conexión')
        } finally {
            setFormLoading(false)
        }
    }

    // Delete Organization
    const handleDelete = async () => {
        if (!selectedOrg) return
        setFormLoading(true)
        try {
            const res = await fetch(`/api/admin/organizations?id=${selectedOrg.id}`, {
                method: 'DELETE'
            })
            const data = await res.json()
            if (!res.ok) {
                alert('Error: ' + (data.error || 'No se pudo eliminar'))
            } else {
                setShowDeleteModal(false)
                setSelectedOrg(null)
                fetchStats()
            }
        } catch (e) {
            alert('Error de conexión')
        } finally {
            setFormLoading(false)
        }
    }

    const resetForm = () => {
        setFormName('')
        setFormSlug('')
        setFormOwnerEmail('')
        setFormError('')
        setSelectedOrg(null)
    }

    const openEditModal = (org: Organization) => {
        setSelectedOrg(org)
        setFormName(org.name)
        setFormSlug(org.slug)
        setShowEditModal(true)
    }

    const openDeleteModal = (org: Organization) => {
        setSelectedOrg(org)
        setShowDeleteModal(true)
    }

    // Loading session
    if (status === 'loading') {
        return <div className="p-8">Verificando acceso...</div>
    }

    // Not authenticated
    if (!session?.user) {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
                <ShieldX className="h-16 w-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-red-600">Acceso Denegado</h1>
                <p className="text-muted-foreground mt-2">Debes iniciar sesión para acceder a esta página.</p>
            </div>
        )
    }

    // Not a super admin
    if (!session.user.isSuperAdmin) {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
                <ShieldX className="h-16 w-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-red-600">Acceso Restringido</h1>
                <p className="text-muted-foreground mt-2">
                    Esta página es exclusiva para Super Administradores de la plataforma.
                </p>
            </div>
        )
    }

    if (loading) return <div className="p-8">Cargando panel de administración...</div>

    if (!stats) return <div className="p-8">Error cargando datos.</div>

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
                    <p className="text-muted-foreground">Visión global de la plataforma DispenzaBot</p>
                </div>
                <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" /> Nueva Organización
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Organizaciones</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.counts.organizations}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.counts.users}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Organizations Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Organizaciones Registradas</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Slug (URL)</TableHead>
                                <TableHead>Miembros</TableHead>
                                <TableHead>Admin Principal</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.organizations.map((org: Organization) => (
                                <TableRow key={org.id}>
                                    <TableCell className="font-medium">{org.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{org.slug}</Badge>
                                    </TableCell>
                                    <TableCell>{org._count.members}</TableCell>
                                    <TableCell>
                                        {org.admins[0]?.user?.email || <span className="text-gray-400">Sin asignar</span>}
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button size="sm" variant="outline" onClick={() => openEditModal(org)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => openDeleteModal(org)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Usuarios del Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Super Admin</TableHead>
                                <TableHead>Membresías</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.users.map((user: any) => (
                                <TableRow key={user.id}>
                                    <TableCell>{user.name || 'Sin nombre'}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        {user.isSuperAdmin ? (
                                            <Badge className="bg-purple-600">Super Admin</Badge>
                                        ) : (
                                            <span className="text-gray-400">No</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {user.memberships.map((m: any) => (
                                                <Badge key={m.organizationId} variant="secondary">
                                                    {m.organization.name} ({m.role})
                                                </Badge>
                                            ))}
                                            {user.memberships.length === 0 && <span className="text-muted-foreground text-sm">Sin organización</span>}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create Modal */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nueva Organización</DialogTitle>
                        <DialogDescription>Crear una nueva empresa en la plataforma</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre</Label>
                            <Input
                                id="name"
                                value={formName}
                                onChange={(e) => {
                                    setFormName(e.target.value)
                                    if (!formSlug) {
                                        setFormSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
                                    }
                                }}
                                placeholder="Farmacia Central"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="slug">Slug (URL)</Label>
                            <Input
                                id="slug"
                                value={formSlug}
                                onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                placeholder="farmacia-central"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ownerEmail">Email del Dueño (opcional)</Label>
                            <Input
                                id="ownerEmail"
                                value={formOwnerEmail}
                                onChange={(e) => setFormOwnerEmail(e.target.value)}
                                placeholder="admin@empresa.com"
                            />
                        </div>
                        {formError && <p className="text-red-500 text-sm">{formError}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>Cancelar</Button>
                        <Button onClick={handleCreate} disabled={formLoading || !formName || !formSlug}>
                            {formLoading ? 'Creando...' : 'Crear'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Modal */}
            <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Organización</DialogTitle>
                        <DialogDescription>Modificar datos de la organización</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="editName">Nombre</Label>
                            <Input id="editName" value={formName} onChange={(e) => setFormName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="editSlug">Slug (URL)</Label>
                            <Input id="editSlug" value={formSlug} onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} />
                        </div>
                        {formError && <p className="text-red-500 text-sm">{formError}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowEditModal(false); resetForm(); }}>Cancelar</Button>
                        <Button onClick={handleEdit} disabled={formLoading || !formName || !formSlug}>
                            {formLoading ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Eliminar Organización?</DialogTitle>
                        <DialogDescription>
                            Esta acción eliminará permanentemente <strong>{selectedOrg?.name}</strong> y todos sus datos asociados.
                            Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowDeleteModal(false); setSelectedOrg(null); }}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={formLoading}>
                            {formLoading ? 'Eliminando...' : 'Eliminar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
