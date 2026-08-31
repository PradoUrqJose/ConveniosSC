"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogForm,
  DialogFooter,
  DialogHeader,
  DialogProgress,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  actualizarEmpleado,
  crearEmpleado,
  verificarEmpleado,
} from "@/modules/empleados/actions";
import type { FilaEmpleado, EmpresaOpcion } from "@/modules/empleados/query";
import type { Resultado } from "@/lib/tipos";

type Estado = Resultado<{ empleadoId?: string; estado?: string }>;

const ESTADO_INICIAL: Estado = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

const INICIO_ACCION = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
} as const;

const TEXTO_CONSENTIMIENTO =
  "Declaro que el titular de los datos ha sido informado y autoriza el registro de sus nombres, apellidos, documento de identidad y teléfono, con la finalidad exclusiva de administrar y controlar el beneficio de convenio institucional. Los datos se conservarán mientras dure el vínculo con la empresa y podrán ser consultados por los administradores de las empresas participantes.";

function CampoDocumentoEmpleado({
  tipo,
  value,
  onChange,
  disabled,
}: {
  tipo: "DNI" | "CARNET_EXTRANJERIA";
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const esDni = tipo === "DNI";
  const maxLength = esDni ? 8 : 12;

  const normalizar = (raw: string) =>
    raw
      .replace(esDni ? /\D/g : /[^A-Za-z0-9]/g, "")
      .slice(0, maxLength)
      .toUpperCase();

  if (!esDni) {
    return (
      <Input
        id="numeroDocumento"
        name="numeroDocumento"
        required
        autoComplete="off"
        disabled={disabled}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(normalizar(event.target.value))}
        className="font-mono tracking-[0.14em]"
        placeholder="AB123456"
      />
    );
  }

  const activeIndex = Math.min(value.length, maxLength - 1);

  return (
    <div className="relative">
      <div className="grid grid-cols-8 gap-2" aria-hidden="true">
        {Array.from({ length: maxLength }).map((_, index) => {
          const character = value[index];
          const active = focused && index === activeIndex;
          return (
            <span
              key={index}
              className={cn(
                "flex h-[3.375rem] items-center justify-center rounded-2xl bg-[var(--modal-field)] font-mono text-lg font-medium transition-[background-color,box-shadow] duration-[var(--duration-fast)]",
                character &&
                  "bg-popover shadow-[inset_0_0_0_2px_var(--border)]",
                active && "bg-popover shadow-[inset_0_0_0_2px_var(--primary)]",
              )}
            >
              {character ??
                (active ? (
                  <span className="dialog-caret text-primary">|</span>
                ) : null)}
            </span>
          );
        })}
      </div>
      <input
        id="numeroDocumento"
        name="numeroDocumento"
        value={value}
        onChange={(event) => onChange(normalizar(event.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="off"
        required
        disabled={disabled}
        maxLength={maxLength}
        aria-label="Número de DNI"
        className="absolute inset-0 size-full cursor-text opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  );
}

export function FormEmpleado({
  empleado,
  empresas,
  miEmpresaId,
  onCerrar,
}: {
  empleado?: FilaEmpleado | null;
  empresas: EmpresaOpcion[];
  miEmpresaId: string | null;
  onCerrar: () => void;
}) {
  const esCrear = !empleado;
  const router = useRouter();
  const [verificarAlGuardar, setVerificarAlGuardar] = useState(
    empleado?.estado === "PENDIENTE_VERIFICACION" ||
      empleado?.estado === "RECHAZADO",
  );
  const [activo, setActivo] = useState(true);
  const [empresaId, setEmpresaId] = useState(miEmpresaId ?? "");
  const [tipoDocumento, setTipoDocumento] = useState<
    "DNI" | "CARNET_EXTRANJERIA"
  >(empleado?.tipoDocumento ?? "DNI");
  const [numeroDocumento, setNumeroDocumento] = useState(
    empleado?.numeroDocumento ?? "",
  );
  const [nombres, setNombres] = useState(empleado?.nombres ?? "");
  const [apellidos, setApellidos] = useState(empleado?.apellidos ?? "");
  const [telefono, setTelefono] = useState(empleado?.telefono ?? "");
  const [consentimiento, setConsentimiento] = useState(false);
  const [mostrarConsentimiento, setMostrarConsentimiento] = useState(false);

  const [estado, formAction, pendiente] = useActionState(
    async (estadoAnterior: Estado, formData: FormData): Promise<Estado> => {
      if (esCrear) {
        return crearEmpleado(INICIO_ACCION, formData);
      }
      const res = await actualizarEmpleado(INICIO_ACCION, formData);
      if (res.ok && verificarAlGuardar) {
        const verificacion = await verificarEmpleado(
          { ok: false, codigo: "VALIDACION", mensaje: "" },
          formData,
        );
        if (!verificacion.ok) {
          return verificacion;
        }
      }
      return res;
    },
    ESTADO_INICIAL,
  );
  const guardado = estado.ok && Boolean(estado.data);

  useEffect(() => {
    if (!estado.ok || !estado.data) {
      return;
    }
    const timeout = window.setTimeout(() => {
      toast.success(esCrear ? "Empleado creado" : "Empleado actualizado");
      router.refresh();
      onCerrar();
    }, 700);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;
  const mostrarVerificar = !esCrear && empleado!.estado !== "ACTIVO";
  const empresaExterna =
    esCrear && Boolean(miEmpresaId) && empresaId !== miEmpresaId;
  const requisitos = [
    tipoDocumento === "DNI"
      ? numeroDocumento.length === 8
      : numeroDocumento.length >= 6,
    nombres.trim().length > 1,
    apellidos.trim().length > 1,
    consentimiento,
  ];
  const completos = requisitos.filter(Boolean).length;
  const formularioCrearValido = completos === requisitos.length;

  return (
    <DialogContent pending={pendiente || guardado} className="sm:max-w-lg">
      <DialogHeader
        eyebrow={esCrear ? "Afiliación al convenio" : "Gestión de empleados"}
      >
        <DialogTitle>
          {esCrear ? "Nuevo empleado" : "Editar empleado"}
        </DialogTitle>
        <DialogDescription>
          {esCrear
            ? "Queda habilitado para comprar con descuento apenas lo registres."
            : "El documento de identidad y la empresa no se pueden modificar."}
        </DialogDescription>
      </DialogHeader>

      <DialogForm action={formAction}>
        {!esCrear ? (
          <input type="hidden" name="empleadoId" value={empleado!.id} />
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="empresa">Empresa del convenio</Label>
          {esCrear ? (
            <Select
              value={empresaId}
              onValueChange={(valor) => setEmpresaId(valor ?? "")}
              required
            >
              <input type="hidden" name="empresaId" value={empresaId} />
              <SelectTrigger id="empresa">
                <SelectValue placeholder="Selecciona la empresa">
                  {(valor) =>
                    empresas.find((empresa) => empresa.id === valor)
                      ?.nombreComercial ?? "Selecciona la empresa"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nombreComercial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="empresa"
              value={empleado!.empresaNombre}
              disabled
              readOnly
            />
          )}
          {empresaExterna ? (
            <div className="dialog-note bg-warning/15 mt-3 flex gap-3 rounded-2xl px-4 py-3 text-sm leading-5">
              <ShieldCheck className="text-warning mt-0.5 size-4 shrink-0" />
              <span>
                El administrador de esta empresa debe verificarlo antes de que
                pueda usar el beneficio.
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2.5">
          {esCrear ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Label htmlFor="numeroDocumento">Documento de identidad</Label>
                <div
                  className="relative grid w-full grid-cols-2 rounded-[0.875rem] bg-[var(--modal-field)] p-[3px] sm:w-auto"
                  role="radiogroup"
                  aria-label="Tipo de documento"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "bg-popover absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-xl shadow-[0_1px_3px_rgb(15_23_42_/_0.12)] transition-transform duration-[220ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none",
                      tipoDocumento === "CARNET_EXTRANJERIA" &&
                        "translate-x-full",
                    )}
                  />
                  {(
                    [
                      ["DNI", "DNI"],
                      ["CARNET_EXTRANJERIA", "Carné ext."],
                    ] as const
                  ).map(([value, label]) => {
                    const selected = tipoDocumento === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setTipoDocumento(value);
                          setNumeroDocumento("");
                        }}
                        className={cn(
                          "text-muted-foreground hover:text-foreground relative z-[1] min-w-28 rounded-xl px-3.5 py-2 text-[0.8125rem] font-semibold transition-colors duration-[var(--duration-fast)]",
                          selected && "text-primary",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <input type="hidden" name="tipoDocumento" value={tipoDocumento} />
              <div key={tipoDocumento} className="dialog-segment-content">
                <CampoDocumentoEmpleado
                  tipo={tipoDocumento}
                  value={numeroDocumento}
                  onChange={setNumeroDocumento}
                  disabled={pendiente}
                />
                <p className="text-muted-foreground mt-2 text-xs">
                  {tipoDocumento === "DNI"
                    ? `${numeroDocumento.length} de 8 dígitos`
                    : "Hasta 12 caracteres, sin espacios"}
                </p>
              </div>
            </>
          ) : (
            <>
              <Label htmlFor="numeroDocumento">Documento de identidad</Label>
              <Input
                id="numeroDocumento"
                value={`${empleado!.tipoDocumento === "DNI" ? "DNI" : "CE"} ${empleado!.numeroDocumento}`}
                disabled
                readOnly
                className="font-mono"
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombres">Nombres</Label>
            <Input
              id="nombres"
              name="nombres"
              required
              autoCapitalize="words"
              disabled={pendiente}
              value={nombres}
              onChange={(event) => setNombres(event.target.value)}
              placeholder="Lucía"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="apellidos">Apellidos</Label>
            <Input
              id="apellidos"
              name="apellidos"
              required
              autoCapitalize="words"
              disabled={pendiente}
              value={apellidos}
              onChange={(event) => setApellidos(event.target.value)}
              placeholder="Pérez Salazar"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <Label htmlFor="telefono">Teléfono</Label>
            <span className="text-muted-foreground text-xs">opcional</span>
          </div>
          <Input
            id="telefono"
            name="telefono"
            inputMode="tel"
            disabled={pendiente}
            value={telefono}
            onChange={(event) =>
              setTelefono(event.target.value.replace(/\D/g, "").slice(0, 9))
            }
            placeholder="9XX XXX XXX"
            className="font-mono tracking-[0.1em]"
          />
          <p className="text-muted-foreground text-xs">
            Le avisamos por WhatsApp cuando su beneficio esté activo.
          </p>
        </div>

        {esCrear ? (
          <div
            className={cn(
              "rounded-[1.25rem] bg-[var(--modal-field)] px-[1.125rem] py-4 transition-colors duration-[var(--duration-base)]",
              consentimiento && "bg-primary/10",
            )}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                id="consentimiento"
                name="consentimiento"
                required
                checked={consentimiento}
                onCheckedChange={setConsentimiento}
                className="mt-0.5 size-[1.375rem] rounded-[0.4375rem]"
              />
              <span className="text-sm leading-5.5 font-medium">
                El titular autoriza el registro de sus datos para administrar el
                beneficio.
              </span>
            </label>
            <div className="pt-2 pl-[2.125rem]">
              <button
                type="button"
                className="text-primary text-[0.8125rem] font-semibold hover:underline"
                aria-expanded={mostrarConsentimiento}
                onClick={() => setMostrarConsentimiento((value) => !value)}
              >
                {mostrarConsentimiento
                  ? "Ocultar el detalle"
                  : "Leer el detalle"}
              </button>
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-standard)] motion-reduce:transition-none",
                  mostrarConsentimiento
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="overflow-hidden">
                  <p className="text-muted-foreground pt-2 text-[0.8125rem] leading-5.5">
                    {TEXTO_CONSENTIMIENTO}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {mostrarVerificar ? (
          <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
            <div className="flex flex-col">
              <Label htmlFor="verificarAlGuardar">Verificar al guardar</Label>
              <span className="text-muted-foreground text-sm">
                Pasa el empleado a ACTIVO en este mismo paso.
              </span>
            </div>
            <Switch
              id="verificarAlGuardar"
              checked={verificarAlGuardar}
              onCheckedChange={setVerificarAlGuardar}
            />
          </div>
        ) : null}

        {!esCrear && empleado!.estado === "ACTIVO" ? (
          <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
            <div className="flex flex-col">
              <Label htmlFor="estadoActivo">Empleado activo</Label>
              <span className="text-muted-foreground text-sm">
                Desactívalo si ya no pertenece a la empresa.
              </span>
            </div>
            <Switch
              id="estadoActivo"
              checked={activo}
              onCheckedChange={setActivo}
              disabled={pendiente}
            />
            <input
              type="hidden"
              name="estado"
              value={activo ? "" : "INACTIVO"}
            />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <DialogFooter className={cn("mt-2", esCrear && "sm:justify-between")}>
          {esCrear ? (
            <DialogProgress current={completos} total={requisitos.length} />
          ) : null}
          <div className="flex items-center justify-end gap-2.5">
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button
              type="submit"
              disabled={
                pendiente || guardado || (esCrear && !formularioCrearValido)
              }
              data-state={guardado ? "done" : undefined}
            >
              {pendiente ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" />
              ) : null}
              {guardado ? <Check /> : null}
              {guardado
                ? esCrear
                  ? "Creado"
                  : "Guardado"
                : pendiente
                  ? esCrear
                    ? "Creando…"
                    : "Guardando…"
                  : esCrear
                    ? "Crear empleado"
                    : "Guardar cambios"}
            </Button>
          </div>
        </DialogFooter>
      </DialogForm>
    </DialogContent>
  );
}
