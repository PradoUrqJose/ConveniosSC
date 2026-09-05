"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Handshake } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SelectorLocal } from "@/components/selector-local";
import {
  CapaCerrar,
  CapaContenido,
  CapaDescripcion,
  CapaEncabezado,
  CapaFormulario,
  CapaPie,
  CapaTitulo,
} from "@/components/ui/capa";
import { useDialogFormError } from "@/components/ui/use-dialog-form-error";
import { hoyLima } from "@/lib/fechas";
import type { Resultado } from "@/lib/tipos";
import { crearConvenio } from "@/modules/convenios/actions";
import type { EmpresaParaConvenio } from "@/modules/convenios/query";

type Estado = Resultado<{ convenioId?: string }>;

const ESTADO_INICIAL: Estado = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

export function FormConvenio({
  empresas,
  onCerrar,
}: {
  empresas: EmpresaParaConvenio[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [estado, formAction, pendiente] = useActionState(
    async (estadoAnterior: Estado, formData: FormData): Promise<Estado> => {
      const res = await crearConvenio(
        estadoAnterior as Resultado<{ convenioId: string }>,
        formData,
      );
      return res as Estado;
    },
    ESTADO_INICIAL,
  );

  const [empresaX, setEmpresaX] = useState("");
  const [empresaY, setEmpresaY] = useState("");
  const [descuentoX, setDescuentoX] = useState("");
  const [descuentoY, setDescuentoY] = useState("");
  const [vigenciaHasta, setVigenciaHasta] = useState("");
  const [activar, setActivar] = useState(true);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!estado.ok || !estado.data) {
      return;
    }
    toast.success("Convenio creado");
    router.refresh();
    onCerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;
  useDialogFormError(estado, formulario, "error-form-convenio");

  return (
    <CapaContenido pendiente={pendiente} className="sm:max-w-lg">
      <CapaEncabezado icono={<Handshake />} eyebrow="Gestión de convenios">
        <CapaTitulo>Crear convenio</CapaTitulo>
        <CapaDescripcion>
          Un convenio une dos empresas con descuentos direccionales.
        </CapaDescripcion>
      </CapaEncabezado>

      <CapaFormulario
        ref={formulario}
        action={formAction}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="empresaX">Empresa X</Label>
            <SelectorLocal
              id="empresaX"
              name="empresaXId"
              value={empresaX}
              opciones={empresas.map((empresa) => ({
                id: empresa.id,
                etiqueta: empresa.nombreComercial,
              }))}
              onChange={setEmpresaX}
              disabled={pendiente}
              placeholder="Buscar empresa"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="empresaY">Empresa Y</Label>
            <SelectorLocal
              id="empresaY"
              name="empresaYId"
              value={empresaY}
              opciones={empresas.map((empresa) => ({
                id: empresa.id,
                etiqueta: empresa.nombreComercial,
              }))}
              onChange={setEmpresaY}
              disabled={pendiente}
              placeholder="Buscar empresa"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="vigenciaDesde">Vigencia desde</Label>
          <Input
            id="vigenciaDesde"
            name="vigenciaDesde"
            type="date"
            required
            disabled={pendiente}
            defaultValue={hoyLima()}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="vigenciaHasta">Vigencia hasta (opcional)</Label>
          <Input
            id="vigenciaHasta"
            name="vigenciaHasta"
            type="date"
            disabled={pendiente}
            value={vigenciaHasta}
            onChange={(e) => setVigenciaHasta(e.target.value)}
          />
          {vigenciaHasta ? (
            <input type="hidden" name="vigenciaHasta" value={vigenciaHasta} />
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="descuentoXotorga">
            Empresa X → empleados de empresa Y
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="descuentoXotorga"
              name="descuentoXotorga"
              inputMode="decimal"
              placeholder="15"
              disabled={pendiente}
              value={descuentoX}
              onChange={(e) => setDescuentoX(e.target.value)}
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="descuentoYotorga">
            Empresa Y → empleados de empresa X
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="descuentoYotorga"
              name="descuentoYotorga"
              inputMode="decimal"
              placeholder="10"
              disabled={pendiente}
              value={descuentoY}
              onChange={(e) => setDescuentoY(e.target.value)}
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="notas">Notas (opcional)</Label>
          <textarea
            id="notas"
            name="notas"
            rows={2}
            maxLength={1000}
            disabled={pendiente}
            className="border-input bg-background text-foreground rounded-md border px-2 py-1.5 text-sm"
            placeholder="Observaciones del convenio"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <Label htmlFor="activarInmediatamente">
              Activar inmediatamente
            </Label>
            <span className="text-muted-foreground text-sm">
              Si está apagado, nace como borrador.
            </span>
          </div>
          <Switch
            id="activarInmediatamente"
            checked={activar}
            onCheckedChange={(v) => setActivar(v)}
            disabled={pendiente}
          />
          <input
            type="hidden"
            name="activarInmediatamente"
            value={activar ? "on" : ""}
          />
        </div>

        {error ? (
          <p
            id="error-form-convenio"
            role="alert"
            className="text-destructive text-sm"
          >
            {error}
            {estado.ok === false && estado.enlace ? (
              <>
                {" "}
                <a
                  href={estado.enlace}
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(estado.enlace!);
                  }}
                  className="underline"
                >
                  Ver convenio existente
                </a>
              </>
            ) : null}
          </p>
        ) : null}

        <CapaPie className="mt-2">
          <CapaCerrar>Cancelar</CapaCerrar>
          <Button type="submit" disabled={pendiente || !empresaX || !empresaY}>
            {pendiente ? "Creando…" : "Crear convenio"}
          </Button>
        </CapaPie>
      </CapaFormulario>
    </CapaContenido>
  );
}
