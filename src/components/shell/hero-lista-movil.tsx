"use client";

import { Building2, Globe2, Search, X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { AccionCuentaMovil } from "@/components/shell/cabecera-movil";
import { useCuentaMovil } from "@/components/shell/contexto-cuenta-movil";

/**
 * Hero de las pantallas raíz de listado (Ventas, Empleados, Sedes) —
 * rediseño PWA 2026-09.
 *
 * Es el mismo bloque azul del dashboard (`HeroMovil`, `.mob-hero*`), con el
 * título de la pantalla en lugar del saludo: avatar de cuenta, alcance
 * (empresa o "Todas las empresas") sobre el título, una cifra protagonista,
 * y en la fila de acciones el buscador como píldora blanca junto al cuadro
 * oscuro de filtros. Se pasa a `CabeceraPagina` por `movil`, así que el
 * escritorio sigue con su cabecera de siempre.
 */
export function HeroListaMovil({
  titulo,
  accion,
  resumen,
  buscador,
  filtros,
  className,
}: {
  titulo: string;
  /** Acción primaria de la pantalla (círculo sólido a la derecha). */
  accion?: ReactNode;
  /** `CifraHero` con la cifra que resume el listado. */
  resumen?: ReactNode;
  /** `BuscadorHero`. */
  buscador?: ReactNode;
  /** Disparador de filtros con estilo `.mob-hero-cuadro`. */
  filtros?: ReactNode;
  className?: string;
}) {
  const cuenta = useCuentaMovil();
  const empresa = cuenta?.perfil.empresaNombre ?? null;
  const IconoEmpresa = empresa ? Building2 : Globe2;
  return (
    <section className={cn("mob-hero lg:hidden", className)}>
      <div className="mob-hero-barra">
        <AccionCuentaMovil className="mob-hero-avatar" />
        <div className="min-w-0 flex-1">
          {cuenta ? (
            <p className="mob-hero-saludo mob-hero-contexto-linea">
              <IconoEmpresa className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {empresa ?? "Todas las empresas"}
              </span>
            </p>
          ) : null}
          <h1 className="mob-cabecera-titulo mob-hero-nombre">{titulo}</h1>
        </div>
        {accion}
      </div>
      {resumen ? <div className="mob-hero-resumen">{resumen}</div> : null}
      {buscador || filtros ? (
        <div className="mob-hero-acciones" role="search">
          {buscador}
          {filtros}
        </div>
      ) : null}
    </section>
  );
}

/** Buscador del hero: píldora blanca con ícono y botón de limpiar. */
export function BuscadorHero({
  valor,
  alCambiar,
  placeholder,
  etiqueta,
}: {
  valor: string;
  alCambiar: (valor: string) => void;
  placeholder: string;
  /** Nombre accesible completo (el placeholder no lo es). */
  etiqueta: string;
}) {
  return (
    <div className="mob-hero-buscador">
      <Search className="size-5 shrink-0" aria-hidden="true" />
      <input
        type="search"
        enterKeyHint="search"
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value)}
        placeholder={placeholder}
        aria-label={etiqueta}
        className="mob-hero-buscador-campo"
      />
      {valor ? (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => alCambiar("")}
          className="mob-hero-buscador-limpiar"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/** Skeleton del hero de listado para los `loading.tsx`. */
export function HeroListaEsqueleto() {
  return (
    <div className="mob-hero lg:hidden" aria-hidden="true">
      <div className="mob-hero-barra">
        <span className="mob-hero-avatar" />
        <span className="mob-hero-cifra-esqueleto mt-0 h-9 w-36" />
      </div>
      <div className="mob-hero-resumen">
        <span className="mob-hero-cifra-esqueleto mt-0 h-4 w-28" />
        <span className="mob-hero-cifra-esqueleto" />
      </div>
      <div className="mob-hero-acciones">
        <span className="mob-hero-buscador" />
        <span className="mob-hero-cuadro" />
      </div>
    </div>
  );
}
