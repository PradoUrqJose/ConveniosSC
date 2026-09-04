"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";

import {
  MobileSheet,
  MobileSheetAcciones,
  MobileSheetBoton,
  MobileSheetCuerpo,
  MobileSheetFilaOpcion,
  MobileSheetOpciones,
  MobileSheetPagina,
} from "@/components/ui/mobile-sheet";
import {
  contarFiltrosActivos,
  etiquetaDeValor,
  valoresNeutros,
  type GrupoFiltro,
  type ValoresFiltro,
} from "@/lib/capas-movil";
import { cn } from "@/lib/utils";

/**
 * Filtros móviles en un bottom sheet — issue #54 (PWA-MOB-04), doc §7.
 *
 * Sustituye a los `<select>` nativos sueltos de la barra de filtros, que en
 * móvil abrían la rueda del sistema —una capa más, con su propio cierre y
 * su propia geometría— por cada criterio. Acá hay una sola capa: cada
 * criterio es una fila con pill + chevron que empuja su subpágina dentro
 * del mismo sheet.
 *
 * Reglas del doc que el componente impone:
 * - **No filtra en vivo.** Se trabaja sobre un borrador y solo se aplica al
 *   confirmar; cerrar (arrastre, Escape, la X) descarta. Un sheet de
 *   selección no es un formulario: no hay nada escrito que perder, y el
 *   doc pide explícitamente que arrastrar descarte.
 * - **Filtros activos = un punto**, sin número: el sheet es la única
 *   fuente de verdad de qué está aplicado.
 */
export function FiltrosMovil({
  grupos,
  valores,
  alAplicar,
  className,
}: {
  grupos: GrupoFiltro[];
  /** Lo que está aplicado hoy (normalmente derivado de la URL). */
  valores: ValoresFiltro;
  alAplicar: (valores: ValoresFiltro) => void;
  className?: string;
}) {
  const [abierto, setAbierto] = React.useState(false);
  const [borrador, setBorrador] = React.useState<ValoresFiltro>(valores);
  const activos = contarFiltrosActivos(grupos, valores);
  const neutros = React.useMemo(() => valoresNeutros(grupos), [grupos]);

  function abrir() {
    // El borrador siempre parte de lo aplicado: lo que quedó a medias en la
    // apertura anterior se descartó al cerrar.
    setBorrador(valores);
    setAbierto(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label={
          activos > 0
            ? `Filtros (${activos} aplicado${activos === 1 ? "" : "s"})`
            : "Filtros"
        }
        className={cn(
          "border-input hover:bg-muted relative grid size-11 place-items-center rounded-lg border lg:hidden",
          className,
        )}
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {activos > 0 ? (
          <span className="mob-punto-filtros" aria-hidden="true" />
        ) : null}
      </button>

      <MobileSheet
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        altura="media"
        agarradera
      >
        <MobileSheetPagina
          id="raiz"
          titulo="Filtros"
          descripcion="Se aplican al confirmar."
        >
          <MobileSheetCuerpo>
            {grupos.map((grupo) => (
              <MobileSheetFilaOpcion
                key={grupo.id}
                etiqueta={grupo.etiqueta}
                valor={etiquetaDeValor(
                  grupo,
                  borrador[grupo.id] ?? neutros[grupo.id] ?? "",
                )}
                pagina={`grupo-${grupo.id}`}
              />
            ))}
          </MobileSheetCuerpo>
          <MobileSheetAcciones>
            <MobileSheetBoton
              variante="terciario"
              onClick={() => setBorrador(neutros)}
            >
              Limpiar todo
            </MobileSheetBoton>
            <MobileSheetBoton
              variante="primario"
              onClick={() => {
                alAplicar(borrador);
                setAbierto(false);
              }}
            >
              Aplicar filtros
            </MobileSheetBoton>
          </MobileSheetAcciones>
        </MobileSheetPagina>

        {grupos.map((grupo) => (
          <SubpaginaGrupo
            key={grupo.id}
            grupo={grupo}
            valor={borrador[grupo.id] ?? neutros[grupo.id] ?? ""}
            alElegir={(valor) =>
              setBorrador((actual) => ({ ...actual, [grupo.id]: valor }))
            }
          />
        ))}
      </MobileSheet>
    </>
  );
}

function SubpaginaGrupo({
  grupo,
  valor,
  alElegir,
}: {
  grupo: GrupoFiltro;
  valor: string;
  alElegir: (valor: string) => void;
}) {
  return (
    <MobileSheetPagina id={`grupo-${grupo.id}`} titulo={grupo.etiqueta}>
      <MobileSheetCuerpo>
        <MobileSheetOpciones
          etiqueta={grupo.etiqueta}
          opciones={grupo.opciones}
          valor={valor}
          alElegir={alElegir}
        />
      </MobileSheetCuerpo>
    </MobileSheetPagina>
  );
}
