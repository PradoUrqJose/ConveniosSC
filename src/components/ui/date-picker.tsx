"use client";

import { es } from "date-fns/locale";
import { CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatearFechaUI } from "@/lib/fechas";

function aFecha(valor: string): Date {
  const [anio, mes, dia] = valor.split("-").map(Number);
  return new Date(anio ?? 0, (mes ?? 1) - 1, dia ?? 1);
}

function aValor(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export function DatePicker({
  name,
  value,
  onChange,
  min,
  max,
  id,
  etiqueta = "Fecha",
  className,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  id?: string;
  /** Nombre accesible del selector nativo móvil (el `<label>` de la
   *  pantalla apunta al input oculto que envía el valor). */
  etiqueta?: string;
  /** Permite a cada pantalla ajustar alto y forma del disparador. */
  className?: string;
}) {
  const seleccionada = aFecha(value);
  const deshabilitadas =
    min && max
      ? { before: aFecha(min), after: aFecha(max) }
      : min
        ? { before: aFecha(min) }
        : max
          ? { after: aFecha(max) }
          : undefined;

  return (
    <Popover>
      <input type="hidden" id={id} name={name} value={value} />
      {/* Por debajo de 1024px, el calendario nativo — issue #55.

          La rejilla de react-day-picker es el único control de la app al
          que no se le puede dar 44x44 por geometría: siete columnas por 44
          son 308px y a 320px de ancho, con el padding del popover, no
          entran. Antes de encoger la celda "solo un poco" conviene mirar
          qué se gana con el calendario propio en un teléfono, y la
          respuesta es nada: el selector nativo abre la rueda del sistema,
          respeta `min`/`max`, ya es accesible, no se sale de la pantalla y
          es el gesto que el usuario tiene aprendido de todas las demás
          apps. El `<input type="date">` no lleva `name`: quien envía sigue
          siendo el input oculto de arriba, así que el formulario no cambia.

          El corte es por CSS y no por `useEsMovil()` a propósito: así el
          HTML del servidor ya trae los dos y no hay un frame con el
          control equivocado ni un salto al rotar el dispositivo. */}
      <input
        type="date"
        aria-label={etiqueta}
        value={value}
        min={min}
        max={max}
        onChange={(evento) => {
          if (evento.target.value) onChange(evento.target.value);
        }}
        className={cn(
          "border-input bg-background text-foreground flex h-14 w-full items-center rounded-2xl border px-4 text-base lg:hidden",
          className,
        )}
      />
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "bg-background hidden h-14 w-full justify-start gap-3 rounded-2xl px-4 font-normal lg:inline-flex",
              className,
            )}
          />
        }
      >
        <CalendarDays className="text-primary size-4" />
        <span>{formatearFechaUI(value)}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-2xl p-1.5">
        <Calendar
          mode="single"
          selected={seleccionada}
          onSelect={(fecha) => fecha && onChange(aValor(fecha))}
          disabled={deshabilitadas}
          locale={es}
          className="p-2"
        />
      </PopoverContent>
    </Popover>
  );
}
