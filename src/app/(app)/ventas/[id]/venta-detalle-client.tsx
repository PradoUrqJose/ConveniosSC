"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  FileText,
  MoreVertical,
  ReceiptText,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { bpsAPorcentaje } from "@/app/(app)/admin/convenios/dialogo-cambiar-termino";
import { formatearSoles } from "@/lib/dinero";
import { formatearFechaHoraLima, formatearFechaUI } from "@/lib/fechas";
import type { DetalleVenta } from "@/modules/ventas/query";
import { DialogoAnular } from "./dialogo-anular";

export function VentaDetalleClient({ venta }: { venta: DetalleVenta }) {
  const [anularAbierto, setAnularAbierto] = useState(false);
  const anulada = venta.estado === "ANULADA";

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-10">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/ventas"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm font-semibold"
        >
          <span className="bg-card ring-foreground/8 grid size-9 place-items-center rounded-xl shadow-sm ring-1">
            <ArrowLeft className="size-4" />
          </span>
          Volver a ventas
        </Link>
        {venta.puedeAnular ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setAnularAbierto(true)}
              >
                <Ban />
                Anular
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {anulada ? (
        <div className="bg-destructive/10 border-destructive/20 text-destructive rounded-xl border p-3 text-sm">
          <p className="font-medium">
            Anulada el{" "}
            {venta.anuladaAt ? formatearFechaHoraLima(venta.anuladaAt) : "—"}
            {venta.anuladaPor
              ? ` por ${venta.anuladaPor.nombres} ${venta.anuladaPor.apellidos}`
              : ""}
          </p>
          {venta.motivoAnulacion ? (
            <p className="mt-1">{venta.motivoAnulacion}</p>
          ) : null}
        </div>
      ) : null}

      {venta.requiereRevision && !anulada ? (
        <div className="bg-warning/10 border-warning/20 text-warning rounded-xl border p-3 text-sm">
          El empleado de esta venta fue rechazado por su empresa. Revisa la
          operación.
        </div>
      ) : null}

      <div className="from-primary via-primary relative overflow-hidden rounded-[1.6rem] bg-linear-to-br to-blue-950 p-5 text-white shadow-[0_24px_65px_rgba(29,78,216,.2)] sm:p-7">
        <div className="absolute -top-20 -right-12 size-56 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-blue-100/70 uppercase">
              Total de la operación
            </p>
            <p
              className={`money mt-2 text-3xl font-bold tracking-tight sm:text-4xl ${anulada ? "line-through opacity-70" : ""}`}
            >
              {formatearSoles(venta.montoFinalCentimos)}
            </p>
            <p className="mt-2 text-xs text-blue-100/70">
              Registrada {formatearFechaHoraLima(venta.createdAt)}
            </p>
          </div>
          {anulada ? (
            <Badge variant="destructive">Anulada</Badge>
          ) : (
            <Badge className="border border-emerald-200/30 bg-emerald-300/15 text-emerald-100">
              Registrada
            </Badge>
          )}
        </div>
      </div>

      <div className="surface-panel flex items-center gap-4 p-5 sm:p-6">
        <span className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl">
          <UserRound className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-muted-foreground text-[10px] font-bold tracking-[0.13em] uppercase">
            Empleado beneficiario
          </h2>
          <p className="mt-1 truncate font-bold">
            {venta.empleado.nombres.toUpperCase()}{" "}
            {venta.empleado.apellidos.toUpperCase()}
          </p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {venta.empleado.tipoDocumento === "DNI" ? "DNI" : "CE"}{" "}
            {venta.empleado.numeroDocumento} · {venta.empresaCompradora.nombre}
          </p>
        </div>
      </div>

      <div className="surface-panel p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold tracking-tight">
          <ReceiptText className="text-primary size-4" /> Venta
        </h2>
        <dl className="mt-4 divide-y text-sm">
          <Fila
            etiqueta="Empresa vendedora"
            valor={venta.empresaVendedora.nombre}
          />
          <Fila etiqueta="Sede" valor={venta.sede.nombre} />
          <Fila
            etiqueta="Vendedor"
            valor={`${venta.vendedor.nombres} ${venta.vendedor.apellidos}`}
          />
          <Fila etiqueta="Fecha" valor={formatearFechaUI(venta.fechaVenta)} />
          <Fila
            etiqueta="Registrada"
            valor={formatearFechaHoraLima(venta.createdAt)}
          />
        </dl>
      </div>

      <div
        className={`surface-panel p-5 text-sm sm:p-6 ${anulada ? "text-muted-foreground line-through" : ""}`}
      >
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">Monto</span>
          <span className="money">
            {formatearSoles(venta.montoBrutoCentimos)}
          </span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">
            Descuento ({bpsAPorcentaje(venta.descuentoBps)}%)
          </span>
          <span className="money">
            − {formatearSoles(venta.montoDescuentoCentimos)}
          </span>
        </div>
        <div className="mt-1 flex justify-between border-t pt-2 font-semibold">
          <span>Total</span>
          <span className="money">
            {formatearSoles(venta.montoFinalCentimos)}
          </span>
        </div>
      </div>

      <div className="surface-panel flex flex-col gap-3 p-5 sm:p-6">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Evidencia
        </h2>
        {venta.adjuntos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin adjuntos.</p>
        ) : !venta.adjuntos[0]?.puedeVer ? (
          <p className="text-muted-foreground text-sm">
            {venta.totalAdjuntos} archivo{venta.totalAdjuntos === 1 ? "" : "s"}{" "}
            adjunto
            {venta.totalAdjuntos === 1 ? "" : "s"}. Solo la empresa vendedora
            puede abrirlos.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {venta.adjuntos.map((a) => (
              <a
                key={a.id}
                href={`/api/adjuntos/${a.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-muted flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border text-center"
              >
                {a.mime === "application/pdf" ? (
                  <>
                    <FileText className="text-muted-foreground size-6" />
                    <span className="text-muted-foreground px-1 text-[0.65rem]">
                      PDF
                    </span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/adjuntos/${a.id}?miniatura=1`}
                    alt={
                      a.descripcion ??
                      (a.tipo === "DOCUMENTO_VENTA" ? "Documento" : "Evidencia")
                    }
                    className="size-full object-cover"
                  />
                )}
              </a>
            ))}
          </div>
        )}
      </div>

      {venta.observacion ? (
        <div className="surface-panel flex flex-col gap-1 p-5 sm:p-6">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Observación
          </h2>
          <p className="text-sm">{venta.observacion}</p>
        </div>
      ) : null}

      {anularAbierto ? (
        <DialogoAnular
          ventaId={venta.id}
          entidad={`Venta por ${formatearSoles(venta.montoFinalCentimos)}`}
          onCerrar={() => setAnularAbierto(false)}
        />
      ) : null}
    </section>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="text-right font-medium">{valor}</dd>
    </div>
  );
}
