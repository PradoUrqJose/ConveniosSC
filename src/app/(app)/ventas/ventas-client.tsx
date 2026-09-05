"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { iniciarTransicionMovil } from "@/lib/transicion-movil";
import {
  formatearFechaUI,
  formatearHoraLima,
  hoyLima,
  sumarDias,
} from "@/lib/fechas";
import type { Pagina } from "@/lib/tipos";
import { capitalizarNombre } from "@/lib/utils";
import type {
  ContraparteOpcion,
  FilaVenta,
  ResumenVentas,
  SedeOpcion,
  VendedorOpcion,
} from "@/modules/ventas/query";
import {
  cargarCatalogosVentas,
  cargarPaginaVentas,
  type CatalogosVentas,
} from "@/modules/ventas/actions";
import {
  mismoConjuntoVentas,
  normalizarParametrosVentas,
  parametrosDesdeUrl,
  serializarParametrosVentas,
  type SearchParamsVentas,
} from "@/modules/ventas/filtros";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorParcial } from "@/components/estados";
import { clasificarFallo, type ClaseFallo } from "@/lib/estados-red";
import {
  ariaSortDe,
  CabeceraPagina,
  EncabezadoOrdenable,
  EstadoBadge,
  EstadoSinResultados,
  IndicadorPendienteSuperficie,
  Metrica,
  PanelSuperficie,
} from "@/components/shell/pagina-ui";
import { SalesDirectionTabs } from "@/components/shell/sales-direction-tabs";

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

function esFiltroActivo(
  campo: string,
  sp: SearchParamsVentas,
  direccion: string,
): boolean {
  const valor = sp[campo as keyof SearchParamsVentas];
  if (!valor) return false;
  // "Registradas" es el estado por defecto de la página (page.tsx): no cuenta
  // como filtro activo. Solo "Anuladas" o "Todas" (elegido a propósito) lo son.
  if (campo === "estado" && valor === "REGISTRADA") return false;
  // Vendedor y sede propios no aplican en "compradas" (issue #28): el
  // servidor los ignora, así que tampoco deben mostrarse como chip fantasma
  // si quedaron en la URL (p.ej. al editarla a mano).
  if ((campo === "vendedor" || campo === "sede") && direccion === "compradas") {
    return false;
  }
  return true;
}

export function VentasClient({
  pagina,
  sp,
  esAdmin,
  puedeCrear,
  porPagina,
}: {
  pagina: Pagina<FilaVenta> & { resumen: ResumenVentas };
  sp: SearchParamsVentas;
  esAdmin: boolean;
  puedeCrear: boolean;
  porPagina: number;
}) {
  const pathname = usePathname();
  const [vista, setVista] = useState({ pagina, sp });
  const vistaRef = useRef(vista);
  const [texto, setTexto] = useState(sp.q ?? "");
  const [popoverAbierto, setPopoverAbierto] = useState(false);
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  // Clase del fallo, no un texto suelto: así el aviso distingue "sin red"
  // de "el servidor no responde" y se puede reintentar solo al reconectar
  // (issue #56). La URL que falló se guarda para poder repetir exactamente
  // esa consulta sin perder filtros ni página.
  const [errorCarga, setErrorCarga] = useState<ClaseFallo | null>(null);
  const urlFallida = useRef<string | null>(null);
  const [catalogosPorDireccion, setCatalogosPorDireccion] = useState<
    Partial<Record<"vendidas" | "compradas", CatalogosVentas>>
  >({});
  const [direccionCatalogoCargando, setDireccionCatalogoCargando] = useState<
    string | null
  >(null);
  const [pendienteTransicion, startTransition] = useTransition();
  const solicitud = useRef(0);
  const busquedaRestaurada = useRef<string | null>(null);
  const scrollRestaurado = useRef(false);

  useEffect(() => {
    vistaRef.current = vista;
  }, [vista]);

  useEffect(() => {
    if (scrollRestaurado.current) return;
    scrollRestaurado.current = true;
    const clave = `ventas:scroll:${pathname}${window.location.search}`;
    const y = Number(window.sessionStorage.getItem(clave));
    if (!Number.isFinite(y) || y < 0) return;
    window.sessionStorage.removeItem(clave);
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "auto" }));
  }, [pathname]);

  const paginaVisible = vista.pagina;
  const spVisible = vista.sp;

  const direccion =
    spVisible.dir === "compradas" ? "compradas" : ("vendidas" as const);
  const orden = spVisible.orden ?? "fecha_desc";
  const hoy = hoyLima();
  const ayer = sumarDias(hoy, -1);
  const catalogos = catalogosPorDireccion[direccion];
  const pendiente = cargando || pendienteTransicion;
  const urlRetorno = `${pathname}${typeof window === "undefined" ? "" : window.location.search}`;
  const recordarPosicion = () =>
    window.sessionStorage.setItem(
      `ventas:scroll:${urlRetorno}`,
      String(window.scrollY),
    );

  /**
   * Cambia la URL sólo cuando el resultado está listo. Mientras tanto se
   * conserva la vista anterior y el overlay de pendiente evita un salto a un
   * skeleton de ruta o una tabla vacía.
   */
  const irA = (url: string, reemplazar = false) => {
    const parametros = parametrosDesdeUrl(
      new URL(url, window.location.origin).searchParams,
    );
    const query = serializarParametrosVentas(parametros);
    const urlCanonica = query.size ? `${pathname}?${query}` : pathname;
    const anterior = vistaRef.current;
    const mismoConjunto = mismoConjuntoVentas(parametros, anterior.sp);
    const resumenAnterior =
      parametros.cursor && mismoConjunto ? anterior.pagina.resumen : undefined;
    const idSolicitud = ++solicitud.current;
    setErrorCarga(null);
    setCargando(true);
    startTransition(() => {
      void cargarPaginaVentas(parametros, resumenAnterior, anterior.sp)
        .then((resultado) => {
          if (idSolicitud !== solicitud.current) return;
          if (!resultado.ok) {
            urlFallida.current = url;
            setErrorCarga(clasificarFallo({ codigo: resultado.codigo }));
            setCargando(false);
            return;
          }
          window.history[reemplazar ? "replaceState" : "pushState"](
            null,
            "",
            urlCanonica,
          );
          setVista({
            pagina: resultado.data,
            sp: normalizarParametrosVentas(parametros),
          });
          setCargando(false);
        })
        .catch((error: unknown) => {
          if (idSolicitud !== solicitud.current) return;
          urlFallida.current = url;
          setErrorCarga(
            clasificarFallo({
              error,
              enLinea:
                typeof navigator === "undefined" ? undefined : navigator.onLine,
            }),
          );
          setCargando(false);
        });
    });
  };

  useEffect(() => {
    if (busquedaRestaurada.current !== null) {
      const restaurada = busquedaRestaurada.current;
      busquedaRestaurada.current = null;
      if (restaurada === texto) return;
    }
    const timer = setTimeout(() => {
      const entrada = Object.fromEntries(
        new URLSearchParams(window.location.search),
      );
      delete entrada.cursor;
      delete entrada.antes;
      if (texto) entrada.q = texto;
      else delete entrada.q;
      const query = serializarParametrosVentas(entrada);
      const target = query.size ? `${pathname}?${query}` : pathname;
      if (target !== `${pathname}${window.location.search}`) {
        irA(target, true);
      }
    }, 300);
    return () => clearTimeout(timer);
    // `irA` se recrea al renderizar; el efecto debe depender sólo del texto y ruta actuales.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, pathname]);

  useEffect(() => {
    const alVolver = () => {
      const url = `${pathname}${window.location.search}`;
      const parametros = parametrosDesdeUrl(
        new URLSearchParams(window.location.search),
      );
      // La actualización de `texto` sólo refleja el historial. Evita que el
      // debounce vuelva a navegar a la misma URL tras un back/forward.
      busquedaRestaurada.current = parametros.q ?? "";
      setTexto(parametros.q ?? "");
      irA(url, true);
    };
    window.addEventListener("popstate", alVolver);
    return () => window.removeEventListener("popstate", alVolver);
    // `irA` usa la vista vigente mediante refs, por lo que no debe reiniciar el listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const urlDe = (cambios: Record<string, string | null>) => {
    const siguiente: Record<string, unknown> = { ...spVisible };
    // Cualquier cambio ajeno a la paginación reinicia la página: descarta el
    // cursor actual y la pila de páginas visitadas (ver `antes` más abajo).
    delete siguiente.cursor;
    delete siguiente.antes;
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "") {
        delete siguiente[clave];
      } else {
        siguiente[clave] = valor;
      }
    }
    const query = serializarParametrosVentas(siguiente);
    return query.size ? `${pathname}?${query}` : pathname;
  };

  const asegurarCatalogos = () => {
    if (catalogos || direccionCatalogoCargando === direccion) return;
    setDireccionCatalogoCargando(direccion);
    void cargarCatalogosVentas(direccion)
      .then((resultado) => {
        if (!resultado.ok) {
          setErrorCarga(clasificarFallo({ codigo: resultado.codigo }));
        } else {
          setCatalogosPorDireccion((actuales) => ({
            ...actuales,
            [direccion]: resultado.data,
          }));
        }
      })
      .catch((error: unknown) =>
        setErrorCarga(
          clasificarFallo({
            error,
            enLinea:
              typeof navigator === "undefined" ? undefined : navigator.onLine,
          }),
        ),
      )
      .finally(() => {
        setDireccionCatalogoCargando((actual) =>
          actual === direccion ? null : actual,
        );
      });
  };

  const aplicarFiltros = (cambios: Record<string, string>) => {
    irA(urlDe(cambios));
  };

  const filtrosActivos = CAMPOS_FILTRO_CHIP.filter((campo) =>
    esFiltroActivo(campo, spVisible, direccion),
  );

  // --- Paginación por cursor con historial ------------------------------
  // `listarVentas` usa keyset pagination (WHERE (fecha, id) > cursor): es
  // eficiente y estable ante inserciones, pero solo sabe avanzar. Para
  // permitir "anterior" guardamos en la URL (`antes`) la pila de cursores
  // usados para llegar a cada página anterior; "primera página" se
  // representa como cadena vacía. Ir atrás = desapilar y reusar ese cursor.
  const historial = spVisible.antes ? spVisible.antes.split(",") : [];
  const paginaActual = historial.length + 1;
  const totalPaginas = Math.max(
    1,
    Math.ceil(paginaVisible.resumen.cantidad / porPagina),
  );

  const urlSiguiente = paginaVisible.cursor
    ? urlDe({
        cursor: paginaVisible.cursor,
        antes: [
          ...historial,
          spVisible.cursor ?? CENTINELA_PRIMERA_PAGINA,
        ].join(","),
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
        <SalesDirectionTabs
          ariaLabel="Dirección de ventas"
          direccion={direccion}
          opciones={[
            {
              id: "vendidas",
              label: "Vendidas",
              // Cambiar de dirección elimina filtros incompatibles con el
              // nuevo lado (issue #28): "empresa" es un universo de
              // contrapartes distinto en cada dirección, y vendedor/sede
              // propios no existen en "compradas".
              href: urlDe({
                dir: null,
                empresa: null,
                vendedor: null,
                sede: null,
              }),
            },
            {
              id: "compradas",
              label: "Compraron mis empleados",
              href: urlDe({
                dir: "compradas",
                empresa: null,
                vendedor: null,
                sede: null,
              }),
            },
          ]}
          onNavegar={irA}
          prefetch={false}
        />
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
          <Popover
            open={popoverAbierto}
            onOpenChange={(abierto) => {
              setPopoverAbierto(abierto);
              if (abierto) asegurarCatalogos();
            }}
          >
            <PopoverTrigger render={<Button variant="outline" size="sm" />}>
              <Filter className="size-4" />
              Filtros
              {filtrosActivos.length > 0 ? ` (${filtrosActivos.length})` : ""}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 max-w-[95vw]">
              <FiltrosVenta
                sp={spVisible}
                esAdmin={esAdmin}
                direccion={direccion}
                empresas={catalogos?.empresas ?? []}
                vendedores={catalogos?.vendedores ?? []}
                sedes={catalogos?.sedes ?? []}
                cargandoCatalogos={direccionCatalogoCargando === direccion}
                onAplicar={(c) => {
                  aplicarFiltros(c);
                  setPopoverAbierto(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="lg:hidden">
          <Sheet
            open={sheetAbierto}
            onOpenChange={(abierto) => {
              setSheetAbierto(abierto);
              if (abierto) asegurarCatalogos();
            }}
          >
            <SheetTrigger
              render={<Button variant="outline" className="relative size-11" />}
              aria-label={`Filtros${filtrosActivos.length > 0 ? ` (${filtrosActivos.length} aplicados)` : ""}`}
            >
              <Filter className="size-4" />
              {filtrosActivos.length > 0 ? (
                <span
                  className="bg-primary text-primary-foreground absolute -top-1 -right-1 grid size-4 place-items-center rounded-full text-[10px]"
                  aria-hidden="true"
                >
                  {filtrosActivos.length}
                </span>
              ) : null}
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
                  sp={spVisible}
                  esAdmin={esAdmin}
                  direccion={direccion}
                  empresas={catalogos?.empresas ?? []}
                  vendedores={catalogos?.vendedores ?? []}
                  sedes={catalogos?.sedes ?? []}
                  cargandoCatalogos={direccionCatalogoCargando === direccion}
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
              {etiquetaFiltro(
                campo,
                spVisible,
                catalogos?.empresas ?? [],
                catalogos?.vendedores ?? [],
                catalogos?.sedes ?? [],
              )}
              <button
                type="button"
                onClick={() => irA(urlDe({ [campo]: null }))}
                aria-label="Quitar filtro"
                className="ml-1"
              >
                ✕
              </button>
            </Badge>
          ))}
          <button
            type="button"
            onClick={() =>
              irA(
                urlDe(
                  Object.fromEntries(CAMPOS_FILTRO_CHIP.map((c) => [c, null])),
                ),
              )
            }
            className="text-muted-foreground text-xs underline underline-offset-2"
          >
            Limpiar filtros
          </button>
        </div>
      ) : null}

      {/* El listado que ya estaba sigue en pantalla debajo: el error no
          borra los resultados ni los filtros, solo avisa y ofrece repetir
          la misma consulta (issue #56). */}
      {errorCarga ? (
        <ErrorParcial
          clase={errorCarga}
          descripcion="No pudimos actualizar el listado. Los resultados que ves son los anteriores."
          reintentando={pendiente}
          onReintentar={() => {
            const url = urlFallida.current;
            if (url) irA(url, true);
          }}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <Metrica
          etiqueta="Operaciones"
          valor={paginaVisible.resumen.cantidad}
          detalle={
            spVisible.estado === "ANULADA"
              ? "Anuladas, según los filtros actuales"
              : spVisible.estado === "TODAS"
                ? "Incluye anuladas"
                : "Registradas, según los filtros actuales"
          }
          icono={<Receipt className="size-4.5" />}
        />
        <Metrica
          etiqueta="Total pagado"
          valor={
            <span className="money">
              {formatearSoles(paginaVisible.resumen.sumaFinal)}
            </span>
          }
          detalle="Bruto menos descuentos"
          icono={<WalletCards className="size-4.5" />}
          tono="success"
          className="hidden lg:block"
        />
        <Metrica
          etiqueta="Monto bruto"
          valor={
            <span className="money">
              {formatearSoles(paginaVisible.resumen.sumaBruto)}
            </span>
          }
          detalle="Antes de descuentos"
          icono={<Wallet className="size-4.5" />}
          className="hidden lg:block"
        />
        <Metrica
          etiqueta="Descuentos"
          valor={
            <span className="money">
              {formatearSoles(paginaVisible.resumen.sumaDescuento)}
            </span>
          }
          detalle="Beneficios aplicados"
          icono={<BadgePercent className="size-4.5" />}
          tono="warning"
          className="hidden lg:block"
        />
      </div>

      <div className="relative">
        {paginaVisible.items.length === 0 ? (
          <EstadoSinResultados
            icono={<Receipt className="size-6" />}
            hayFiltros={filtrosActivos.length > 0 || Boolean(spVisible.q)}
            inicial={{
              titulo: "Aún no hay ventas registradas",
              descripcion:
                "Cuando registres una operación, aparecerá aquí con su monto y estado.",
            }}
            filtrado={{
              titulo: "No encontramos coincidencias",
              descripcion:
                "Prueba con otros términos o limpia los filtros para ver más resultados.",
              accion: (
                <button
                  type="button"
                  onClick={() => {
                    setTexto("");
                    irA(
                      urlDe({
                        ...Object.fromEntries(
                          CAMPOS_FILTRO_CHIP.map((c) => [c, null]),
                        ),
                        q: null,
                      }),
                    );
                  }}
                  className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-bold"
                >
                  Limpiar filtros
                </button>
              ),
            }}
          />
        ) : (
          <>
            {/* Móvil: tarjetas agrupadas por día */}
            <div className="flex flex-col gap-3 lg:hidden">
              <ListaMovil
                items={paginaVisible.items}
                esAdmin={esAdmin}
                direccion={direccion}
                orden={orden}
                hoy={hoy}
                ayer={ayer}
                pendiente={pendiente}
                urlRetorno={urlRetorno}
                alAbrirDetalle={recordarPosicion}
              />
              <Paginador
                paginaActual={paginaActual}
                totalPaginas={totalPaginas}
                porPagina={porPagina}
                cantidad={paginaVisible.items.length}
                total={paginaVisible.resumen.cantidad}
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
                items={paginaVisible.items}
                esAdmin={esAdmin}
                direccion={direccion}
                urlDe={urlDe}
                onNavegar={irA}
                orden={orden}
                pendiente={pendiente}
                urlRetorno={urlRetorno}
                alAbrirDetalle={recordarPosicion}
                paginador={
                  <Paginador
                    paginaActual={paginaActual}
                    totalPaginas={totalPaginas}
                    porPagina={porPagina}
                    cantidad={paginaVisible.items.length}
                    total={paginaVisible.resumen.cantidad}
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
      </div>
    </section>
  );
}

function etiquetaFiltro(
  campo: string,
  sp: SearchParamsVentas,
  empresas: ContraparteOpcion[],
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
      return empresas.find((e) => e.id === valor)?.nombre ?? "Empresa";
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
  direccion,
  empresas,
  vendedores,
  sedes,
  cargandoCatalogos,
  onAplicar,
}: {
  sp: SearchParamsVentas;
  esAdmin: boolean;
  direccion: string;
  empresas: ContraparteOpcion[];
  vendedores: VendedorOpcion[];
  sedes: SedeOpcion[];
  cargandoCatalogos: boolean;
  onAplicar: (cambios: Record<string, string>) => void;
}) {
  const claseSelect =
    "border-input bg-background text-foreground h-9 w-full rounded-md border px-2 text-sm";
  // Vendedor y sede propios no existen del lado "compradas" (issue #28): en
  // esa dirección la venta la registra un vendedor de la empresa contraparte,
  // en una sede que tampoco es la mía.
  const soportaVendedorSede = esAdmin && direccion === "vendidas";
  // Contraparte = empresa compradora en "vendidas", empresa vendedora en
  // "compradas" (issue #28): el label lo deja explícito para no sugerir que
  // cualquier opción visible podría pertenecer al lado incorrecto.
  const etiquetaEmpresa =
    direccion === "compradas" ? "Empresa vendedora" : "Empresa compradora";

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
        <Label htmlFor="empresa">{etiquetaEmpresa}</Label>
        <select
          id="empresa"
          name="empresa"
          defaultValue={sp.empresa ?? ""}
          className={claseSelect}
        >
          <option value="">
            {cargandoCatalogos ? "Cargando opciones…" : "Todas"}
          </option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
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

      {soportaVendedorSede ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vendedor">Vendedor</Label>
          <select
            id="vendedor"
            name="vendedor"
            defaultValue={sp.vendedor ?? ""}
            className={claseSelect}
          >
            <option value="">
              {cargandoCatalogos ? "Cargando opciones…" : "Todos"}
            </option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombres} {v.apellidos}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {soportaVendedorSede ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sede">Sede</Label>
          <select
            id="sede"
            name="sede"
            defaultValue={sp.sede ?? ""}
            className={claseSelect}
          >
            <option value="">
              {cargandoCatalogos ? "Cargando opciones…" : "Todas"}
            </option>
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
  urlRetorno,
  alAbrirDetalle,
}: {
  items: FilaVenta[];
  esAdmin: boolean;
  direccion: string;
  orden: string;
  hoy: string;
  ayer: string;
  pendiente: boolean;
  urlRetorno: string;
  alAbrirDetalle: () => void;
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
                urlRetorno={urlRetorno}
                alAbrirDetalle={alAbrirDetalle}
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
  urlRetorno,
  alAbrirDetalle,
}: {
  venta: FilaVenta;
  esAdmin: boolean;
  direccion: string;
  urlRetorno: string;
  alAbrirDetalle: () => void;
}) {
  const anulada = venta.estado === "ANULADA";
  const contraparte = empresaContraparte(venta, direccion);
  return (
    <Link
      href={`/ventas/${venta.id}?volver=${encodeURIComponent(urlRetorno)}`}
      onClick={() => {
        // Lista → detalle (issue #70): la foto de esta tarjeta se toma en
        // el clic, antes de que la navegación reemplace la pantalla.
        iniciarTransicionMovil("adelante");
        alAbrirDetalle();
      }}
      className={`bg-card/90 ring-foreground/7 hover:bg-card active:bg-card animate-in fade-in-0 flex flex-col gap-1.5 rounded-[1.2rem] p-4 shadow-sm ring-1 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] active:shadow-sm active:duration-75 ${
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
  urlRetorno,
  alAbrirDetalle,
  paginador,
}: {
  items: FilaVenta[];
  esAdmin: boolean;
  direccion: string;
  urlDe: (cambios: Record<string, string | null>) => string;
  onNavegar: (url: string) => void;
  orden: string;
  pendiente: boolean;
  urlRetorno: string;
  alAbrirDetalle: () => void;
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
                  onClick={() => {
                    alAbrirDetalle();
                    router.push(
                      `/ventas/${v.id}?volver=${encodeURIComponent(urlRetorno)}`,
                    );
                  }}
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
                      href={`/ventas/${v.id}?volver=${encodeURIComponent(urlRetorno)}`}
                      aria-label={`Ver detalle de la venta de ${nombreCompleto}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        alAbrirDetalle();
                      }}
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
