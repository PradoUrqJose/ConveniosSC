"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { serializarParametrosEmpleados } from "@/modules/empleados/filtros";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Users,
  UsersRound,
  UserRound,
  X,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CabeceraPagina,
  EstadoBadge,
  Metrica,
} from "@/components/shell/pagina-ui";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatearSoles } from "@/lib/dinero";
import { fechaRelativa } from "@/lib/fechas";
import type { Pagina, Resultado } from "@/lib/tipos";
import { verificarEmpleado } from "@/modules/empleados/actions";
import type {
  ActividadEmpleados,
  EmpresaOpcion,
  FilaEmpleado,
  OrdenEmpleados,
  ResumenEmpleados,
} from "@/modules/empleados/query";
import { FormEmpleado } from "./form-empleado";
import { DialogoRechazo } from "./dialogo-rechazo";

const TABS = [
  { id: "todos", label: "Todos", resumen: "total" },
  { id: "pendientes", label: "Pendientes", resumen: "pendientes" },
  { id: "activos", label: "Activos", resumen: "activos" },
  { id: "inactivos", label: "Inactivos", resumen: "inactivos" },
  { id: "rechazados", label: "Rechazados", resumen: "rechazados" },
] as const;

// Igual que en Ventas (`ventas/ventas-client.tsx`): marca "primera página"
// dentro de `antes`, porque "" se interpreta como "sin parámetro".
const CENTINELA_PRIMERA_PAGINA = "-";

type Dialogo =
  | { tipo: "crear" }
  | { tipo: "detalle"; empleado: FilaEmpleado }
  | { tipo: "editar"; empleado: FilaEmpleado }
  | { tipo: "rechazar"; empleado: FilaEmpleado }
  | null;

// Semántica de color de docs/05-DESIGN-SYSTEM.md §1: ACTIVO → success,
// PENDIENTE_VERIFICACION → warning, RECHAZADO → destructive, INACTIVO →
// neutro. Un único mapa consumido por `EstadoBadge` en las tres vistas
// (tarjeta móvil, fila de tabla y detalle) evita que cada una invente su
// propio color, como ocurría antes.
const TONO_ESTADO: Record<
  FilaEmpleado["estado"],
  "success" | "warning" | "destructive" | "neutral"
> = {
  ACTIVO: "success",
  PENDIENTE_VERIFICACION: "warning",
  RECHAZADO: "destructive",
  INACTIVO: "neutral",
};

const TEXTO_ESTADO: Record<FilaEmpleado["estado"], string> = {
  ACTIVO: "Activo",
  PENDIENTE_VERIFICACION: "Pendiente",
  RECHAZADO: "Rechazado",
  INACTIVO: "Inactivo",
};

export function EmpleadosClient({
  pagina,
  tab,
  q,
  orden,
  actividad,
  porPagina,
  empresas,
  resumen,
  esSuperadmin,
  miEmpresaId,
}: {
  pagina: Pagina<FilaEmpleado>;
  tab: string;
  q?: string;
  orden: OrdenEmpleados;
  actividad?: ActividadEmpleados;
  porPagina: number;
  empresas: EmpresaOpcion[];
  resumen: ResumenEmpleados;
  esSuperadmin: boolean;
  miEmpresaId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [texto, setTexto] = useState(q ?? "");
  const [dialogo, setDialogo] = useState<Dialogo>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const entrada = Object.fromEntries(searchParams.entries());
      delete entrada.cursor;
      delete entrada.antes;
      if (texto) entrada.q = texto;
      else delete entrada.q;
      const query = serializarParametrosEmpleados(entrada);
      const target = query.size ? `${pathname}?${query}` : pathname;
      if (target !== `${pathname}?${searchParams.toString()}`) {
        router.replace(target);
      }
    }, 300);
    return () => clearTimeout(timer);
    // El cambio de URL se deriva exclusivamente del texto ya sincronizado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  // Cualquier cambio de filtro reinicia la paginación: descarta `cursor` y la
  // pila `antes` (ver más abajo). Las propias funciones de paginación vuelven
  // a añadirlos explícitamente en `cambios`.
  const urlDe = (cambios: Record<string, string | null>) => {
    const entrada = Object.fromEntries(searchParams.entries());
    delete entrada.cursor;
    delete entrada.antes;
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null) delete entrada[clave];
      else entrada[clave] = valor;
    }
    const query = serializarParametrosEmpleados(entrada);
    return query.size ? `${pathname}?${query}` : pathname;
  };

  // --- Paginación por cursor con historial (issue #41) --------------------
  // `listarEmpleados` usa keyset pagination: solo sabe avanzar. Para permitir
  // "anterior" con rangos reales se guarda en la URL (`antes`) la pila de
  // cursores usados para llegar a cada página anterior — mismo patrón que
  // Ventas (`ventas/ventas-client.tsx`). "primera página" se representa con
  // el centinela `-`; ir atrás es desapilar y reusar ese cursor.
  const historial = (searchParams.get("antes") ?? "")
    .split(",")
    .filter(Boolean);
  const paginaActual = historial.length + 1;
  const totalPaginas = Math.max(
    1,
    Math.ceil((pagina.total ?? pagina.items.length) / porPagina),
  );
  const cursorActual = searchParams.get("cursor");

  const hrefSiguiente = pagina.cursor
    ? urlDe({
        cursor: pagina.cursor,
        antes: [...historial, cursorActual ?? CENTINELA_PRIMERA_PAGINA].join(
          ",",
        ),
      })
    : null;

  const hrefAnterior =
    historial.length > 0
      ? (() => {
          const cursorPrevio = historial[historial.length - 1];
          return urlDe({
            cursor:
              !cursorPrevio || cursorPrevio === CENTINELA_PRIMERA_PAGINA
                ? null
                : cursorPrevio,
            antes: historial.slice(0, -1).join(",") || null,
          });
        })()
      : null;

  const desde = pagina.items.length ? (paginaActual - 1) * porPagina + 1 : 0;
  const hasta = desde ? desde + pagina.items.length - 1 : 0;

  // El export cubre el universo filtrado completo (server, issue #41), no
  // solo la página visible: los mismos filtros salvo cursor/antes.
  const hrefExportar = (() => {
    const entrada = Object.fromEntries(searchParams.entries());
    delete entrada.cursor;
    delete entrada.antes;
    const query = serializarParametrosEmpleados(entrada);
    return `/api/empleados/exportar${query.size ? `?${query}` : ""}`;
  })();

  return (
    <section className="page-shell">
      <CabeceraPagina
        kicker="Gestión de convenios"
        icono={<UsersRound className="size-5" />}
        titulo="Empleados"
        descripcion="Administra los empleados afiliados, revisa su actividad y controla el estado de cada registro."
        acciones={
          <>
            <a
              href={hrefExportar}
              className={buttonVariants({ variant: "outline" })}
              title={`Exporta ${pagina.total ?? 0} empleados según el tab, la búsqueda, el orden y la actividad aplicados en esta vista`}
            >
              <Download className="size-4" /> Exportar
            </a>
            <Button onClick={() => setDialogo({ tipo: "crear" })}>
              <Plus className="size-4" /> Nuevo empleado
            </Button>
          </>
        }
        // En 390px el título competía con dos acciones de texto y terminaba
        // truncado (issue #52). En móvil la cabecera se queda solo con la
        // acción primaria, en 44x44; exportar baja a la barra de filtros,
        // que es donde se decide *qué* se exporta.
        accionesMovil={
          <Button
            size="icon-lg"
            aria-label="Nuevo empleado"
            onClick={() => setDialogo({ tipo: "crear" })}
          >
            <Plus className="size-5" />
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          etiqueta="Total de empleados"
          valor={resumen.total}
          detalle="Registros encontrados"
          icono={<Users className="size-4.5" />}
        />
        <Metrica
          etiqueta="Empleados activos"
          valor={resumen.activos}
          detalle={`${resumen.total ? Math.round((resumen.activos / resumen.total) * 100) : 0}% del total`}
          tono="success"
          icono={<Check className="size-4.5" />}
        />
        <Metrica
          etiqueta="Pendientes"
          valor={resumen.pendientes}
          detalle="Requieren validación"
          tono="warning"
          icono={<Clock3 className="size-4.5" />}
        />
        <Metrica
          etiqueta="Ventas últimos 30 días"
          valor={resumen.ventasUltimos30d}
          detalle={`${formatearSoles(resumen.montoUltimos30d)} acumulado`}
          tono="neutral"
          icono={<ReceiptText className="size-4.5" />}
        />
      </div>

      <div className="bg-card overflow-hidden rounded-2xl border shadow-[0_12px_30px_rgba(16,24,40,0.07)]">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2 md:flex-row">
            <div className="relative min-w-0 md:w-[360px]">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscar por nombre o documento"
                className="border-input bg-background focus:border-primary focus:ring-primary/15 h-10 w-full rounded-lg border pr-9 pl-9 text-sm outline-none focus:ring-4"
              />
              {texto ? (
                <button
                  type="button"
                  aria-label="Limpiar búsqueda"
                  onClick={() => setTexto("")}
                  className="text-muted-foreground hover:bg-muted absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <select
              value={actividad ?? "all"}
              onChange={(e) =>
                router.push(
                  urlDe({
                    actividad: e.target.value === "all" ? null : e.target.value,
                  }),
                )
              }
              className="border-input bg-background focus:ring-primary/15 h-10 rounded-lg border px-3 text-sm font-medium outline-none focus:ring-4"
            >
              <option value="all">Toda la actividad</option>
              <option value="con_compras">Con compras</option>
              <option value="sin_compras">Sin compras</option>
            </select>
            <select
              value={orden}
              onChange={(e) => router.push(urlDe({ orden: e.target.value }))}
              className="border-input bg-background focus:ring-primary/15 h-10 rounded-lg border px-3 text-sm font-medium outline-none focus:ring-4"
            >
              <option value="nombre_asc">Nombre A–Z</option>
              <option value="nombre_desc">Nombre Z–A</option>
              <option value="monto_desc">Mayor compra</option>
              <option value="reciente">Más recientes</option>
            </select>
          </div>
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span>
              <strong className="text-foreground">
                {pagina.total ?? pagina.items.length}
              </strong>{" "}
              resultados
            </span>
            <a
              href={hrefExportar}
              aria-label={`Exportar ${pagina.total ?? 0} empleados`}
              title={`Exporta ${pagina.total ?? 0} empleados según el tab, la búsqueda, el orden y la actividad aplicados en esta vista`}
              className={cn(
                buttonVariants({ variant: "outline", size: "icon-lg" }),
                "size-11 lg:hidden",
              )}
            >
              <Download className="size-4" />
            </a>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Actualizar listado"
              onClick={() => router.refresh()}
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        <nav
          aria-label="Estados de empleados"
          className="flex overflow-x-auto border-b px-4"
        >
          {TABS.map((item) => (
            <Link
              key={item.id}
              href={urlDe({ tab: item.id === "todos" ? null : item.id })}
              className={`relative flex h-12 items-center gap-2 px-3 text-sm font-semibold whitespace-nowrap after:absolute after:right-3 after:bottom-0 after:left-3 after:h-0.5 ${tab === item.id ? "text-primary after:bg-primary" : "text-muted-foreground hover:text-foreground after:bg-transparent"}`}
            >
              <span>{item.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${tab === item.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
              >
                {resumen[item.resumen]}
              </span>
            </Link>
          ))}
        </nav>

        {pagina.items.length === 0 ? (
          <div className="grid min-h-80 place-items-center px-5 text-center">
            <div>
              <span className="bg-primary/10 text-primary mx-auto grid size-14 place-items-center rounded-2xl">
                <Search className="size-6" />
              </span>
              <h2 className="mt-4 font-semibold">No encontramos empleados</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Revisa el texto ingresado o cambia los filtros aplicados.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="divide-y lg:hidden">
              {pagina.items.map((empleado) => (
                <TarjetaEmpleado
                  key={empleado.id}
                  empleado={empleado}
                  esSuperadmin={esSuperadmin}
                  alVer={() => setDialogo({ tipo: "detalle", empleado })}
                  alEditar={() => setDialogo({ tipo: "editar", empleado })}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[960px] table-fixed text-left">
                <thead className="bg-muted/45 text-muted-foreground text-xs tracking-[0.035em] uppercase">
                  <tr>
                    <th className="w-[34%] px-5 py-4">Empleado</th>
                    <th className="w-[15%] px-3 py-4">Actividad</th>
                    <th className="w-[16%] px-3 py-4">Consumo</th>
                    <th className="w-[15%] px-3 py-4">Estado</th>
                    <th className="w-[16%] px-3 py-4">Registro</th>
                    <th className="w-14 px-4 py-4" />
                  </tr>
                </thead>
                <tbody>
                  {pagina.items.map((empleado) => (
                    <FilaEmpleadoTabla
                      key={empleado.id}
                      empleado={empleado}
                      esSuperadmin={esSuperadmin}
                      alVer={() => setDialogo({ tipo: "detalle", empleado })}
                      alEditar={() => setDialogo({ tipo: "editar", empleado })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <footer className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-xs">
          <span className="text-muted-foreground">
            Mostrando <strong className="text-foreground">{desde}</strong> a{" "}
            <strong className="text-foreground">{hasta}</strong> de{" "}
            <strong className="text-foreground">{pagina.total ?? 0}</strong>{" "}
            empleados
          </span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden items-center gap-1.5 sm:flex">
              Página <strong className="text-foreground">{paginaActual}</strong>{" "}
              de <strong className="text-foreground">{totalPaginas}</strong>
            </span>
            <div className="flex gap-1">
              {hrefAnterior ? (
                <Link
                  href={hrefAnterior}
                  aria-label="Página anterior"
                  className="border-input hover:bg-muted grid size-8 place-items-center rounded-md border"
                >
                  <ChevronLeft className="size-4" />
                </Link>
              ) : (
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="size-4" />
                </Button>
              )}
              {hrefSiguiente ? (
                <Link
                  href={hrefSiguiente}
                  aria-label="Página siguiente"
                  className="border-input hover:bg-muted grid size-8 place-items-center rounded-md border"
                >
                  <ChevronRight className="size-4" />
                </Link>
              ) : (
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </footer>
      </div>

      {dialogo ? (
        <Dialog open onOpenChange={(abierto) => !abierto && setDialogo(null)}>
          {dialogo.tipo === "crear" ? (
            <FormEmpleado
              empresas={empresas}
              miEmpresaId={miEmpresaId}
              onCerrar={() => setDialogo(null)}
            />
          ) : null}
          {dialogo.tipo === "detalle" ? (
            <DetalleEmpleado
              empleado={dialogo.empleado}
              puedeGestionar={
                esSuperadmin || miEmpresaId === dialogo.empleado.empresaId
              }
              onEditar={() =>
                setDialogo({ tipo: "editar", empleado: dialogo.empleado })
              }
              onRechazar={() =>
                setDialogo({ tipo: "rechazar", empleado: dialogo.empleado })
              }
              onCerrar={() => setDialogo(null)}
            />
          ) : null}
          {dialogo.tipo === "editar" ? (
            <FormEmpleado
              empleado={dialogo.empleado}
              empresas={empresas}
              miEmpresaId={miEmpresaId}
              onCerrar={() => setDialogo(null)}
            />
          ) : null}
          {dialogo.tipo === "rechazar" ? (
            <DialogoRechazo
              empleado={dialogo.empleado}
              onCerrar={() => setDialogo(null)}
            />
          ) : null}
        </Dialog>
      ) : null}
    </section>
  );
}

function FilaEmpleadoTabla({
  empleado,
  esSuperadmin,
  alVer,
  alEditar,
}: {
  empleado: FilaEmpleado;
  esSuperadmin: boolean;
  alVer: () => void;
  alEditar: () => void;
}) {
  const nombre = `${empleado.nombres} ${empleado.apellidos}`;
  const iniciales = `${empleado.nombres[0] ?? ""}${empleado.apellidos[0] ?? ""}`;
  return (
    <tr className="hover:bg-primary/[0.025] border-b last:border-0">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="bg-muted grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold">
            {iniciales}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold uppercase">{nombre}</p>
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
              {empleado.tipoDocumento === "DNI" ? "DNI" : "CE"}{" "}
              {empleado.numeroDocumento}
              {empleado.telefono ? (
                <>
                  <span>·</span>
                  <a
                    href={`tel:${empleado.telefono}`}
                    className="hover:text-primary inline-flex items-center gap-1"
                  >
                    <Phone className="size-3" />
                    {empleado.telefono}
                  </a>
                </>
              ) : null}
              {esSuperadmin ? (
                <>
                  <span>·</span>
                  <span className="truncate">{empleado.empresaNombre}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <p className="text-sm font-semibold">
          {empleado.comprasUltimos30d} compra
          {empleado.comprasUltimos30d === 1 ? "" : "s"}
        </p>
        <p className="text-muted-foreground text-xs">Últimos 30 días</p>
      </td>
      <td className="px-3 py-3">
        <p className="text-sm font-semibold">
          {formatearSoles(empleado.montoUltimos30d)}
        </p>
        <p className="text-muted-foreground text-xs">Acumulado del período</p>
      </td>
      <td className="px-3 py-3">
        <EstadoBadge tono={TONO_ESTADO[empleado.estado]}>
          <span className="size-1.5 rounded-full bg-current" />
          {TEXTO_ESTADO[empleado.estado]}
        </EstadoBadge>
      </td>
      <td className="px-3 py-3">
        <p className="text-sm font-semibold">
          {fechaRelativa(empleado.createdAt)}
        </p>
        <p className="text-muted-foreground text-xs">Registrado</p>
      </td>
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Acciones de ${nombre}`}
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={alVer}>
              <Eye /> Ver detalle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={alEditar}>
              <Pencil /> Editar empleado
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function TarjetaEmpleado({
  empleado,
  esSuperadmin,
  alVer,
  alEditar,
}: {
  empleado: FilaEmpleado;
  esSuperadmin: boolean;
  alVer: () => void;
  alEditar: () => void;
}) {
  const nombre = `${empleado.nombres} ${empleado.apellidos}`;
  const iniciales = `${empleado.nombres[0] ?? ""}${empleado.apellidos[0] ?? ""}`;
  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <span className="from-primary/15 text-primary grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br to-cyan-400/15 text-xs font-extrabold">
          {iniciales}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold uppercase">{nombre}</h3>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {empleado.tipoDocumento === "DNI" ? "DNI" : "CE"}{" "}
                {empleado.numeroDocumento}
                {esSuperadmin ? ` · ${empleado.empresaNombre}` : ""}
              </p>
            </div>
            <EstadoBadge
              tono={TONO_ESTADO[empleado.estado]}
              className="shrink-0"
            >
              {TEXTO_ESTADO[empleado.estado]}
            </EstadoBadge>
          </div>
          <div className="text-muted-foreground mt-3 grid grid-cols-2 gap-2 text-xs">
            <span className="bg-muted/60 rounded-lg px-2.5 py-2">
              <strong className="text-foreground block text-sm">
                {empleado.comprasUltimos30d}
              </strong>
              compras en 30 días
            </span>
            <span className="bg-muted/60 rounded-lg px-2.5 py-2">
              <strong className="money text-foreground block truncate text-sm">
                {formatearSoles(empleado.montoUltimos30d)}
              </strong>
              consumo
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={alVer}>
              <Eye className="size-3.5" /> Ver detalle
            </Button>
            <Button variant="ghost" size="sm" onClick={alEditar}>
              <Pencil className="size-3.5" /> Editar
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function DetalleEmpleado({
  empleado,
  puedeGestionar,
  onEditar,
  onRechazar,
  onCerrar,
}: {
  empleado: FilaEmpleado;
  puedeGestionar: boolean;
  onEditar: () => void;
  onRechazar: () => void;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [estadoVerificacion, formActionVerificar, pendiente] = useActionState(
    verificarEmpleado,
    { ok: false, codigo: "VALIDACION", mensaje: "" } as Resultado<
      Record<string, never>
    >,
  );
  useEffect(() => {
    if (!estadoVerificacion.ok) return;
    toast.success("Empleado verificado");
    router.refresh();
    onCerrar();
  }, [estadoVerificacion, onCerrar, router]);
  const esPendiente = empleado.estado === "PENDIENTE_VERIFICACION";
  return (
    <DialogContent pending={pendiente} variant="detail" className="sm:max-w-md">
      <DialogHeader icon={<UserRound />} eyebrow="Ficha del empleado">
        <DialogTitle>
          {empleado.nombres} {empleado.apellidos}
        </DialogTitle>
        <DialogDescription>
          {empleado.tipoDocumento === "DNI" ? "DNI" : "CE"}{" "}
          {empleado.numeroDocumento} · {empleado.empresaNombre}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <dl className="divide-border/70 bg-muted/15 overflow-hidden rounded-[var(--radius-control)] border text-sm">
          <Detalle etiqueta="Estado">
            <EstadoBadge tono={TONO_ESTADO[empleado.estado]}>
              {TEXTO_ESTADO[empleado.estado]}
            </EstadoBadge>
          </Detalle>
          <Detalle etiqueta="Teléfono">{empleado.telefono ?? "—"}</Detalle>
          <Detalle etiqueta="Compras (30 días)">
            {empleado.comprasUltimos30d} ·{" "}
            {formatearSoles(empleado.montoUltimos30d)}
          </Detalle>
          {empleado.creadoPorNombre ? (
            <Detalle etiqueta="Creado por">
              {empleado.creadoPorNombre} · {fechaRelativa(empleado.createdAt)}
            </Detalle>
          ) : null}
        </dl>
      </DialogBody>
      {puedeGestionar ? (
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {esPendiente ? (
            <form action={formActionVerificar} className="flex flex-col gap-2">
              <input type="hidden" name="empleadoId" value={empleado.id} />
              <Button type="submit" disabled={pendiente} className="w-full">
                {pendiente ? "Verificando…" : "Verificar empleado"}
              </Button>
            </form>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onEditar}
            >
              Editar datos
            </Button>
            {esPendiente ? (
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                onClick={onRechazar}
              >
                Rechazar
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      ) : null}
    </DialogContent>
  );
}

function Detalle({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
