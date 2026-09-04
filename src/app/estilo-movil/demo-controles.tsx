"use client";

import { useState } from "react";
import { Pencil, Share2, SlidersHorizontal } from "lucide-react";

import {
  BotonIconoMovil,
  BotonMovil,
  CampoMovil,
  DisparadorMenuMovil,
  EnlaceAccionMovil,
  SelectorMovil,
} from "@/components/ui/controles-movil";

/**
 * Muestra viva de los controles táctiles del issue #55 (PWA-MOB-05).
 *
 * Es el material de verificación: acá se miden los 44x44 con Playwright, se
 * recorre con teclado y se comparan claro/oscuro/reduced motion. Incluye a
 * propósito los cuatro estados que el issue exige que existan sin depender
 * de hover — pressed, focus-visible, disabled y pendiente — y el campo con
 * error, para poder comprobar que el mensaje llega por `aria-describedby` y
 * no solo por color.
 */
export function DemoControles() {
  const [pendiente, setPendiente] = useState(false);
  const [texto, setTexto] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <div className="mob-tarjeta">
        <div className="mob-tarjeta-encabezado">
          <p className="text-sm font-semibold">Botones y estados</p>
        </div>
        <div className="mob-bloque flex flex-col gap-2.5">
          <BotonMovil
            tono="primario"
            pendiente={pendiente}
            onClick={() => {
              setPendiente(true);
              window.setTimeout(() => setPendiente(false), 1200);
            }}
          >
            {pendiente ? "Guardando…" : "Guardar cambios"}
          </BotonMovil>
          <BotonMovil tono="secundario">Guardar borrador</BotonMovil>
          <BotonMovil tono="destructivo">Eliminar</BotonMovil>
          <BotonMovil tono="primario" disabled>
            Deshabilitado
          </BotonMovil>
          <BotonMovil tono="terciario" className="self-start">
            Terciario
          </BotonMovil>
        </div>
      </div>

      <div className="mob-tarjeta">
        <div className="mob-tarjeta-encabezado">
          <p className="text-sm font-semibold">
            Ícono, enlace y disparador de menú
          </p>
        </div>
        <div className="mob-bloque flex flex-wrap items-center gap-2.5">
          <BotonIconoMovil etiqueta="Editar registro">
            <Pencil className="size-4" />
          </BotonIconoMovil>
          <BotonIconoMovil etiqueta="Compartir" tono="plano">
            <Share2 className="size-4" />
          </BotonIconoMovil>
          <DisparadorMenuMovil etiqueta="Abrir filtros" abre="dialog">
            <SlidersHorizontal className="size-4" />
          </DisparadorMenuMovil>
          <EnlaceAccionMovil href="/estilo-movil" tono="acento">
            Ir al detalle
          </EnlaceAccionMovil>
          <EnlaceAccionMovil href="/estilo-movil" tono="plano">
            Ver todo
          </EnlaceAccionMovil>
        </div>
      </div>

      <div className="mob-tarjeta">
        <div className="mob-tarjeta-encabezado">
          <p className="text-sm font-semibold">Campos</p>
        </div>
        <div className="mob-bloque flex flex-col gap-4">
          <CampoMovil
            etiqueta="Teléfono"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="9XX XXX XXX"
            ayuda="El teclado numérico lo decide inputMode, no el tipo."
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
          />
          <CampoMovil
            etiqueta="Documento"
            inputMode="numeric"
            defaultValue="1234"
            error="El DNI tiene 8 dígitos."
          />
          <SelectorMovil etiqueta="Estado" defaultValue="activo">
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </SelectorMovil>
          <CampoMovil etiqueta="Campo deshabilitado" disabled value="" />
        </div>
      </div>
    </div>
  );
}
