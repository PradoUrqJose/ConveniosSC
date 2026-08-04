import {
  Building2,
  Handshake,
  House,
  LayoutDashboard,
  List,
  Plus,
  ShieldCheck,
  ShoppingCart,
  User,
  Users,
} from "lucide-react";

import type { DestinoNav } from "@/lib/navegacion";

const iconoPorHref: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "/": House,
  "/dashboard": LayoutDashboard,
  "/ventas/nueva": Plus,
  "/ventas": ShoppingCart,
  "/empleados": Users,
  "/usuarios": User,
  "/sedes": Building2,
  "/auditoria": ShieldCheck,
  "/admin/empresas": Building2,
  "/admin/convenios": Handshake,
  "/perfil": User,
};

const FALLO: React.ComponentType<{ className?: string }> = List;

/** Icono lucide asociado a un destino de navegación por ruta. */
export function IconoDestino({
  destino,
  className,
}: {
  destino: DestinoNav;
  className?: string;
}) {
  const Icon = iconoPorHref[destino.href] ?? FALLO;
  return <Icon className={className} aria-hidden="true" />;
}
