"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
import { CampoArchivo } from "./campo-archivo";

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
  "Declaro que el titular de los datos ha sido informado y autoriza el registro de sus nombres, apellidos, documento de identidad, teléfono, la imagen de su documento de identidad y, cuando corresponda, su fotografía, con la finalidad exclusiva de administrar y controlar el beneficio de convenio institucional. Los datos se conservarán mientras dure el vínculo con la empresa y podrán ser consultados por los administradores de las empresas participantes.";

export function FormEmpleado({
  empleado,
  empresas,
  miEmpresaId,
  onCerrar,
  dniInicial,
  empresaBloqueada,
  onExito,
}: {
  empleado?: FilaEmpleado | null;
  empresas: EmpresaOpcion[];
  miEmpresaId: string | null;
  onCerrar: () => void;
  /** DNI ya buscado desde el formulario de venta: bloqueado, no editable. */
  dniInicial?: string;
  /** Empresa fijada desde el formulario de venta (la del convenio elegido). */
  empresaBloqueada?: { id: string; nombre: string };
  /** Si se pasa, se llama al crear con éxito en vez de solo cerrar el modal. */
  onExito?: (resultado: {
    empleadoId: string;
    estado: string;
    nombres: string;
    apellidos: string;
    empresaId: string;
  }) => void;
}) {
  const esCrear = !empleado;
  const router = useRouter();
  const [verificarAlGuardar, setVerificarAlGuardar] = useState(
    empleado?.estado === "PENDIENTE_VERIFICACION" ||
      empleado?.estado === "RECHAZADO",
  );
  const [activo, setActivo] = useState(true);
  const [empresaId, setEmpresaId] = useState(miEmpresaId ?? "");
  const ultimosDatosRef = useRef<{ nombres: string; apellidos: string }>({
    nombres: "",
    apellidos: "",
  });

  const [estado, formAction, pendiente] = useActionState(
    async (estadoAnterior: Estado, formData: FormData): Promise<Estado> => {
      if (esCrear) {
        ultimosDatosRef.current = {
          nombres: String(formData.get("nombres") ?? ""),
          apellidos: String(formData.get("apellidos") ?? ""),
        };
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
    if (esCrear && onExito && estado.data.empleadoId && estado.data.estado) {
      onExito({
        empleadoId: estado.data.empleadoId,
        estado: estado.data.estado,
        nombres: ultimosDatosRef.current.nombres,
        apellidos: ultimosDatosRef.current.apellidos,
        empresaId,
      });
    }
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
            : "El DNI y la empresa no se pueden modificar."}
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="flex flex-col gap-4">
        {!esCrear ? (
          <input type="hidden" name="empleadoId" value={empleado!.id} />
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="empresa">Empresa</Label>
          {empresaBloqueada ? (
            <>
              <Input
                id="empresa"
                value={empresaBloqueada.nombre}
                disabled
                readOnly
              />
              <input
                type="hidden"
                name="empresaId"
                value={empresaBloqueada.id}
              />
            </>
          ) : esCrear ? (
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
          <Label htmlFor="dni">DNI</Label>
          {esCrear ? (
            dniInicial ? (
              <Input
                id="dni"
                name="dni"
                value={dniInicial}
                readOnly
                className="bg-muted"
              />
            ) : (
              <Input
                id="dni"
                name="dni"
                required
                inputMode="numeric"
                autoComplete="off"
                disabled={pendiente}
                maxLength={8}
                placeholder="8 dígitos"
              />
            )
          ) : (
            <Input id="dni" value={empleado!.dni} disabled readOnly />
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
            <Label>Foto del DNI *</Label>
            <CampoArchivo prefijo="fotoDni" etiqueta="foto" tipo="dni" />
          </div>
        ) : null}

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
