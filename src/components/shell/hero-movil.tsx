import Link from "next/link";
import { ArrowRight, Building2, Globe2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { AccionCuentaMovil } from "@/components/shell/cabecera-movil";

/**
 * Hero de pantalla raíz — rediseño PWA (2026-09, v3, referencia del
 * usuario).
 *
 * Reemplaza a `CabeceraMovil` en las pantallas de inicio (vendedor y
 * dashboard): tarjeta azul con la piel del banner de escritorio, saludo
 * con avatar (la entrada a la cuenta, mismo nombre accesible "Tu cuenta:"
 * que la cabecera raíz) y la píldora de empresa a su derecha en la misma
 * barra, una cifra protagonista centrada y acciones en píldora. Los
 * `children` (la tarjeta destacada) se pintan debajo, como tarjeta propia.
 *
 * Solo móvil (`lg:hidden`): el escritorio conserva su `HeroPagina` /
 * `DashboardBanner`. La piel vive en `globals.css` (`.mob-hero*`).
 */
export function HeroMovil({
  saludo,
  nombre,
  empresa,
  resumen,
  acciones,
  children,
  className,
}: {
  saludo: string;
  nombre: string;
  /** `undefined` oculta la píldora de empresa; `null` es "Todas las empresas". */
  empresa?: string | null;
  resumen: ReactNode;
  acciones?: ReactNode;
  /** Tarjeta destacada (`TarjetaDestacadaMovil`). */
  children?: ReactNode;
  className?: string;
}) {
  const IconoEmpresa = empresa ? Building2 : Globe2;
  return (
    <>
      <section className={cn("mob-hero lg:hidden", className)}>
        <div className="mob-hero-barra">
          <div className="mob-hero-identidad">
            <AccionCuentaMovil className="mob-hero-avatar" />
            <div className="min-w-0">
              <p className="mob-hero-saludo">
                {saludo} <span aria-hidden="true">👋</span>
              </p>
              <h1 className="mob-cabecera-titulo mob-hero-nombre">{nombre}</h1>
            </div>
          </div>
          {empresa !== undefined ? (
            <p className="mob-hero-empresa">
              <IconoEmpresa className="size-4 shrink-0" aria-hidden="true" />
              <span>{empresa ?? "Todas las empresas"}</span>
            </p>
          ) : null}
        </div>
        <div className="mob-hero-resumen mob-hero-resumen-protagonista">
          {resumen}
        </div>
        {acciones ? <div className="mob-hero-acciones">{acciones}</div> : null}
      </section>
      {children ? <div className="lg:hidden">{children}</div> : null}
    </>
  );
}

/** Una métrica de apoyo de `CifraHero`: ícono, etiqueta y valor. */
export type MetricaHero = {
  icono: ReactNode;
  etiqueta: string;
  valor: ReactNode;
};

/**
 * Etiqueta + cifra protagonista del hero, con un detalle debajo: una
 * frase (`detalle`) o, cuando el dato pesa más que una línea, hasta dos
 * tarjetas con ícono (`metricas`) — referencia del usuario (2026-09).
 */
export function CifraHero({
  etiqueta,
  cifra,
  detalle,
  metricas,
}: {
  etiqueta: string;
  cifra: ReactNode;
  detalle?: ReactNode;
  metricas?: MetricaHero[];
}) {
  return (
    <>
      <p className="mob-hero-etiqueta">{etiqueta}</p>
      <p className="mob-hero-cifra">{cifra}</p>
      {metricas?.length ? (
        <div className="mob-hero-metricas">
          {metricas.map((metrica, indice) => (
            <div className="mob-hero-metrica" key={indice}>
              <span className="mob-hero-metrica-icono" aria-hidden="true">
                {metrica.icono}
              </span>
              <div className="min-w-0">
                <span className="mob-hero-metrica-etiqueta">
                  {metrica.etiqueta}
                </span>
                <strong className="mob-hero-metrica-valor">
                  {metrica.valor}
                </strong>
              </div>
            </div>
          ))}
        </div>
      ) : detalle ? (
        <p className="mob-hero-detalle">{detalle}</p>
      ) : null}
    </>
  );
}

/** Mientras la cifra llega por streaming: misma altura, sin salto. */
export function CifraHeroEsqueleto({
  etiqueta,
  metricas = 0,
}: {
  etiqueta: string;
  /** Cantidad de tarjetas de métrica a reservar (0 si el hero usa `detalle`). */
  metricas?: number;
}) {
  return (
    <>
      <p className="mob-hero-etiqueta">{etiqueta}</p>
      <span className="mob-hero-cifra-esqueleto" aria-hidden="true" />
      {metricas > 0 ? (
        <div className="mob-hero-metricas" aria-hidden="true">
          {Array.from({ length: metricas }, (_, indice) => (
            <span key={indice} className="mob-hero-metrica" />
          ))}
        </div>
      ) : null}
      <span className="sr-only">Cargando resumen…</span>
    </>
  );
}

export function PildoraHero({
  href,
  icono,
  tono = "principal",
  children,
}: {
  href: string;
  icono: ReactNode;
  /** `secundario` baja un peldaño el énfasis (p. ej. la segunda acción). */
  tono?: "principal" | "secundario";
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="mob-hero-pildora"
      data-tono={tono === "secundario" ? "secundario" : undefined}
    >
      {icono}
      <span className="truncate">{children}</span>
    </Link>
  );
}

/**
 * Un único mensaje accionable por pantalla: título con ícono, texto con el
 * dato clave en `<strong>` y la acción dentro del bloque tenue.
 */
export function TarjetaDestacadaMovil({
  icono,
  titulo,
  accion,
  children,
}: {
  icono: ReactNode;
  titulo: string;
  accion?: { href: string; etiqueta: string };
  children: ReactNode;
}) {
  return (
    <article className="mob-destacada">
      <h2 className="mob-destacada-encabezado">
        <span className="mob-destacada-icono" aria-hidden="true">
          {icono}
        </span>
        {titulo}
      </h2>
      <div className="mob-destacada-cuerpo">
        <p>{children}</p>
        {accion ? (
          <Link href={accion.href} className="mob-destacada-accion">
            {accion.etiqueta}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

/** Reserva el lugar de la tarjeta destacada mientras llega su dato. */
export function TarjetaDestacadaEsqueleto() {
  return <div className="mob-destacada h-40" aria-hidden="true" />;
}

/**
 * Skeleton del hero para los `loading.tsx` de las pantallas raíz.
 *
 * `conEmpresa` reserva la píldora de empresa en la barra y `conFiltro` el
 * cuadro de filtros en la fila de acciones (solo el dashboard usa las dos).
 */
export function HeroMovilEsqueleto({
  conEmpresa = false,
  conFiltro = false,
}: {
  conEmpresa?: boolean;
  conFiltro?: boolean;
}) {
  return (
    <>
      <div className="mob-hero lg:hidden" aria-hidden="true">
        <div className="mob-hero-barra">
          <div className="mob-hero-identidad">
            <span className="mob-hero-avatar" />
            <span className="mob-hero-cifra-esqueleto mt-0 h-9 w-36" />
          </div>
          {conEmpresa ? <span className="mob-hero-empresa w-28" /> : null}
        </div>
        <div className="mob-hero-resumen mob-hero-resumen-protagonista">
          <span className="mob-hero-cifra-esqueleto" />
        </div>
        <div className="mob-hero-acciones">
          <span className="mob-hero-pildora" />
          <span className="mob-hero-pildora" />
          {conFiltro ? <span className="mob-hero-cuadro" /> : null}
        </div>
      </div>
      <div className="lg:hidden">
        <TarjetaDestacadaEsqueleto />
      </div>
    </>
  );
}
