"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  >("DNI");

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

  useEffect(() => {
    if (!estado.ok || !estado.data) {
      return;
    }
    toast.success(esCrear ? "Empleado creado" : "Empleado actualizado");
    router.refresh();
    onCerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;
  const mostrarVerificar = !esCrear && empleado!.estado !== "ACTIVO";

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {esCrear ? "Nuevo empleado" : "Editar empleado"}
        </DialogTitle>
        <DialogDescription>
          {esCrear
            ? "Los empleados de otra empresa quedan pendientes de verificación por su administrador."
            : "El documento de identidad y la empresa no se pueden modificar."}
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="flex min-w-0 flex-col gap-4">
        {!esCrear ? (
          <input type="hidden" name="empleadoId" value={empleado!.id} />
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="empresa">Empresa</Label>
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
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="numeroDocumento">Documento de identidad</Label>
          {esCrear ? (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
              <input type="hidden" name="tipoDocumento" value={tipoDocumento} />
              <Select
                value={tipoDocumento}
                onValueChange={(valor) =>
                  setTipoDocumento(valor as "DNI" | "CARNET_EXTRANJERIA")
                }
                required
              >
                <SelectTrigger aria-label="Tipo de documento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DNI">DNI</SelectItem>
                  <SelectItem value="CARNET_EXTRANJERIA">
                    Carné de Extranjería
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input
                id="numeroDocumento"
                name="numeroDocumento"
                required
                autoComplete="off"
                disabled={pendiente}
                maxLength={12}
                placeholder="Número"
              />
            </div>
          ) : (
            <Input
              id="numeroDocumento"
              value={`${empleado!.tipoDocumento === "DNI" ? "DNI" : "CE"} ${empleado!.numeroDocumento}`}
              disabled
              readOnly
            />
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
              defaultValue={empleado?.nombres ?? ""}
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
              defaultValue={empleado?.apellidos ?? ""}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="telefono">Teléfono (opcional)</Label>
          <Input
            id="telefono"
            name="telefono"
            inputMode="tel"
            disabled={pendiente}
            defaultValue={empleado?.telefono ?? ""}
            placeholder="9xxxxxxxx"
          />
        </div>

        {esCrear ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <Checkbox id="consentimiento" name="consentimiento" required />
              <Label htmlFor="consentimiento" className="font-normal">
                Autorización de tratamiento de datos
              </Label>
            </div>
            <p className="text-muted-foreground max-h-28 overflow-y-auto text-xs">
              {TEXTO_CONSENTIMIENTO}
            </p>
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

        <DialogFooter className="mt-2">
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button type="submit" disabled={pendiente}>
            {pendiente
              ? "Guardando…"
              : esCrear
                ? "Crear empleado"
                : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
