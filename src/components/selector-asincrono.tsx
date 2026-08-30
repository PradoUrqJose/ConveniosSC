"use client";

import { useEffect, useRef, useState } from "react";

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
  const contenedor = useRef<HTMLDivElement>(null);

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
          if (vigente) setCargando(false);
        });
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(timer);
    };
  }, [abierto, buscar, consulta]);

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
        }}
        onFocus={() => setAbierto(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {abierto ? (
        <div className="bg-popover absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border p-1 shadow-md">
          {opciones.map((opcion) => (
            <button
              key={opcion.id}
              type="button"
              className="hover:bg-accent w-full rounded px-2 py-1.5 text-left text-sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opcion.id);
                setConsulta(opcion.etiqueta);
                setAbierto(false);
              }}
            >
              {opcion.etiqueta}
            </button>
          ))}
          {!cargando && opciones.length === 0 ? (
            <p className="text-muted-foreground px-2 py-1.5 text-sm">
              Sin resultados
            </p>
          ) : null}
          {cargando ? (
            <p className="text-muted-foreground px-2 py-1.5 text-sm">
              Buscando…
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
