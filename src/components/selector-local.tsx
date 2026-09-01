"use client";

import { useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

export type OpcionLocal = { id: string; etiqueta: string };

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

export function SelectorLocal({
  id,
  name,
  value,
  opciones,
  etiquetaInicial = "",
  onChange,
  disabled,
  placeholder,
  className,
}: {
  id: string;
  name: string;
  value: string;
  opciones: OpcionLocal[];
  etiquetaInicial?: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder: string;
  className?: string;
}) {
  const [consulta, setConsulta] = useState(etiquetaInicial);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const contenedor = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const consultaNormalizada = normalizar(consulta.trim());
  const resultados = opciones.filter((opcion) =>
    normalizar(opcion.etiqueta).includes(consultaNormalizada),
  );

  const seleccionar = (opcion: OpcionLocal) => {
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
        onChange={(evento) => {
          setConsulta(evento.target.value);
          onChange("");
          setActivo(-1);
          setAbierto(true);
        }}
        onFocus={() => {
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
            if (resultados.length) {
              setActivo((indice) => {
                const siguiente =
                  evento.key === "ArrowDown" ? indice + 1 : indice - 1;
                return (siguiente + resultados.length) % resultados.length;
              });
            }
            return;
          }
          if (evento.key === "Enter" && abierto && activo >= 0) {
            evento.preventDefault();
            seleccionar(resultados[activo]!);
          }
        }}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={abierto}
        aria-controls={listboxId}
        aria-activedescendant={
          activo >= 0 && activo < resultados.length
            ? `${listboxId}-option-${activo}`
            : undefined
        }
      />
      {abierto ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={placeholder}
          className="bg-popover absolute z-[var(--z-popover)] mt-1 max-h-52 w-full overflow-auto rounded-md border p-1 shadow-md"
        >
          {resultados.map((opcion, indice) => (
            <button
              key={opcion.id}
              type="button"
              id={`${listboxId}-option-${indice}`}
              role="option"
              aria-selected={activo === indice}
              className="hover:bg-accent w-full rounded px-2 py-1.5 text-left text-sm"
              onMouseDown={(evento) => evento.preventDefault()}
              onMouseMove={() => setActivo(indice)}
              onClick={() => seleccionar(opcion)}
            >
              {opcion.etiqueta}
            </button>
          ))}
          {resultados.length === 0 ? (
            <p
              role="status"
              aria-live="polite"
              className="text-muted-foreground px-2 py-1.5 text-sm"
            >
              Sin resultados
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
