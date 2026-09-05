import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  AccionCuentaMovil,
  CabeceraMovil,
  ContextoMovil,
  type AtrasMovil,
} from "@/components/shell/cabecera-movil";
import { cn } from "@/lib/utils";

/**
 * Cabecera de página. Desde el issue #52 son dos cabeceras distintas, no
 * una responsive:
 *
 * - **Escritorio (≥1024px):** exactamente el mismo marcado aprobado —
 *   kicker, icono, título, descripción y acciones. No se tocó una clase.
 * - **Móvil (<1024px):** `CabeceraMovil`, la cabecera de ruta del shell
 *   móvil. Ahí el título envuelve en vez de truncarse, las acciones miden
 *   44x44 y —al no existir ya el header global— el avatar de cuenta y el
 *   context pill de empresa entran en las pantallas raíz.
 *
 * `atras` convierte la pantalla en secundaria (back iconográfico con
 * fallback); `accionesMovil` permite dejar en móvil solo la acción
 * primaria y bajar las secundarias al contenido.
 */
export function CabeceraPagina({
  titulo,
  descripcion,
  kicker,
  icono,
  acciones,
  accionesMovil,
  atras,
  contextoMovil = true,
  className,
}: {
  titulo: string;
  descripcion?: ReactNode;
  kicker?: string;
  icono?: ReactNode;
  acciones?: ReactNode;
  /** Acciones de la cabecera móvil. Por defecto, las mismas de escritorio. */
  accionesMovil?: ReactNode;
  /** Presente = pantalla secundaria: la cabecera móvil dibuja el back. */
  atras?: AtrasMovil;
  /** Context pill de empresa/alcance. Se apaga donde no decide nada. */
  contextoMovil?: boolean;
  className?: string;
}) {
  const esRaiz = !atras;
  return (
    <>
      <div className="lg:hidden">
        <CabeceraMovil
          titulo={titulo}
          variante={esRaiz ? "raiz" : "secundaria"}
          atras={atras}
          contexto={esRaiz && contextoMovil ? <ContextoMovil /> : undefined}
          acciones={
            <>
              {accionesMovil ?? acciones}
              {esRaiz ? <AccionCuentaMovil /> : null}
            </>
          }
        />
      </div>
      <header
        className={cn(
          // En móvil (PWA) la cabecera se reduce a una línea: título + acciones.
          // El kicker, el icono y la descripción son solo de escritorio.
          "hidden flex-row items-center justify-between gap-3 md:items-end md:gap-5 lg:flex",
          className,
        )}
      >
        <div className="flex min-w-0 items-start gap-3.5">
          {icono ? (
            <span className="bg-primary/10 text-primary ring-primary/10 mt-0.5 hidden size-11 shrink-0 place-items-center rounded-2xl ring-1 md:grid">
              {icono}
            </span>
          ) : null}
          <div className="min-w-0">
            {kicker ? (
              <p className="page-kicker hidden md:block">{kicker}</p>
            ) : null}
            <h1 className="truncate text-xl leading-[1.15] font-bold tracking-[-0.03em] md:text-[2rem] md:tracking-[-0.04em] md:whitespace-normal">
              {titulo}
            </h1>
            {descripcion ? (
              <div className="text-muted-foreground mt-2 hidden max-w-2xl text-sm leading-6 md:block">
                {descripcion}
              </div>
            ) : null}
          </div>
        </div>
        {acciones ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {acciones}
          </div>
        ) : null}
      </header>
    </>
  );
}

export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
  className,
}: {
  icono: ReactNode;
  titulo: string;
  descripcion: ReactNode;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border/80 bg-card/60 relative grid min-h-72 place-items-center overflow-hidden rounded-[1.5rem] border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <div className="bg-primary/5 absolute -top-16 left-1/2 size-48 -translate-x-1/2 rounded-full blur-3xl" />
      <div className="relative max-w-sm">
        <span className="bg-primary/10 text-primary ring-primary/10 mx-auto grid size-14 place-items-center rounded-[1.25rem] ring-1">
          {icono}
        </span>
        <h2 className="mt-4 text-base font-bold tracking-tight">{titulo}</h2>
        <div className="text-muted-foreground mt-1.5 text-sm leading-6">
          {descripcion}
        </div>
        {accion ? (
          <div className="mt-5 flex justify-center">{accion}</div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Los dos vacíos de una lista, que la auditoría veía mezclados — issue #56.
 *
 * «Aún no hay ventas» y «no encontramos coincidencias» se parecen en el
 * dibujo y no se parecen en nada para el usuario: el primero pide crear
 * algo, el segundo pide soltar un filtro. Este envoltorio obliga a escribir
 * los dos textos y elige por `hayFiltros`, de modo que una pantalla nueva no
 * pueda quedarse solo con el genérico.
 */
export function EstadoSinResultados({
  icono,
  hayFiltros,
  inicial,
  filtrado,
  className,
}: {
  icono: ReactNode;
  /** ¿Hay búsqueda o filtros aplicados? */
  hayFiltros: boolean;
  /** Lista genuinamente vacía: todavía no existe el primer registro. */
  inicial: { titulo: string; descripcion: ReactNode; accion?: ReactNode };
  /** Hay registros, pero ninguno pasa el filtro actual. */
  filtrado: { titulo: string; descripcion: ReactNode; accion?: ReactNode };
  className?: string;
}) {
  const estado = hayFiltros ? filtrado : inicial;
  return (
    <EstadoVacio
      icono={icono}
      titulo={estado.titulo}
      descripcion={estado.descripcion}
      accion={estado.accion}
      className={className}
    />
  );
}

export function Metrica({
  etiqueta,
  valor,
  detalle,
  icono,
  tono = "primary",
  className,
}: {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  icono: ReactNode;
  tono?: "primary" | "success" | "warning" | "neutral";
  className?: string;
}) {
  const colores = {
    primary: "bg-primary/10 text-primary ring-primary/10",
    success: "bg-success/10 text-success ring-success/10",
    warning: "bg-warning/10 text-warning ring-warning/10",
    neutral: "bg-muted text-muted-foreground ring-border",
  }[tono];

  return (
    <article
      className={cn(
        "group bg-card/90 ring-foreground/7 elevation-normal elevation-hover relative min-w-0 overflow-hidden rounded-[1.25rem] p-3.5 ring-1 sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground min-w-0 truncate text-xs leading-5 font-bold tracking-[0.05em] uppercase">
          {etiqueta}
        </p>
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg ring-1 sm:size-9 sm:rounded-xl",
            colores,
          )}
        >
          {icono}
        </span>
      </div>
      {/* Tamaño fluido: los importes largos (S/ 1'234,567.89) deben caber en
          una sola línea aun en tarjetas de media pantalla. */}
      <div className="mt-2.5 overflow-hidden text-[clamp(0.95rem,4vw,1.7rem)] leading-none font-bold tracking-[-0.035em] whitespace-nowrap sm:mt-3 sm:text-[1.7rem]">
        {valor}
      </div>
      {detalle ? (
        <div className="text-muted-foreground mt-1.5 hidden truncate text-xs sm:mt-2 sm:block">
          {detalle}
        </div>
      ) : null}
    </article>
  );
}

/**
 * Hero de apertura de página: gradiente diagonal, kicker, título dominante y
 * acción principal opcional en alto contraste. Extraído del Dashboard
 * Vendedor (`src/app/(app)/page.tsx`), la referencia aprobada — ver
 * `docs/09-GUIA-REDISENO-UI-DESKTOP.md` §4.1. Se reserva para cabeceras de
 * alto valor: no convertir cada card en un banner.
 */
export function HeroPagina({
  kicker,
  titulo,
  descripcion,
  accion,
  className,
}: {
  kicker?: ReactNode;
  titulo: ReactNode;
  descripcion?: ReactNode;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "from-primary via-primary elevation-floating relative overflow-hidden rounded-[1.25rem] bg-linear-to-br to-blue-950 px-4 py-4 text-white sm:rounded-[1.75rem] sm:px-7 sm:py-8 lg:px-9",
        className,
      )}
    >
      <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px] opacity-20" />
      <div className="absolute -top-20 -right-16 size-64 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          {kicker ? (
            <p className="hidden items-center gap-2 text-xs font-bold tracking-[0.14em] text-cyan-100/80 uppercase sm:flex">
              {kicker}
            </p>
          ) : null}
          <h1 className="text-xl font-bold tracking-[-0.045em] sm:mt-3 sm:text-4xl">
            {titulo}
          </h1>
          {descripcion ? (
            <p className="mt-1 max-w-xl text-xs leading-5 text-blue-100/80 sm:mt-2 sm:text-base sm:leading-6">
              {descripcion}
            </p>
          ) : null}
        </div>
        {accion}
      </div>
    </div>
  );
}

/**
 * Panel/surface compartido con cabecera y pie opcionales. Reemplaza el
 * patrón `.surface-panel` repetido con cabecera propia en cada pantalla —
 * ver `docs/09-GUIA-REDISENO-UI-DESKTOP.md` §4.3. El cuerpo no añade padding
 * propio: cada consumidor decide su densidad interna (tabla, lista, form).
 */
export function PanelSuperficie({
  cabecera,
  pie,
  children,
  className,
  bodyClassName,
}: {
  cabecera?: ReactNode;
  pie?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("surface-panel", className)}>
      {cabecera ? (
        <div className="border-border/70 flex flex-col gap-3 border-b px-4 py-3.5 sm:px-6 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
          {cabecera}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
      {pie ? (
        <div className="border-border/70 flex items-center justify-between gap-3 border-t px-4 py-3.5 sm:px-6">
          {pie}
        </div>
      ) : null}
    </div>
  );
}

const TONOS_ESTADO_BADGE = {
  success:
    "border-transparent bg-success/10 text-success dark:bg-success/20 focus-visible:ring-success/20 dark:focus-visible:ring-success/40",
  warning:
    "border-transparent bg-warning/10 text-warning dark:bg-warning/20 focus-visible:ring-warning/20 dark:focus-visible:ring-warning/40",
  neutral: "border-transparent bg-muted text-muted-foreground",
} as const;

/**
 * Badge de estado centralizado. La semántica de color viene de
 * `docs/05-DESIGN-SYSTEM.md` §1: `success` = activo/registrada,
 * `warning` = pendiente/revisión, `destructive` = anulada/rechazada,
 * `neutral` = inactivo. El estado nunca se comunica solo por color: usar
 * siempre `children` con texto legible.
 */
export function EstadoBadge({
  tono,
  children,
  className,
}: {
  tono: "success" | "warning" | "destructive" | "neutral";
  children: ReactNode;
  className?: string;
}) {
  if (tono === "destructive") {
    return (
      <Badge variant="destructive" className={className}>
        {children}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(TONOS_ESTADO_BADGE[tono], className)}
    >
      {children}
    </Badge>
  );
}

export type DireccionOrden = "asc" | "desc" | null;

/**
 * Deriva el `aria-sort` del `<th>` a partir del campo activo. Debe aplicarse
 * en el elemento `TableHead`/`th` que envuelve a `EncabezadoOrdenable`, no en
 * el botón interno.
 */
export function ariaSortDe(
  orden: string,
  campoAsc: string,
  campoDesc: string,
): "ascending" | "descending" | "none" {
  if (orden === campoAsc) return "ascending";
  if (orden === campoDesc) return "descending";
  return "none";
}

/**
 * Encabezado de columna ordenable compartido entre tablas desktop. Sustituye
 * las flechas de texto `↑/↓` por iconos Lucide con foco visible; el
 * `aria-sort` del `<th>` se deriva con `ariaSortDe`.
 */
export function EncabezadoOrdenable({
  label,
  campoAsc,
  campoDesc,
  orden,
  urlDe,
  onNavegar,
  alinearDerecha,
}: {
  label: string;
  campoAsc: string;
  campoDesc: string;
  orden: string;
  urlDe: (cambios: Record<string, string | null>) => string;
  onNavegar: (url: string) => void;
  alinearDerecha?: boolean;
}) {
  const direccion = ariaSortDe(orden, campoAsc, campoDesc);
  const activo = direccion !== "none";
  const siguiente = direccion === "descending" ? campoAsc : campoDesc;
  const Icono =
    direccion === "ascending"
      ? ArrowUp
      : direccion === "descending"
        ? ArrowDown
        : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={() => onNavegar(urlDe({ orden: siguiente }))}
      className={cn(
        "focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded outline-none hover:underline focus-visible:ring-2",
        alinearDerecha ? "flex-row-reverse" : "",
        activo ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
      <Icono
        className={cn("size-3.5 shrink-0", activo ? "" : "opacity-50")}
        aria-hidden="true"
      />
    </button>
  );
}

/**
 * Indicador de carga sobre una superficie que ya tiene contenido (tabla,
 * panel de resultados). Atenúa lo anterior en vez de borrarlo — ver
 * `docs/09-GUIA-REDISENO-UI-DESKTOP.md` §5 «Estado pendiente». `children`
 * debe reproducir la geometría del contenido real (skeleton de filas/cards),
 * no un loader aislado.
 */
export function IndicadorPendienteSuperficie({
  children,
  className,
  top,
}: {
  children: ReactNode;
  className?: string;
  top?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "bg-background/70 animate-in fade-in-0 absolute inset-0 duration-150 motion-reduce:animate-none",
        top,
        className,
      )}
    >
      <span className="sr-only">Actualizando resultados…</span>
      {children}
    </div>
  );
}
