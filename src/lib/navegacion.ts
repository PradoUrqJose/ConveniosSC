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
  /** Pestañas de la barra inferior móvil (04-UI §0: máx. 4, incluido "Más"). */
  tabs: DestinoNav[];
  /** Destinos del menú "Más" (escritorio y móvil). */
  mas: DestinoNav[];
  /** Destinos de la barra lateral (escritorio ≥768px, 260px). */
  lateral: DestinoNav[];
};

const ENTRADA_INICIO: DestinoNav = {
  href: "/",
  etiqueta: "Inicio",
  descripcion: "Pantalla principal del vendedor",
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
  etiqueta: "Mis ventas",
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
    mas: [ENTRADA_PERFIL, ENTRADA_AUDITORIA],
    lateral: [ENTRADA_INICIO, ENTRADA_NUEVA_VENTA, ENTRADA_VENTAS],
  },
  ADMIN_EMPRESA: {
    tabs: [ENTRADA_DASHBOARD, ENTRADA_NUEVA_VENTA, ENTRADA_DASHBOARD_VENTAS],
    mas: [
      ENTRADA_EMPLEADOS,
      ENTRADA_USUARIOS,
      ENTRADA_SEDES,
      ENTRADA_AUDITORIA,
      ENTRADA_PERFIL,
    ],
    lateral: [
      ENTRADA_DASHBOARD,
      ENTRADA_NUEVA_VENTA,
      ENTRADA_DASHBOARD_VENTAS,
      ENTRADA_EMPLEADOS,
      ENTRADA_USUARIOS,
      ENTRADA_SEDES,
      ENTRADA_AUDITORIA,
    ],
  },
  SUPERADMIN: {
    tabs: [ENTRADA_DASHBOARD, ENTRADA_EMPRESAS, ENTRADA_CONVENIOS],
    mas: [ENTRADA_AUDITORIA, ENTRADA_PERFIL],
    lateral: [
      ENTRADA_DASHBOARD,
      ENTRADA_EMPRESAS,
      ENTRADA_CONVENIOS,
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
