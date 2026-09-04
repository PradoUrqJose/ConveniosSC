"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import {
  MobileSheet,
  MobileSheetAcciones,
  MobileSheetBoton,
  MobileSheetCuerpo,
  MobileSheetError,
  MobileSheetFilaAccion,
  MobileSheetFormulario,
  MobileSheetPagina,
  type AlturaSheet,
} from "@/components/ui/mobile-sheet";
import { FiltrosMovil } from "@/components/ui/filtros-movil";
import type { GrupoFiltro, ValoresFiltro } from "@/lib/capas-movil";

const GRUPOS: GrupoFiltro[] = [
  {
    id: "estado",
    etiqueta: "Estado",
    opciones: [
      { valor: "", etiqueta: "Todos los estados" },
      { valor: "activos", etiqueta: "Activos" },
      { valor: "pendientes", etiqueta: "Pendientes" },
    ],
  },
  {
    id: "orden",
    etiqueta: "Orden",
    opciones: [
      { valor: "nombre_asc", etiqueta: "Nombre A–Z" },
      { valor: "reciente", etiqueta: "Más recientes" },
    ],
  },
];

/**
 * Referencia viva del bottom sheet — issue #54 (PWA-MOB-04).
 *
 * Igual que el resto de `/estilo-movil`: no es producto, es el material de
 * verificación. Cubre las tres alturas, la pila multipágina, la protección
 * de cierre con formulario modificado y la variante destructiva.
 */
export function DemoSheets() {
  const [altura, setAltura] = useState<AlturaSheet | null>(null);
  const [formulario, setFormulario] = useState(false);
  const [destructivo, setDestructivo] = useState(false);
  const [filtros, setFiltros] = useState<ValoresFiltro>({
    estado: "",
    orden: "nombre_asc",
  });

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(["compacta", "media", "casi-completa"] as AlturaSheet[]).map(
          (valor) => (
            <button
              key={valor}
              type="button"
              className="mob-boton-terciario"
              onClick={() => setAltura(valor)}
            >
              Altura {valor}
            </button>
          ),
        )}
        <button
          type="button"
          className="mob-boton-terciario"
          onClick={() => setFormulario(true)}
        >
          Formulario protegido
        </button>
        <button
          type="button"
          className="mob-boton-terciario"
          onClick={() => setDestructivo(true)}
        >
          Variante destructiva
        </button>
        <FiltrosMovil
          grupos={GRUPOS}
          valores={filtros}
          alAplicar={setFiltros}
        />
      </div>

      {/* Tres alturas + pila multipágina. */}
      <MobileSheet
        abierto={altura !== null}
        alCerrar={() => setAltura(null)}
        altura={altura ?? "media"}
        agarradera
      >
        <MobileSheetPagina
          id="raiz"
          titulo={`Altura ${altura ?? ""}`}
          descripcion="La X pasa a flecha atrás mientras haya pila."
        >
          <MobileSheetCuerpo>
            <MobileSheetFilaAccion
              etiqueta="Abrir una subpágina"
              pagina="detalle"
            />
            <MobileSheetFilaAccion etiqueta="Una acción cualquiera" />
          </MobileSheetCuerpo>
          <MobileSheetAcciones>
            <MobileSheetBoton onClick={() => setAltura(null)}>
              Entendido
            </MobileSheetBoton>
          </MobileSheetAcciones>
        </MobileSheetPagina>
        <MobileSheetPagina id="detalle" titulo="Subpágina">
          <MobileSheetCuerpo>
            <p className="text-sm opacity-70">
              La subpágina vive dentro de la misma capa: no se apila un modal
              sobre otro y el botón de abajo no se mueve.
            </p>
          </MobileSheetCuerpo>
          <MobileSheetAcciones>
            <MobileSheetBoton onClick={() => setAltura(null)}>
              Entendido
            </MobileSheetBoton>
          </MobileSheetAcciones>
        </MobileSheetPagina>
      </MobileSheet>

      {/* Formulario: Escape, la X y el arrastre piden confirmación dentro
          de la misma capa; tocar fuera no hace nada. */}
      <MobileSheet
        abierto={formulario}
        alCerrar={() => setFormulario(false)}
        altura="casi-completa"
      >
        <MobileSheetPagina
          id="raiz"
          titulo="Formulario protegido"
          descripcion="Escribe algo y prueba a cerrar."
        >
          <MobileSheetFormulario
            onSubmit={(evento) => {
              evento.preventDefault();
              setFormulario(false);
            }}
          >
            <MobileSheetCuerpo className="flex flex-col gap-3">
              <label className="flex flex-col gap-2 text-sm font-semibold">
                Nombre
                <input
                  name="nombre"
                  className="mob-bloque m-0 h-14 px-4 text-base"
                  placeholder="Escribe para ensuciar el formulario"
                />
              </label>
              <MobileSheetError>
                Así se ve un error del servidor sin salir de la capa.
              </MobileSheetError>
            </MobileSheetCuerpo>
            <MobileSheetAcciones>
              <MobileSheetBoton type="submit">Guardar</MobileSheetBoton>
            </MobileSheetAcciones>
          </MobileSheetFormulario>
        </MobileSheetPagina>
      </MobileSheet>

      {/* Variante destructiva: decisión centrada, destructivo arriba. */}
      <MobileSheet
        abierto={destructivo}
        alCerrar={() => setDestructivo(false)}
        altura="compacta"
        rol="alertdialog"
      >
        <MobileSheetPagina
          id="raiz"
          titulo="Anular la venta"
          descripcion="V-000123 · S/ 120.00"
        >
          <MobileSheetCuerpo>
            <p className="mob-sheet-consecuencia">
              <Trash2 className="mr-2 inline size-4" aria-hidden="true" />
              La venta deja de contar para el consumo del empleado.
            </p>
          </MobileSheetCuerpo>
          <MobileSheetAcciones>
            <MobileSheetBoton
              variante="secundario"
              onClick={() => setDestructivo(false)}
            >
              Cancelar
            </MobileSheetBoton>
            <MobileSheetBoton
              variante="destructivo"
              onClick={() => setDestructivo(false)}
            >
              Anular venta
            </MobileSheetBoton>
          </MobileSheetAcciones>
        </MobileSheetPagina>
      </MobileSheet>
    </>
  );
}
