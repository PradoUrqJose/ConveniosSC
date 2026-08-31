import type { RolUsuario } from "@/lib/auth/sesion";

export type DestinoNav = {
  href: string;
  etiqueta: string;
  descripcion: string;
  destacado?: boolean;
  /** Solo en el menú "Más". */
  soloMas?: boolean;
};

export type Navegacion = {
  /**
   * Pestañas de la barra inferior móvil (PWA). Solo operación urgente: no hay
   * menú "Más". "Nueva venta" va siempre en la posición central.
   */
  tabs: DestinoNav[];
  /** Destinos extra del escritorio que no entran en la barra lateral. */
  mas: DestinoNav[];
  /** Destinos de la barra lateral (escritorio ≥768px, 260px). */
  lateral: DestinoNav[];
};

const ENTRADA_INICIO: DestinoNav = {
  href: "/",
  etiqueta: "Dashboard",
  descripcion: "Resumen de tu actividad",
};

const ENTRADA_DASHBOARD: DestinoNav = {
  href: "/dashboard",
  etiqueta: "Dashboard",
  descripcion: "Resumen de actividad y ventas",
};

const ENTRADA_NUEVA_VENTA: DestinoNav = {
  href: "/ventas/nueva",
  etiqueta: "Nueva venta",
  descripcion: "Registrar una venta con convenio",
  destacado: true,
};

const ENTRADA_VENTAS: DestinoNav = {
  href: "/ventas",
  etiqueta: "Ventas",
  descripcion: "Historial de ventas",
};

const ENTRADA_DASHBOARD_VENTAS: DestinoNav = {
  href: "/ventas",
  etiqueta: "Ventas",
  descripcion: "Todas las ventas de la empresa",
};

const ENTRADA_EMPLEADOS: DestinoNav = {
  href: "/empleados",
  etiqueta: "Empleados",
  descripcion: "Empleados y verificación de convenio",
};

const ENTRADA_USUARIOS: DestinoNav = {
  href: "/usuarios",
  etiqueta: "Usuarios",
  descripcion: "Usuarios del sistema",
};

const ENTRADA_SEDES: DestinoNav = {
  href: "/sedes",
  etiqueta: "Sedes",
  descripcion: "Sedes de la empresa",
};

const ENTRADA_AUDITORIA: DestinoNav = {
  href: "/auditoria",
  etiqueta: "Auditoría",
  descripcion: "Registro de auditoría",
};

const ENTRADA_EMPRESAS: DestinoNav = {
  href: "/admin/empresas",
  etiqueta: "Empresas",
  descripcion: "Empresas con convenio",
};

const ENTRADA_CONVENIOS: DestinoNav = {
  href: "/admin/convenios",
  etiqueta: "Convenios",
  descripcion: "Convenios vigentes",
};

const ENTRADA_PERFIL: DestinoNav = {
  href: "/perfil",
  etiqueta: "Perfil",
  descripcion: "Datos de tu cuenta",
};

const NAVEGACION_POR_ROL: Record<RolUsuario, Navegacion> = {
  VENDEDOR: {
    tabs: [ENTRADA_INICIO, ENTRADA_NUEVA_VENTA, ENTRADA_VENTAS],
    mas: [ENTRADA_PERFIL],
    lateral: [ENTRADA_INICIO, ENTRADA_NUEVA_VENTA, ENTRADA_VENTAS],
  },
  ADMIN_EMPRESA: {
    tabs: [
      ENTRADA_DASHBOARD,
      ENTRADA_DASHBOARD_VENTAS,
      ENTRADA_NUEVA_VENTA,
      ENTRADA_EMPLEADOS,
      ENTRADA_SEDES,
    ],
    mas: [ENTRADA_EMPLEADOS, ENTRADA_SEDES, ENTRADA_AUDITORIA, ENTRADA_PERFIL],
    lateral: [
      ENTRADA_DASHBOARD,
      ENTRADA_DASHBOARD_VENTAS,
      ENTRADA_NUEVA_VENTA,
      ENTRADA_EMPLEADOS,
      ENTRADA_SEDES,
      ENTRADA_AUDITORIA,
    ],
  },
  SUPERADMIN: {
    // Sin "Nueva venta": registrar ventas está restringido a VENDEDOR y
    // ADMIN_EMPRESA (`requireRol` en /ventas/nueva y en las actions).
    tabs: [
      ENTRADA_DASHBOARD,
      ENTRADA_DASHBOARD_VENTAS,
      ENTRADA_EMPLEADOS,
      ENTRADA_SEDES,
    ],
    mas: [
      ENTRADA_SEDES,
      ENTRADA_EMPRESAS,
      ENTRADA_CONVENIOS,
      ENTRADA_USUARIOS,
      ENTRADA_AUDITORIA,
      ENTRADA_PERFIL,
    ],
    lateral: [
      ENTRADA_DASHBOARD,
      ENTRADA_DASHBOARD_VENTAS,
      ENTRADA_EMPLEADOS,
      ENTRADA_SEDES,
      ENTRADA_EMPRESAS,
      ENTRADA_CONVENIOS,
      ENTRADA_USUARIOS,
      ENTRADA_AUDITORIA,
    ],
  },
};

export function navegacionPorRol(rol: RolUsuario): Navegacion {
  return NAVEGACION_POR_ROL[rol];
}

const NOMBRE_ROL: Record<RolUsuario, string> = {
  VENDEDOR: "Vendedor",
  ADMIN_EMPRESA: "Administrador",
  SUPERADMIN: "Super administrador",
};

export function nombreRol(rol: RolUsuario): string {
  return NOMBRE_ROL[rol];
}

/** Pestaña activa de la barra de navegación para la ruta actual. */
export function estaActivo(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  if (pathname === href) {
    return true;
  }
  if (!pathname.startsWith(href + "/")) {
    return false;
  }
  if (href === "/ventas" && pathname.startsWith("/ventas/nueva")) {
    return false;
  }
  return true;
}
