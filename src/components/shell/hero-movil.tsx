import Link from "next/link";
import { ArrowRight, Building2, Globe2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { AccionCuentaMovil } from "@/components/shell/cabecera-movil";

/**
 * Hero de pantalla raíz — rediseño PWA (2026-09).
 *
 * Reemplaza a `CabeceraMovil` en las pantallas de inicio (vendedor y
 * dashboard): tarjeta azul con la piel del banner de escritorio, saludo
 * con avatar (la entrada a la cuenta, mismo nombre accesible "Tu cuenta:"
 * que la cabecera raíz), una cifra protagonista y acciones en píldora. Los
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
  /** `undefined` oculta el contexto; `null` es "Todas las empresas". */
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
          <AccionCuentaMovil className="mob-hero-avatar" />
          <div className="min-w-0 flex-1">
            <p className="mob-hero-saludo">
              {saludo} <span aria-hidden="true">👋</span>
            </p>
            <h1 className="mob-cabecera-titulo mob-hero-nombre">{nombre}</h1>
          </div>
        </div>
        {empresa !== undefined ? (
          <p className="mob-hero-contexto">
            <IconoEmpresa className="size-3 shrink-0" aria-hidden="true" />
            <span>{empresa ?? "Todas las empresas"}</span>
          </p>
        ) : null}
        <div className="mob-hero-resumen">{resumen}</div>
        {acciones ? <div className="mob-hero-acciones">{acciones}</div> : null}
      </section>
      {children ? <div className="lg:hidden">{children}</div> : null}
    </>
  );
}

/** Etiqueta + cifra protagonista + detalle del hero. */
export function CifraHero({
  etiqueta,
  cifra,
  detalle,
}: {
  etiqueta: string;
  cifra: ReactNode;
  detalle?: ReactNode;
}) {
  return (
    <>
      <p className="mob-hero-etiqueta">{etiqueta}</p>
      <p className="mob-hero-cifra">{cifra}</p>
      {detalle ? <p className="mob-hero-detalle">{detalle}</p> : null}
    </>
  );
}

/** Mientras la cifra llega por streaming: misma altura, sin salto. */
export function CifraHeroEsqueleto({ etiqueta }: { etiqueta: string }) {
  return (
    <>
      <p className="mob-hero-etiqueta">{etiqueta}</p>
      <span className="mob-hero-cifra-esqueleto" aria-hidden="true" />
      <span className="sr-only">Cargando resumen…</span>
    </>
  );
}

export function PildoraHero({
  href,
  icono,
  children,
}: {
  href: string;
  icono: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="mob-hero-pildora">
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

/** Skeleton del hero para los `loading.tsx` de las pantallas raíz. */
export function HeroMovilEsqueleto() {
  return (
    <>
      <div className="mob-hero lg:hidden" aria-hidden="true">
        <div className="mob-hero-barra">
          <span className="mob-hero-avatar" />
          <span className="mob-hero-cifra-esqueleto mt-0 h-9 w-36" />
        </div>
        <div className="mob-hero-resumen">
          <span className="mob-hero-cifra-esqueleto" />
        </div>
        <div className="mob-hero-acciones">
          <span className="mob-hero-pildora" />
          <span className="mob-hero-pildora" />
        </div>
      </div>
      <div className="lg:hidden">
        <TarjetaDestacadaEsqueleto />
      </div>
    </>
  );
}
