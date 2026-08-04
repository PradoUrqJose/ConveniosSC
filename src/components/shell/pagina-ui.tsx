import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function CabeceraPagina({
  titulo,
  descripcion,
  kicker,
  icono,
  acciones,
  className,
}: {
  titulo: string;
  descripcion?: ReactNode;
  kicker?: string;
  icono?: ReactNode;
  acciones?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        // En móvil (PWA) la cabecera se reduce a una línea: título + acciones.
        // El kicker, el icono y la descripción son solo de escritorio.
        "flex flex-row items-center justify-between gap-3 md:items-end md:gap-5",
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

export function Metrica({
  etiqueta,
  valor,
  detalle,
  icono,
  tono = "primary",
}: {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  icono: ReactNode;
  tono?: "primary" | "success" | "warning" | "neutral";
}) {
  const colores = {
    primary: "bg-primary/10 text-primary ring-primary/10",
    success: "bg-success/10 text-success ring-success/10",
    warning: "bg-warning/10 text-warning ring-warning/10",
    neutral: "bg-muted text-muted-foreground ring-border",
  }[tono];

  return (
    <article className="group bg-card/90 ring-foreground/7 relative min-w-0 overflow-hidden rounded-[1.25rem] p-3.5 shadow-[0_10px_30px_rgba(15,23,42,.045)] ring-1 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,.09)] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground min-w-0 truncate text-[0.65rem] leading-5 font-bold tracking-[0.05em] uppercase sm:text-xs">
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
