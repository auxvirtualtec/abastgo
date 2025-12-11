"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Building2, ChevronDown, Plus, Check, Shield } from "lucide-react";

interface Organization {
    id: string;
    name: string;
    slug: string;
    role?: string;
}

export function OrganizationSwitcher() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(false);

    const isSuperAdmin = session?.user?.isSuperAdmin || false;

    useEffect(() => {
        if (session?.user) {
            fetchOrganizations();
        }
    }, [session]);

    const fetchOrganizations = async () => {
        try {
            // Super Admin gets ALL organizations, regular users get their memberships
            const endpoint = isSuperAdmin
                ? "/api/admin/organizations/list"
                : "/api/organizations";

            const res = await fetch(endpoint);
            if (res.ok) {
                const data = await res.json();
                setOrganizations(data.organizations || []);
            }
        } catch (error) {
            console.error("Error fetching organizations:", error);
        }
    };

    const currentOrg = organizations.find(
        (org) => org.id === session?.user?.organizationId
    );

    const handleSwitch = async (orgId: string) => {
        setLoading(true);
        try {
            // Update session with new organization ID
            await update({ organizationId: orgId, isSuperAdminSwitch: isSuperAdmin });

            // Force full reload to clear local states
            window.location.href = '/';
        } catch (error) {
            console.error("Error cambiando de organización:", error);
            setLoading(false);
        }
    };

    if (!session?.user) return null;

    // Si el usuario no tiene organizaciones y no es Super Admin, mostrar mensaje
    if (organizations.length === 0 && !isSuperAdmin) {
        return (
            <Button variant="outline" disabled>
                <Building2 className="mr-2 h-4 w-4" />
                Sin organización
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-between">
                    <div className="flex items-center truncate">
                        <Building2 className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <span className="truncate">
                            {currentOrg?.name || "Seleccionar Organización"}
                        </span>
                    </div>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px]">
                <DropdownMenuLabel>
                    {isSuperAdmin ? (
                        <span className="flex items-center gap-1">
                            <Shield className="h-3 w-3 text-purple-500" />
                            Todas las Organizaciones
                        </span>
                    ) : (
                        "Mis Organizaciones"
                    )}
                </DropdownMenuLabel>
                {organizations.map((org) => (
                    <DropdownMenuItem
                        key={org.id}
                        onSelect={() => handleSwitch(org.id)}
                        className="cursor-pointer"
                    >
                        <Building2 className="mr-2 h-4 w-4 opacity-50" />
                        <span className="grow truncate">{org.name}</span>
                        {org.id === session?.user?.organizationId && (
                            <Check className="ml-2 h-4 w-4 text-emerald-600" />
                        )}
                    </DropdownMenuItem>
                ))}
                {/* Solo Super Admin puede crear nuevas organizaciones */}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
