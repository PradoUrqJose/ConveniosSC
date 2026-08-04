"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, FileText, MoreVertical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
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
    <section className="mx-auto flex max-w-xl flex-col gap-6 pb-10">
      <div className="flex items-center justify-between">
        <Link
          href="/ventas"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Venta
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

      <div className="flex items-center gap-2 text-sm">
        {anulada ? (
          <Badge variant="destructive">Anulada</Badge>
        ) : (
          <Badge className="bg-success/10 text-success border-success/20 border">
            Registrada
          </Badge>
        )}
        <span className="text-muted-foreground">
          {formatearFechaHoraLima(venta.createdAt)}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Empleado
        </h2>
        <p className="font-semibold">
          {venta.empleado.nombres.toUpperCase()}{" "}
          {venta.empleado.apellidos.toUpperCase()}
        </p>
        <p className="text-muted-foreground text-sm">
          DNI {venta.empleado.dni} · {venta.empresaCompradora.nombre}
        </p>
      </div>

      <div className="border-t" />

      <div className="flex flex-col gap-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Venta
        </h2>
        <dl className="text-sm">
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
        className={`rounded-xl border p-4 text-sm ${anulada ? "text-muted-foreground line-through" : ""}`}
      >
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">Monto</span>
          <span>{formatearSoles(venta.montoBrutoCentimos)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">
            Descuento ({bpsAPorcentaje(venta.descuentoBps)}%)
          </span>
          <span>− {formatearSoles(venta.montoDescuentoCentimos)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t pt-2 font-semibold">
          <span>Total</span>
          <span>{formatearSoles(venta.montoFinalCentimos)}</span>
        </div>
      </div>

      <div className="border-t" />

      <div className="flex flex-col gap-3">
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
                    src={`/api/adjuntos/${a.id}`}
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
        <div className="flex flex-col gap-1">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Observación
          </h2>
          <p className="text-sm">{venta.observacion}</p>
        </div>
      ) : null}

      {anularAbierto ? (
        <Dialog open onOpenChange={(a) => !a && setAnularAbierto(false)}>
          <DialogoAnular
            ventaId={venta.id}
            onCerrar={() => setAnularAbierto(false)}
          />
        </Dialog>
      ) : null}
    </section>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between py-1">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
