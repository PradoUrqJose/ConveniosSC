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
  className,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  id?: string;
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
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "bg-background h-14 w-full justify-start gap-3 rounded-2xl px-4 font-normal",
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
