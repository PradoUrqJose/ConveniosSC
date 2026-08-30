"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Paperclip,
  Plus,
  Receipt,
  Search,
  Wallet,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatearSoles } from "@/lib/dinero";
import {
  formatearFechaUI,
  formatearHoraLima,
  hoyLima,
  sumarDias,
} from "@/lib/fechas";
import type { Pagina } from "@/lib/tipos";
import { capitalizarNombre } from "@/lib/utils";
import type { EmpresaOpcion } from "@/modules/empleados/query";
import type {
  FilaVenta,
  ResumenVentas,
  SedeOpcion,
  VendedorOpcion,
} from "@/modules/ventas/query";
import type { SearchParamsVentas } from "./page";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ariaSortDe,
  CabeceraPagina,
  EncabezadoOrdenable,
  EstadoBadge,
  EstadoVacio,
  IndicadorPendienteSuperficie,
  Metrica,
  PanelSuperficie,
} from "@/components/shell/pagina-ui";

const OPCIONES_ORDEN: { value: string; label: string }[] = [
  { value: "fecha_desc", label: "Más recientes primero" },
  { value: "fecha_asc", label: "Más antiguas primero" },
  { value: "monto_desc", label: "Total pagado: mayor a menor" },
  { value: "monto_asc", label: "Total pagado: menor a mayor" },
];

const CAMPOS_FILTRO_CHIP = [
  "desde",
  "hasta",
  "empresa",
  "estado",
  "vendedor",
  "sede",
  "montoMin",
  "montoMax",
  "revision",
] as const;

// Marca, dentro de `antes`, la posición de la primera página (que no tiene
// cursor propio). No puede ser "" porque `urlDe` trata los valores vacíos
// como "eliminar este parámetro" y `antes` perdería esa entrada.
const CENTINELA_PRIMERA_PAGINA = "-";

function esFiltroActivo(campo: string, sp: SearchParamsVentas): boolean {
  const valor = sp[campo as keyof SearchParamsVentas];
  if (!valor) return false;
  // "Registradas" es el estado por defecto de la página (page.tsx): no cuenta
  // como filtro activo. Solo "Anuladas" o "Todas" (elegido a propósito) lo son.
  if (campo === "estado" && valor === "REGISTRADA") return false;
  return true;
}

export function VentasClient({
  pagina,
  sp,
  esAdmin,
  empresas,
  vendedores,
  sedes,
  puedeCrear,
  porPagina,
}: {
  pagina: Pagina<FilaVenta> & { resumen: ResumenVentas };
  sp: SearchParamsVentas;
  esAdmin: boolean;
  empresas: EmpresaOpcion[];
  vendedores: VendedorOpcion[];
  sedes: SedeOpcion[];
  puedeCrear: boolean;
  porPagina: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [texto, setTexto] = useState(sp.q ?? "");
  const [popoverAbierto, setPopoverAbierto] = useState(false);
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const direccion = sp.dir === "compradas" ? "compradas" : "vendidas";
  const orden = sp.orden ?? "fecha_desc";
  const hoy = hoyLima();
  const ayer = sumarDias(hoy, -1);

  // Navega dentro de una transición para no descartar la tabla actual: React
  // mantiene el contenido visible (isPending=true) en vez de mostrar el
  // fallback de loading.tsx, y nosotros dibujamos nuestro propio skeleton.
  const irA = (url: string) => {
    startTransition(() => {
      router.push(url);
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("cursor");
      params.delete("antes");
      if (texto) {
        params.set("q", texto);
      } else {
        params.delete("q");
      }
      const target = `${pathname}?${params.toString()}`;
      if (target !== `${pathname}?${searchParams.toString()}`) {
        startTransition(() => router.replace(target));
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const urlDe = (cambios: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    // Cualquier cambio ajeno a la paginación reinicia la página: descarta el
    // cursor actual y la pila de páginas visitadas (ver `antes` más abajo).
    params.delete("cursor");
    params.delete("antes");
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "") {
        params.delete(clave);
      } else {
        params.set(clave, valor);
      }
    }
    return `${pathname}?${params.toString()}`;
  };

  const aplicarFiltros = (cambios: Record<string, string>) => {
    irA(urlDe(cambios));
  };

  const filtrosActivos = CAMPOS_FILTRO_CHIP.filter((campo) =>
    esFiltroActivo(campo, sp),
  );

  // --- Paginación por cursor con historial ------------------------------
  // `listarVentas` usa keyset pagination (WHERE (fecha, id) > cursor): es
  // eficiente y estable ante inserciones, pero solo sabe avanzar. Para
  // permitir "anterior" guardamos en la URL (`antes`) la pila de cursores
  // usados para llegar a cada página anterior; "primera página" se
  // representa como cadena vacía. Ir atrás = desapilar y reusar ese cursor.
  const historial = sp.antes ? sp.antes.split(",") : [];
  const paginaActual = historial.length + 1;
  const totalPaginas = Math.max(
    1,
    Math.ceil(pagina.resumen.cantidad / porPagina),
  );

  const urlSiguiente = pagina.cursor
    ? urlDe({
        cursor: pagina.cursor,
        antes: [...historial, sp.cursor ?? CENTINELA_PRIMERA_PAGINA].join(","),
      })
    : null;

  const urlAnterior =
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

  return (
    <section className="page-shell">
      <CabeceraPagina
        kicker="Operaciones"
        titulo={esAdmin ? "Ventas" : "Mis ventas"}
        descripcion={
          esAdmin
            ? "Consulta y controla las operaciones realizadas por tu equipo."
            : "Consulta tus operaciones, montos y descuentos entregados."
        }
        icono={<Receipt className="size-5" />}
        acciones={
          puedeCrear ? (
            <Link
              href="/ventas/nueva"
              // En móvil el botón central de la barra inferior ya cubre esta acción.
              className="bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 hidden h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold shadow-lg transition hover:-translate-y-0.5 lg:inline-flex"
            >
              <Plus className="size-4" /> Nueva venta
            </Link>
          ) : null
        }
      />

      {esAdmin ? (
        <div className="bg-muted/80 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl p-1.5">
          {(
            [
              { id: "vendidas", label: "Vendidas" },
              { id: "compradas", label: "Compraron mis empleados" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() =>
                irA(urlDe({ dir: t.id === "vendidas" ? null : t.id }))
              }
              className={`rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition ${
                direccion === t.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="control-bar flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Documento o nombre del empleado"
            className="bg-muted/70 focus-visible:bg-background h-11 rounded-xl border-0 pl-10 shadow-none"
          />
        </div>

        <div className="hidden lg:block">
          <Popover open={popoverAbierto} onOpenChange={setPopoverAbierto}>
            <PopoverTrigger render={<Button variant="outline" size="sm" />}>
              <Filter className="size-4" />
              Filtros
              {filtrosActivos.length > 0 ? ` (${filtrosActivos.length})` : ""}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 max-w-[95vw]">
              <FiltrosVenta
                sp={sp}
                esAdmin={esAdmin}
                empresas={empresas}
                vendedores={vendedores}
                sedes={sedes}
                onAplicar={(c) => {
                  aplicarFiltros(c);
                  setPopoverAbierto(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="lg:hidden">
          <Sheet open={sheetAbierto} onOpenChange={setSheetAbierto}>
            <SheetTrigger render={<Button variant="outline" size="sm" />}>
              <Filter className="size-4" />
              Filtros
              {filtrosActivos.length > 0 ? ` (${filtrosActivos.length})` : ""}
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[85vh] overflow-y-auto"
            >
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-6">
                <FiltrosVenta
                  sp={sp}
                  esAdmin={esAdmin}
                  empresas={empresas}
                  vendedores={vendedores}
                  sedes={sedes}
                  onAplicar={(c) => {
                    aplicarFiltros(c);
                    setSheetAbierto(false);
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {filtrosActivos.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {filtrosActivos.map((campo) => (
            <Badge key={campo} variant="outline" className="gap-1">
              {etiquetaFiltro(campo, sp, empresas, vendedores, sedes)}
              <Link
                href={urlDe({ [campo]: null })}
                aria-label="Quitar filtro"
                className="ml-1"
              >
                ✕
              </Link>
            </Badge>
          ))}
          <Link
            href={urlDe(
              Object.fromEntries(CAMPOS_FILTRO_CHIP.map((c) => [c, null])),
            )}
            className="text-muted-foreground text-xs underline underline-offset-2"
          >
            Limpiar filtros
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica
          etiqueta="Operaciones"
          valor={pagina.resumen.cantidad}
          detalle={
            sp.estado === "ANULADA"
              ? "Anuladas, según los filtros actuales"
              : sp.estado === "TODAS"
                ? "Incluye anuladas"
                : "Registradas, según los filtros actuales"
          }
          icono={<Receipt className="size-4.5" />}
        />
        <Metrica
          etiqueta="Total pagado"
          valor={
            <span className="money">
              {formatearSoles(pagina.resumen.sumaFinal)}
            </span>
          }
          detalle="Bruto menos descuentos"
          icono={<WalletCards className="size-4.5" />}
          tono="success"
        />
        <Metrica
          etiqueta="Monto bruto"
          valor={
            <span className="money">
              {formatearSoles(pagina.resumen.sumaBruto)}
            </span>
          }
          detalle="Antes de descuentos"
          icono={<Wallet className="size-4.5" />}
        />
        <Metrica
          etiqueta="Descuentos"
          valor={
            <span className="money">
              {formatearSoles(pagina.resumen.sumaDescuento)}
            </span>
          }
          detalle="Beneficios aplicados"
          icono={<BadgePercent className="size-4.5" />}
          tono="warning"
        />
      </div>

      {pagina.items.length === 0 ? (
        <EstadoVacio
          icono={<Receipt className="size-6" />}
          titulo={
            filtrosActivos.length > 0 || sp.q
              ? "No encontramos coincidencias"
              : "Aún no hay ventas registradas"
          }
          descripcion={
            filtrosActivos.length > 0 || sp.q
              ? "Prueba con otros términos o limpia los filtros para ver más resultados."
              : "Cuando registres una operación, aparecerá aquí con su monto y estado."
          }
          accion={
            filtrosActivos.length > 0 || sp.q ? (
              <Link
                href={urlDe({
                  ...Object.fromEntries(
                    CAMPOS_FILTRO_CHIP.map((c) => [c, null]),
                  ),
                  q: null,
                })}
                className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-bold"
              >
                Limpiar filtros
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          {/* Móvil: tarjetas agrupadas por día */}
          <div className="flex flex-col gap-3 lg:hidden">
            <ListaMovil
              items={pagina.items}
              esAdmin={esAdmin}
              direccion={direccion}
              orden={orden}
              hoy={hoy}
              ayer={ayer}
              pendiente={pendiente}
            />
            <Paginador
              paginaActual={paginaActual}
              totalPaginas={totalPaginas}
              porPagina={porPagina}
              cantidad={pagina.items.length}
              total={pagina.resumen.cantidad}
              urlAnterior={urlAnterior}
              urlSiguiente={urlSiguiente}
              pendiente={pendiente}
              onNavegar={irA}
              className="surface-panel px-2"
            />
          </div>

          {/* Escritorio: tabla */}
          <div className="hidden lg:block">
            <TablaVentas
              items={pagina.items}
              esAdmin={esAdmin}
              direccion={direccion}
              urlDe={urlDe}
              onNavegar={irA}
              orden={orden}
              pendiente={pendiente}
              paginador={
                <Paginador
                  paginaActual={paginaActual}
                  totalPaginas={totalPaginas}
                  porPagina={porPagina}
                  cantidad={pagina.items.length}
                  total={pagina.resumen.cantidad}
                  urlAnterior={urlAnterior}
                  urlSiguiente={urlSiguiente}
                  pendiente={pendiente}
                  onNavegar={irA}
                />
              }
            />
          </div>
        </>
      )}
    </section>
  );
}

function etiquetaFiltro(
  campo: string,
  sp: SearchParamsVentas,
  empresas: EmpresaOpcion[],
  vendedores: VendedorOpcion[],
  sedes: SedeOpcion[],
): string {
  const valor = sp[campo as keyof SearchParamsVentas] ?? "";
  switch (campo) {
    case "desde":
      return `Desde ${formatearFechaUI(valor)}`;
    case "hasta":
      return `Hasta ${formatearFechaUI(valor)}`;
    case "empresa":
      return empresas.find((e) => e.id === valor)?.nombreComercial ?? "Empresa";
    case "estado":
      return valor === "ANULADA" ? "Anuladas" : "Todos los estados";
    case "vendedor": {
      const v = vendedores.find((v) => v.id === valor);
      return v ? `${v.nombres} ${v.apellidos}` : "Vendedor";
    }
    case "sede":
      return sedes.find((s) => s.id === valor)?.nombre ?? "Sede";
    case "montoMin":
      return `Bruto desde S/ ${valor}`;
    case "montoMax":
      return `Bruto hasta S/ ${valor}`;
    case "revision":
      return "Requiere revisión";
    case "orden":
      return OPCIONES_ORDEN.find((o) => o.value === valor)?.label ?? "Orden";
    default:
      return campo;
  }
}

function FiltrosVenta({
  sp,
  esAdmin,
  empresas,
  vendedores,
  sedes,
  onAplicar,
}: {
  sp: SearchParamsVentas;
  esAdmin: boolean;
  empresas: EmpresaOpcion[];
  vendedores: VendedorOpcion[];
  sedes: SedeOpcion[];
  onAplicar: (cambios: Record<string, string>) => void;
}) {
  const claseSelect =
    "border-input bg-background text-foreground h-9 w-full rounded-md border px-2 text-sm";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onAplicar({
          desde: String(fd.get("desde") ?? ""),
          hasta: String(fd.get("hasta") ?? ""),
          empresa: String(fd.get("empresa") ?? ""),
          estado: String(fd.get("estado") ?? ""),
          vendedor: String(fd.get("vendedor") ?? ""),
          sede: String(fd.get("sede") ?? ""),
          montoMin: String(fd.get("montoMin") ?? ""),
          montoMax: String(fd.get("montoMax") ?? ""),
          revision: fd.get("revision") ? "1" : "",
          orden: String(fd.get("orden") ?? ""),
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desde">Desde</Label>
          <Input
            id="desde"
            name="desde"
            type="date"
            defaultValue={sp.desde ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hasta">Hasta</Label>
          <Input
            id="hasta"
            name="hasta"
            type="date"
            defaultValue={sp.hasta ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="empresa">Empresa convenio</Label>
        <select
          id="empresa"
          name="empresa"
          defaultValue={sp.empresa ?? ""}
          className={claseSelect}
        >
          <option value="">Todas</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombreComercial}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="estado">Estado</Label>
        <select
          id="estado"
          name="estado"
          defaultValue={sp.estado ?? "REGISTRADA"}
          className={claseSelect}
        >
          <option value="REGISTRADA">Registradas</option>
          <option value="ANULADA">Anuladas</option>
          <option value="TODAS">Todas (incluye anuladas)</option>
        </select>
      </div>

      {esAdmin ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vendedor">Vendedor</Label>
          <select
            id="vendedor"
            name="vendedor"
            defaultValue={sp.vendedor ?? ""}
            className={claseSelect}
          >
            <option value="">Todos</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombres} {v.apellidos}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {esAdmin ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sede">Sede</Label>
          <select
            id="sede"
            name="sede"
            defaultValue={sp.sede ?? ""}
            className={claseSelect}
          >
            <option value="">Todas</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="montoMin">Monto bruto mínimo (S/)</Label>
          <Input
            id="montoMin"
            name="montoMin"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={sp.montoMin ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="montoMax">Monto bruto máximo (S/)</Label>
          <Input
            id="montoMax"
            name="montoMax"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={sp.montoMax ?? ""}
          />
        </div>
      </div>

      {esAdmin ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="revision" defaultChecked={sp.revision === "1"} />
          Solo con revisión pendiente
        </label>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="orden">Ordenar por</Label>
        <select
          id="orden"
          name="orden"
          defaultValue={sp.orden ?? "fecha_desc"}
          className={claseSelect}
        >
          {OPCIONES_ORDEN.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" className="mt-1">
        Aplicar filtros
      </Button>
    </form>
  );
}

function empresaContraparte(venta: FilaVenta, direccion: string) {
  return direccion === "compradas"
    ? venta.empresaVendedora
    : venta.empresaCompradora;
}

function inicialesDe(nombres: string, apellidos: string): string {
  return `${nombres[0] ?? ""}${apellidos[0] ?? ""}`.toUpperCase();
}

function ListaMovil({
  items,
  esAdmin,
  direccion,
  orden,
  hoy,
  ayer,
  pendiente,
}: {
  items: FilaVenta[];
  esAdmin: boolean;
  direccion: string;
  orden: string;
  hoy: string;
  ayer: string;
  pendiente: boolean;
}) {
  const agrupaPorDia = orden.startsWith("fecha");

  const grupos = useMemo(() => {
    if (!agrupaPorDia) {
      return [{ etiqueta: null as string | null, items }];
    }
    const mapa = new Map<string, FilaVenta[]>();
    for (const v of items) {
      const lista = mapa.get(v.fechaVenta) ?? [];
      lista.push(v);
      mapa.set(v.fechaVenta, lista);
    }
    return [...mapa.entries()].map(([fecha, items]) => ({
      etiqueta:
        fecha === hoy
          ? "Hoy"
          : fecha === ayer
            ? "Ayer"
            : formatearFechaUI(fecha),
      items,
    }));
  }, [items, agrupaPorDia, hoy, ayer]);

  return (
    <div className="relative">
      <div
        className={`flex flex-col gap-3 transition-opacity duration-200 ${pendiente ? "pointer-events-none opacity-40" : ""}`}
      >
        {grupos.map((grupo, i) => (
          <div key={grupo.etiqueta ?? i} className="flex flex-col gap-3">
            {grupo.etiqueta ? (
              <h2 className="text-muted-foreground pt-1 text-xs font-semibold tracking-wide uppercase">
                {grupo.etiqueta}
              </h2>
            ) : null}
            {grupo.items.map((v) => (
              <TarjetaVenta
                key={v.id}
                venta={v}
                esAdmin={esAdmin}
                direccion={direccion}
              />
            ))}
          </div>
        ))}
      </div>
      {pendiente ? (
        <IndicadorPendienteSuperficie>
          <EsqueletoTarjetas cantidad={items.length || 4} />
        </IndicadorPendienteSuperficie>
      ) : null}
    </div>
  );
}

function TarjetaVenta({
  venta,
  esAdmin,
  direccion,
}: {
  venta: FilaVenta;
  esAdmin: boolean;
  direccion: string;
}) {
  const anulada = venta.estado === "ANULADA";
  const contraparte = empresaContraparte(venta, direccion);
  return (
    <Link
      href={`/ventas/${venta.id}`}
      className={`bg-card/90 ring-foreground/7 hover:bg-card animate-in fade-in-0 flex flex-col gap-1.5 rounded-[1.2rem] p-4 shadow-sm ring-1 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
        venta.requiereRevision && !anulada ? "ring-warning/35 bg-warning/5" : ""
      }`}
    >
      {venta.requiereRevision && !anulada ? (
        <p className="text-warning text-xs font-medium">⚠ Requiere revisión</p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <p
          className={`font-semibold ${anulada ? "text-muted-foreground line-through" : ""}`}
        >
          {capitalizarNombre(
            `${venta.empleado.nombres} ${venta.empleado.apellidos}`,
          )}
        </p>
        {anulada ? (
          <EstadoBadge tono="destructive" className="shrink-0">
            Anulada
          </EstadoBadge>
        ) : null}
      </div>
      <p className="text-muted-foreground text-sm">
        {venta.empleado.tipoDocumento === "DNI" ? "DNI" : "CE"}{" "}
        {venta.empleado.numeroDocumento} · {contraparte.nombre}
      </p>
      <p className="text-muted-foreground text-sm">
        {formatearHoraLima(venta.createdAt)} · {venta.sede.nombre}
        {esAdmin
          ? ` · ${venta.vendedor.nombres} ${venta.vendedor.apellidos.split(" ")[0]}`
          : ""}
      </p>
      <div className="mt-2 flex items-center justify-end gap-3 border-t pt-3">
        <span className="text-muted-foreground text-xs">
          Bruto{" "}
          <span className="money">
            {formatearSoles(venta.montoBrutoCentimos)}
          </span>{" "}
          −{" "}
          <span className="money">
            {formatearSoles(venta.montoDescuentoCentimos)}
          </span>
        </span>
        <span
          className={`money font-bold ${anulada ? "text-muted-foreground line-through" : ""}`}
        >
          {formatearSoles(venta.montoFinalCentimos)}
        </span>
      </div>
    </Link>
  );
}

function TablaVentas({
  items,
  esAdmin,
  direccion,
  urlDe,
  onNavegar,
  orden,
  pendiente,
  paginador,
}: {
  items: FilaVenta[];
  esAdmin: boolean;
  direccion: string;
  urlDe: (cambios: Record<string, string | null>) => string;
  onNavegar: (url: string) => void;
  orden: string;
  pendiente: boolean;
  paginador: ReactNode;
}) {
  const router = useRouter();
  return (
    <PanelSuperficie pie={paginador}>
      <div className="relative">
        <Table>
          <TableHeader className="bg-muted/45">
            <TableRow>
              <TableHead
                aria-sort={ariaSortDe(orden, "fecha_asc", "fecha_desc")}
              >
                <EncabezadoOrdenable
                  label="Fecha"
                  campoAsc="fecha_asc"
                  campoDesc="fecha_desc"
                  orden={orden}
                  urlDe={urlDe}
                  onNavegar={onNavegar}
                />
              </TableHead>
              <TableHead>Empleado</TableHead>
              <TableHead>Contraparte</TableHead>
              <TableHead
                className="text-right"
                aria-sort={ariaSortDe(orden, "monto_asc", "monto_desc")}
              >
                <EncabezadoOrdenable
                  label="Total pagado"
                  campoAsc="monto_asc"
                  campoDesc="monto_desc"
                  orden={orden}
                  urlDe={urlDe}
                  onNavegar={onNavegar}
                  alinearDerecha
                />
              </TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Adjuntos</TableHead>
              <TableHead>
                <span className="sr-only">Detalle</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody
            className={`transition-opacity duration-200 ${pendiente ? "pointer-events-none opacity-40" : ""}`}
          >
            {items.map((v) => {
              const anulada = v.estado === "ANULADA";
              const contraparte = empresaContraparte(v, direccion);
              const nombreCompleto = capitalizarNombre(
                `${v.empleado.nombres} ${v.empleado.apellidos}`,
              );
              return (
                <TableRow
                  key={v.id}
                  className={`animate-in fade-in-0 h-[72px] cursor-pointer duration-300 ${v.requiereRevision && !anulada ? "bg-warning/5" : ""}`}
                  onClick={() => router.push(`/ventas/${v.id}`)}
                >
                  <TableCell>
                    <div>{formatearFechaUI(v.fechaVenta)}</div>
                    <div className="text-muted-foreground text-xs">
                      {formatearHoraLima(v.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold ${
                          anulada
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary"
                        }`}
                        aria-hidden="true"
                      >
                        {inicialesDe(v.empleado.nombres, v.empleado.apellidos)}
                      </span>
                      <div className="min-w-0">
                        <div
                          className={`truncate font-semibold ${anulada ? "text-muted-foreground line-through" : ""}`}
                        >
                          {nombreCompleto}
                        </div>
                        <div className="text-muted-foreground font-mono text-xs">
                          {v.empleado.tipoDocumento === "DNI" ? "DNI" : "CE"}{" "}
                          {v.empleado.numeroDocumento}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="truncate">{contraparte.nombre}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {v.sede.nombre}
                      {esAdmin
                        ? ` · ${v.vendedor.nombres} ${v.vendedor.apellidos.split(" ")[0]}`
                        : ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className={`money font-bold ${anulada ? "text-muted-foreground line-through" : ""}`}
                    >
                      {formatearSoles(v.montoFinalCentimos)}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      <span className="money">
                        {formatearSoles(v.montoBrutoCentimos)}
                      </span>{" "}
                      <span className="money">
                        −{formatearSoles(v.montoDescuentoCentimos)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {anulada ? (
                      <EstadoBadge tono="destructive">
                        <span className="size-1.5 rounded-full bg-current" />
                        Anulada
                      </EstadoBadge>
                    ) : v.requiereRevision ? (
                      <EstadoBadge tono="warning">
                        <span className="size-1.5 rounded-full bg-current" />
                        Revisión
                      </EstadoBadge>
                    ) : (
                      <EstadoBadge tono="success">
                        <span className="size-1.5 rounded-full bg-current" />
                        Registrada
                      </EstadoBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {v.totalAdjuntos > 0 ? (
                      <span
                        className="text-muted-foreground inline-flex items-center gap-1 text-xs"
                        title={`${v.totalAdjuntos} adjunto${v.totalAdjuntos === 1 ? "" : "s"}`}
                      >
                        <Paperclip className="size-3.5" aria-hidden="true" />
                        {v.totalAdjuntos}
                      </span>
                    ) : (
                      <span
                        className="text-muted-foreground/40 text-xs"
                        aria-hidden="true"
                      >
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Enlace real: la fila también navega por onClick (mouse),
                        pero abrir el detalle no depende exclusivamente de él —
                        este link es alcanzable y operable por teclado. */}
                    <Link
                      href={`/ventas/${v.id}`}
                      aria-label={`Ver detalle de la venta de ${nombreCompleto}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 inline-flex size-8 items-center justify-center rounded-lg outline-none focus-visible:ring-2"
                    >
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {pendiente ? (
          <IndicadorPendienteSuperficie top="top-11">
            <FilasEsqueleto filas={items.length || 6} />
          </IndicadorPendienteSuperficie>
        ) : null}
      </div>
    </PanelSuperficie>
  );
}

/**
 * Mismas columnas y misma altura de fila (~72px) que `TablaVentas`: el
 * criterio de aceptación exige que el skeleton no "salte" al llegar los
 * datos reales.
 */
function FilasEsqueleto({ filas }: { filas: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: filas }, (_, fila) => (
        <div key={fila} className="flex h-[72px] items-center gap-6 px-4">
          <div className="flex w-20 shrink-0 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3 w-10" />
          </div>
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex w-28 shrink-0 flex-col items-end gap-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
          <Skeleton className="h-3.5 w-6 shrink-0" />
          <Skeleton className="size-8 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function EsqueletoTarjetas({ cantidad }: { cantidad: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: cantidad }, (_, i) => (
        <div
          key={i}
          className="bg-card/90 ring-foreground/7 flex flex-col gap-2.5 rounded-[1.2rem] p-4 ring-1"
        >
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-44" />
          <div className="mt-1.5 flex justify-end gap-3 border-t pt-3">
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Paginador({
  paginaActual,
  totalPaginas,
  porPagina,
  cantidad,
  total,
  urlAnterior,
  urlSiguiente,
  pendiente,
  onNavegar,
  className,
}: {
  paginaActual: number;
  totalPaginas: number;
  porPagina: number;
  cantidad: number;
  total: number;
  urlAnterior: string | null;
  urlSiguiente: string | null;
  pendiente: boolean;
  onNavegar: (url: string) => void;
  className?: string;
}) {
  const desde = cantidad ? (paginaActual - 1) * porPagina + 1 : 0;
  const hasta = desde ? desde + cantidad - 1 : 0;
  return (
    <footer
      className={`flex min-h-16 flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-xs ${className ?? ""}`}
    >
      <span className="text-muted-foreground">
        Mostrando <strong className="text-foreground">{desde}</strong> a{" "}
        <strong className="text-foreground">{hasta}</strong> de{" "}
        <strong className="text-foreground">{total}</strong> ventas
      </span>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground hidden items-center gap-1.5 sm:flex">
          {pendiente ? (
            <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
          ) : null}
          Página <strong className="text-foreground">{paginaActual}</strong> de{" "}
          <strong className="text-foreground">{totalPaginas}</strong>
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!urlAnterior || pendiente}
            aria-label="Página anterior"
            onClick={() => urlAnterior && onNavegar(urlAnterior)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!urlSiguiente || pendiente}
            aria-label="Página siguiente"
            onClick={() => urlSiguiente && onNavegar(urlSiguiente)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </footer>
  );
}
