"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BadgePercent,
  Filter,
  Plus,
  Receipt,
  Search,
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
import type { EmpresaOpcion } from "@/modules/empleados/query";
import type {
  FilaVenta,
  ResumenVentas,
  SedeOpcion,
  VendedorOpcion,
} from "@/modules/ventas/query";
import type { SearchParamsVentas } from "./page";
import {
  CabeceraPagina,
  EstadoVacio,
  Metrica,
} from "@/components/shell/pagina-ui";

const OPCIONES_ORDEN: { value: string; label: string }[] = [
  { value: "fecha_desc", label: "Más recientes primero" },
  { value: "fecha_asc", label: "Más antiguas primero" },
  { value: "monto_desc", label: "Monto: mayor a menor" },
  { value: "monto_asc", label: "Monto: menor a mayor" },
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

function esFiltroActivo(campo: string, sp: SearchParamsVentas): boolean {
  const valor = sp[campo as keyof SearchParamsVentas];
  if (!valor) return false;
  if (campo === "estado" && valor === "TODAS") return false;
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
}: {
  pagina: Pagina<FilaVenta> & { resumen: ResumenVentas };
  sp: SearchParamsVentas;
  esAdmin: boolean;
  empresas: EmpresaOpcion[];
  vendedores: VendedorOpcion[];
  sedes: SedeOpcion[];
  puedeCrear: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [texto, setTexto] = useState(sp.q ?? "");
  const [popoverAbierto, setPopoverAbierto] = useState(false);
  const [sheetAbierto, setSheetAbierto] = useState(false);

  const direccion = sp.dir === "compradas" ? "compradas" : "vendidas";
  const orden = sp.orden ?? "fecha_desc";
  const hoy = hoyLima();
  const ayer = sumarDias(hoy, -1);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("cursor");
      if (texto) {
        params.set("q", texto);
      } else {
        params.delete("q");
      }
      const target = `${pathname}?${params.toString()}`;
      if (target !== `${pathname}?${searchParams.toString()}`) {
        router.replace(target);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const urlDe = (cambios: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cursor");
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
    router.push(urlDe(cambios));
  };

  const filtrosActivos = CAMPOS_FILTRO_CHIP.filter((campo) =>
    esFiltroActivo(campo, sp),
  );
  const conCursor = urlDe({ cursor: pagina.cursor });

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
            <Link
              key={t.id}
              href={urlDe({ dir: t.id === "vendidas" ? null : t.id })}
              className={`rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition ${
                direccion === t.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="control-bar flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="DNI o nombre del empleado"
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metrica
          etiqueta="Operaciones"
          valor={pagina.resumen.cantidad}
          detalle="Según los filtros actuales"
          icono={<Receipt className="size-4.5" />}
        />
        <Metrica
          etiqueta="Monto bruto"
          valor={
            <span className="money">
              {formatearSoles(pagina.resumen.sumaBruto)}
            </span>
          }
          detalle="Antes de descuentos"
          icono={<WalletCards className="size-4.5" />}
          tono="success"
        />
        <div className="col-span-2 lg:col-span-1">
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
            />
          </div>

          {/* Escritorio: tabla */}
          <div className="hidden lg:block">
            <TablaVentas
              items={pagina.items}
              esAdmin={esAdmin}
              direccion={direccion}
              urlDe={urlDe}
              orden={orden}
            />
          </div>

          {pagina.cursor ? (
            <Link
              href={conCursor}
              className="mx-auto rounded-full border px-4 py-2 text-sm font-medium"
            >
              Cargar más
            </Link>
          ) : null}
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
      return valor === "REGISTRADA" ? "Registradas" : "Anuladas";
    case "vendedor": {
      const v = vendedores.find((v) => v.id === valor);
      return v ? `${v.nombres} ${v.apellidos}` : "Vendedor";
    }
    case "sede":
      return sedes.find((s) => s.id === valor)?.nombre ?? "Sede";
    case "montoMin":
      return `Desde S/ ${valor}`;
    case "montoMax":
      return `Hasta S/ ${valor}`;
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
          defaultValue={sp.estado ?? "TODAS"}
          className={claseSelect}
        >
          <option value="TODAS">Todas</option>
          <option value="REGISTRADA">Registradas</option>
          <option value="ANULADA">Anuladas</option>
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
          <Label htmlFor="montoMin">Monto mínimo (S/)</Label>
          <Input
            id="montoMin"
            name="montoMin"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={sp.montoMin ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="montoMax">Monto máximo (S/)</Label>
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

function ListaMovil({
  items,
  esAdmin,
  direccion,
  orden,
  hoy,
  ayer,
}: {
  items: FilaVenta[];
  esAdmin: boolean;
  direccion: string;
  orden: string;
  hoy: string;
  ayer: string;
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
    <>
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
    </>
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
      className={`bg-card/90 ring-foreground/7 hover:bg-card flex flex-col gap-1.5 rounded-[1.2rem] p-4 shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-lg ${
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
          {venta.empleado.nombres.toUpperCase()}{" "}
          {venta.empleado.apellidos.toUpperCase()}
        </p>
        {anulada ? (
          <Badge variant="destructive" className="shrink-0">
            Anulada
          </Badge>
        ) : null}
      </div>
      <p className="text-muted-foreground text-sm">
        {venta.empleado.dni} · {contraparte.nombre}
      </p>
      <p className="text-muted-foreground text-sm">
        {formatearHoraLima(venta.createdAt)} · {venta.sede.nombre}
        {esAdmin
          ? ` · ${venta.vendedor.nombres} ${venta.vendedor.apellidos.split(" ")[0]}`
          : ""}
      </p>
      <div className="mt-2 flex items-center justify-end gap-3 border-t pt-3">
        <span
          className={`money font-bold ${anulada ? "text-muted-foreground line-through" : ""}`}
        >
          {formatearSoles(venta.montoBrutoCentimos)}
        </span>
        <span className="money text-muted-foreground text-xs">
          −{formatearSoles(venta.montoDescuentoCentimos)}
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
  orden,
}: {
  items: FilaVenta[];
  esAdmin: boolean;
  direccion: string;
  urlDe: (cambios: Record<string, string | null>) => string;
  orden: string;
}) {
  const router = useRouter();
  return (
    <div className="surface-panel">
      <Table>
        <TableHeader className="bg-muted/45">
          <TableRow>
            <TableHead>
              <EncabezadoOrdenable
                label="Fecha"
                campoAsc="fecha_asc"
                campoDesc="fecha_desc"
                orden={orden}
                urlDe={urlDe}
              />
            </TableHead>
            <TableHead>Empleado</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Sede</TableHead>
            {esAdmin ? <TableHead>Vendedor</TableHead> : null}
            <TableHead className="text-right">
              <EncabezadoOrdenable
                label="Monto"
                campoAsc="monto_asc"
                campoDesc="monto_desc"
                orden={orden}
                urlDe={urlDe}
                alinearDerecha
              />
            </TableHead>
            <TableHead className="text-right">Descuento</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((v) => {
            const anulada = v.estado === "ANULADA";
            const contraparte = empresaContraparte(v, direccion);
            return (
              <TableRow
                key={v.id}
                className={`cursor-pointer ${v.requiereRevision && !anulada ? "bg-warning/5" : ""}`}
                onClick={() => router.push(`/ventas/${v.id}`)}
              >
                <TableCell>
                  <div>{formatearFechaUI(v.fechaVenta)}</div>
                  <div className="text-muted-foreground text-xs">
                    {formatearHoraLima(v.createdAt)}
                  </div>
                </TableCell>
                <TableCell
                  className={
                    anulada ? "text-muted-foreground line-through" : ""
                  }
                >
                  <div>
                    {v.empleado.nombres.toUpperCase()}{" "}
                    {v.empleado.apellidos.toUpperCase()}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {v.empleado.dni}
                  </div>
                </TableCell>
                <TableCell>{contraparte.nombre}</TableCell>
                <TableCell>{v.sede.nombre}</TableCell>
                {esAdmin ? (
                  <TableCell>
                    {v.vendedor.nombres} {v.vendedor.apellidos}
                  </TableCell>
                ) : null}
                <TableCell
                  className={`text-right ${anulada ? "text-muted-foreground line-through" : ""}`}
                >
                  {formatearSoles(v.montoBrutoCentimos)}
                </TableCell>
                <TableCell className="text-muted-foreground text-right">
                  −{formatearSoles(v.montoDescuentoCentimos)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatearSoles(v.montoFinalCentimos)}
                </TableCell>
                <TableCell>
                  {anulada ? (
                    <Badge variant="destructive">Anulada</Badge>
                  ) : v.requiereRevision ? (
                    <Badge className="bg-warning/10 text-warning border-warning/20 border">
                      Revisión
                    </Badge>
                  ) : (
                    <Badge variant="outline">Registrada</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function EncabezadoOrdenable({
  label,
  campoAsc,
  campoDesc,
  orden,
  urlDe,
  alinearDerecha,
}: {
  label: string;
  campoAsc: string;
  campoDesc: string;
  orden: string;
  urlDe: (cambios: Record<string, string | null>) => string;
  alinearDerecha?: boolean;
}) {
  const activo = orden === campoAsc || orden === campoDesc;
  const siguiente = orden === campoDesc ? campoAsc : campoDesc;
  return (
    <Link
      href={urlDe({ orden: siguiente })}
      className={`inline-flex items-center gap-1 hover:underline ${alinearDerecha ? "flex-row-reverse" : ""} ${activo ? "text-foreground" : ""}`}
    >
      {label}
      {activo ? (orden === campoDesc ? "↓" : "↑") : null}
    </Link>
  );
}
