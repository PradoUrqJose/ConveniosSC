"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

import { Button } from "@/components/ui/button";
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
  EmpresaOpcion,
  FilaEmpleado,
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
  empresas,
  resumen,
  esSuperadmin,
  miEmpresaId,
}: {
  pagina: Pagina<FilaEmpleado>;
  tab: string;
  q?: string;
  empresas: EmpresaOpcion[];
  resumen: ResumenEmpleados;
  esSuperadmin: boolean;
  miEmpresaId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [texto, setTexto] = useState(q ?? "");
  const [actividad, setActividad] = useState("all");
  const [orden, setOrden] = useState("name-asc");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [dialogo, setDialogo] = useState<Dialogo>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("cursor");
      if (texto) params.set("q", texto);
      else params.delete("q");
      const target = `${pathname}?${params.toString()}`;
      if (target !== `${pathname}?${searchParams.toString()}`) {
        router.replace(target);
      }
    }, 300);
    return () => clearTimeout(timer);
    // El cambio de URL se deriva exclusivamente del texto ya sincronizado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const urlDe = (cambios: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cursor");
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null) params.delete(clave);
      else params.set(clave, valor);
    }
    return `${pathname}?${params.toString()}`;
  };

  const empleados = useMemo(() => {
    const filtrados = pagina.items.filter((empleado) =>
      actividad === "with-sales"
        ? empleado.comprasUltimos30d > 0
        : actividad === "without-sales"
          ? empleado.comprasUltimos30d === 0
          : true,
    );
    return [...filtrados].sort((a, b) => {
      const nombreA = `${a.apellidos} ${a.nombres}`;
      const nombreB = `${b.apellidos} ${b.nombres}`;
      if (orden === "name-desc") return nombreB.localeCompare(nombreA, "es");
      if (orden === "sales-desc") return b.montoUltimos30d - a.montoUltimos30d;
      if (orden === "recent")
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      return nombreA.localeCompare(nombreB, "es");
    });
  }, [actividad, orden, pagina.items]);

  const todosSeleccionados =
    empleados.length > 0 &&
    empleados.every((empleado) => seleccionados.has(empleado.id));
  const algunSeleccionado = empleados.some((empleado) =>
    seleccionados.has(empleado.id),
  );

  const alternarSeleccion = (id: string) => {
    setSeleccionados((actuales) => {
      const siguiente = new Set(actuales);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  };

  const exportar = () => {
    const filas = [
      ["Nombre", "Documento", "Teléfono", "Compras", "Monto", "Estado"],
      ...empleados.map((empleado) => [
        `${empleado.nombres} ${empleado.apellidos}`,
        `${empleado.tipoDocumento === "DNI" ? "DNI" : "CE"} ${empleado.numeroDocumento}`,
        empleado.telefono ?? "",
        empleado.comprasUltimos30d,
        (empleado.montoUltimos30d / 100).toFixed(2),
        TEXTO_ESTADO[empleado.estado],
      ]),
    ];
    const csv = filas
      .map((fila) =>
        fila
          .map((celda) => `"${String(celda).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    enlace.download = "empleados.csv";
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  };

  return (
    <section className="page-shell">
      <CabeceraPagina
        kicker="Gestión de convenios"
        icono={<UsersRound className="size-5" />}
        titulo="Empleados"
        descripcion="Administra los empleados afiliados, revisa su actividad y controla el estado de cada registro."
        acciones={
          <>
            <Button variant="outline" onClick={exportar}>
              <Download className="size-4" /> Exportar
            </Button>
            <Button onClick={() => setDialogo({ tipo: "crear" })}>
              <Plus className="size-4" /> Nuevo empleado
            </Button>
          </>
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
              value={actividad}
              onChange={(e) => setActividad(e.target.value)}
              className="border-input bg-background focus:ring-primary/15 h-10 rounded-lg border px-3 text-sm font-medium outline-none focus:ring-4"
            >
              <option value="all">Toda la actividad</option>
              <option value="with-sales">Con compras</option>
              <option value="without-sales">Sin compras</option>
            </select>
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
              className="border-input bg-background focus:ring-primary/15 h-10 rounded-lg border px-3 text-sm font-medium outline-none focus:ring-4"
            >
              <option value="name-asc">Nombre A–Z</option>
              <option value="name-desc">Nombre Z–A</option>
              <option value="sales-desc">Mayor compra</option>
              <option value="recent">Más recientes</option>
            </select>
          </div>
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span>
              <strong className="text-foreground">{empleados.length}</strong>{" "}
              resultados
            </span>
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

        {seleccionados.size ? (
          <div className="bg-primary/5 border-primary/15 flex min-h-13 items-center justify-between gap-3 border-b px-5 py-2 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <span className="bg-primary/10 text-primary grid size-7 place-items-center rounded-md">
                <Check className="size-4" />
              </span>
              {seleccionados.size} empleado{seleccionados.size === 1 ? "" : "s"}{" "}
              seleccionado{seleccionados.size === 1 ? "" : "s"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSeleccionados(new Set())}
            >
              Limpiar selección
            </Button>
          </div>
        ) : null}

        {empleados.length === 0 ? (
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
              {empleados.map((empleado) => (
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
              <table className="w-full min-w-[1040px] table-fixed text-left">
                <thead className="bg-muted/45 text-muted-foreground text-xs tracking-[0.035em] uppercase">
                  <tr>
                    <th className="w-13 px-5 py-4 text-center">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todos"
                        checked={todosSeleccionados}
                        ref={(input) => {
                          if (input)
                            input.indeterminate =
                              algunSeleccionado && !todosSeleccionados;
                        }}
                        onChange={() =>
                          setSeleccionados(
                            todosSeleccionados
                              ? new Set()
                              : new Set(
                                  empleados.map((empleado) => empleado.id),
                                ),
                          )
                        }
                        className="accent-primary size-4"
                      />
                    </th>
                    <th className="w-[31%] px-3 py-4">Empleado</th>
                    <th className="w-[14%] px-3 py-4">Actividad</th>
                    <th className="w-[15%] px-3 py-4">Consumo</th>
                    <th className="w-[14%] px-3 py-4">Estado</th>
                    <th className="w-[16%] px-3 py-4">Registro</th>
                    <th className="w-14 px-4 py-4" />
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((empleado) => (
                    <FilaEmpleadoTabla
                      key={empleado.id}
                      empleado={empleado}
                      seleccionado={seleccionados.has(empleado.id)}
                      esSuperadmin={esSuperadmin}
                      alSeleccionar={() => alternarSeleccion(empleado.id)}
                      alVer={() => setDialogo({ tipo: "detalle", empleado })}
                      alEditar={() => setDialogo({ tipo: "editar", empleado })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <footer className="flex min-h-16 items-center justify-between gap-3 border-t px-5 py-3 text-xs">
          <span className="text-muted-foreground">
            Mostrando{" "}
            <strong className="text-foreground">
              {empleados.length ? 1 : 0}
            </strong>{" "}
            a <strong className="text-foreground">{empleados.length}</strong>
            {pagina.total !== undefined ? (
              <>
                {" "}
                de <strong className="text-foreground">
                  {pagina.total}
                </strong>{" "}
                empleados
              </>
            ) : null}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            {pagina.cursor ? (
              <Link
                href={urlDe({ cursor: pagina.cursor })}
                className="border-input hover:bg-muted grid h-8 items-center rounded-md border px-3 font-semibold"
              >
                Cargar más <ChevronRight className="ml-1 size-4" />
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
  seleccionado,
  esSuperadmin,
  alSeleccionar,
  alVer,
  alEditar,
}: {
  empleado: FilaEmpleado;
  seleccionado: boolean;
  esSuperadmin: boolean;
  alSeleccionar: () => void;
  alVer: () => void;
  alEditar: () => void;
}) {
  const nombre = `${empleado.nombres} ${empleado.apellidos}`;
  const iniciales = `${empleado.nombres[0] ?? ""}${empleado.apellidos[0] ?? ""}`;
  return (
    <tr
      className={`hover:bg-primary/[0.025] border-b last:border-0 ${seleccionado ? "bg-primary/[0.045]" : ""}`}
    >
      <td className="px-5 py-3 text-center">
        <input
          type="checkbox"
          checked={seleccionado}
          onChange={alSeleccionar}
          aria-label={`Seleccionar ${nombre}`}
          className="accent-primary size-4"
        />
      </td>
      <td className="px-3 py-3">
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
