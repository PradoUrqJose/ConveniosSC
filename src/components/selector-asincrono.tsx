"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

type Opcion = { id: string; etiqueta: string };

export function SelectorAsincrono({
  id,
  name,
  value,
  etiquetaInicial = "",
  buscar,
  onChange,
  disabled,
  placeholder,
}: {
  id: string;
  name: string;
  value: string;
  etiquetaInicial?: string;
  buscar: (q: string) => Promise<Opcion[]>;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const [consulta, setConsulta] = useState(etiquetaInicial);
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [consultado, setConsultado] = useState(false);
  const [activo, setActivo] = useState(-1);
  const contenedor = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    const timer = setTimeout(() => {
      setCargando(true);
      buscar(consulta)
        .then((resultados) => {
          if (vigente) setOpciones(resultados);
        })
        .catch(() => {
          if (vigente) setOpciones([]);
        })
        .finally(() => {
          if (vigente) {
            setCargando(false);
            setConsultado(true);
          }
        });
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(timer);
    };
  }, [abierto, buscar, consulta]);

  const seleccionar = (opcion: Opcion) => {
    onChange(opcion.id);
    setConsulta(opcion.etiqueta);
    setAbierto(false);
    setActivo(-1);
  };

  return (
    <div
      ref={contenedor}
      className="relative"
      onBlur={(evento) => {
        if (!contenedor.current?.contains(evento.relatedTarget)) {
          setAbierto(false);
        }
      }}
    >
      <input type="hidden" name={name} value={value} />
      <Input
        id={id}
        value={consulta}
        onChange={(e) => {
          setConsulta(e.target.value);
          onChange("");
          setConsultado(false);
          setActivo(-1);
        }}
        onFocus={() => {
          setConsultado(false);
          setActivo(-1);
          setAbierto(true);
        }}
        onKeyDown={(evento) => {
          if (
            evento.key === "ArrowDown" ||
            evento.key === "ArrowUp" ||
            evento.key === "Enter" ||
            evento.key === "Escape"
          ) {
            evento.stopPropagation();
          }

          if (evento.key === "Escape") {
            if (abierto) {
              evento.preventDefault();
              setAbierto(false);
            }
            return;
          }
          if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
            evento.preventDefault();
            setAbierto(true);
            if (opciones.length) {
              setActivo((indice) => {
                const siguiente =
                  evento.key === "ArrowDown" ? indice + 1 : indice - 1;
                return (siguiente + opciones.length) % opciones.length;
              });
            }
            return;
          }
          if (evento.key === "Enter" && abierto && activo >= 0) {
            evento.preventDefault();
            seleccionar(opciones[activo]!);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={abierto}
        aria-controls={listboxId}
        aria-activedescendant={
          activo >= 0 && activo < opciones.length
            ? `${listboxId}-option-${activo}`
            : undefined
        }
        aria-busy={cargando}
      />
      {abierto ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={placeholder}
          className="bg-popover absolute z-[var(--z-popover)] mt-1 max-h-52 w-full overflow-auto rounded-md border p-1 shadow-md"
        >
          {opciones.map((opcion, indice) => (
            <button
              key={opcion.id}
              type="button"
              id={`${listboxId}-option-${indice}`}
              role="option"
              aria-selected={activo === indice}
              className="hover:bg-accent w-full rounded px-2 py-1.5 text-left text-sm"
              onMouseDown={(e) => e.preventDefault()}
              onMouseMove={() => setActivo(indice)}
              onClick={() => seleccionar(opcion)}
            >
              {opcion.etiqueta}
            </button>
          ))}
          {!cargando && consultado && opciones.length === 0 ? (
            <p
              role="status"
              aria-live="polite"
              className="text-muted-foreground px-2 py-1.5 text-sm"
            >
              Sin resultados
            </p>
          ) : null}
          {cargando ? (
            <p
              role="status"
              aria-live="polite"
              className="text-muted-foreground px-2 py-1.5 text-sm"
            >
              Buscando…
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
