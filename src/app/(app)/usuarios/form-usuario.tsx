"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Resultado } from "@/lib/tipos";
import { actualizarUsuario, crearUsuario } from "@/modules/usuarios/actions";
import type {
  EmpresaOpcion,
  EmpleadoOpcion,
  FilaUsuario,
  SedeOpcion,
} from "@/modules/usuarios/query";

const ROLES = ["SUPERADMIN", "ADMIN_EMPRESA", "VENDEDOR"] as const;
const ROLES_ADMIN = ["ADMIN_EMPRESA", "VENDEDOR"] as const;

type Estado =
  | Resultado<{ usuarioId?: string; passwordTemporal?: string }>
  | { ok: false; codigo: "VALIDACION"; mensaje: string; campo?: string };

const ESTADO_INICIAL: Estado = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

export function FormUsuario({
  usuario,
  empresas,
  empleados,
  sedes,
  esSuperadmin,
  esUnoMismo,
  onCerrar,
  onCreado,
}: {
  usuario?: FilaUsuario | null;
  empresas: EmpresaOpcion[];
  empleados: EmpleadoOpcion[];
  sedes: SedeOpcion[];
  esSuperadmin: boolean;
  esUnoMismo: boolean;
  onCerrar: () => void;
  onCreado: (username: string, passwordTemporal: string) => void;
}) {
  const esEdicion = Boolean(usuario);
  const router = useRouter();
  const roles = esSuperadmin ? ROLES : ROLES_ADMIN;

  const [estado, formAction, pendiente] = useActionState(
    async (estadoAnterior: Estado, formData: FormData): Promise<Estado> => {
      const res = esEdicion
        ? await actualizarUsuario(
            estadoAnterior as Resultado<Record<string, never>>,
            formData,
          )
        : await crearUsuario(
            estadoAnterior as Resultado<{
              usuarioId: string;
              passwordTemporal: string;
            }>,
            formData,
          );
      return res as Estado;
    },
    ESTADO_INICIAL,
  );

  const [rol, setRol] = useState<string>(usuario?.rol ?? "VENDEDOR");
  const [username, setUsername] = useState(usuario?.username ?? "");
  const [empresaId, setEmpresaId] = useState(
    usuario?.empresaId ?? empresas[0]?.id ?? "",
  );
  const [empleadoId, setEmpleadoId] = useState(usuario?.empleadoId ?? "");
  const [sedeId, setSedeId] = useState(usuario?.sedePorDefectoId ?? "");
  const [activo, setActivo] = useState(usuario?.activo ?? true);
  const formulario = useRef<HTMLFormElement>(null);

  const empleadosDeEmpresa = empleados.filter((e) => e.empresaId === empresaId);
  const sedesDeEmpresa = sedes.filter((s) => s.empresaId === empresaId);

  useEffect(() => {
    if (!estado.ok || !estado.data) {
      return;
    }
    if (!esEdicion) {
      onCreado(username, estado.data.passwordTemporal!);
      return;
    }
    toast.success("Usuario actualizado");
    router.refresh();
    onCerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;
  const esSuperadminRol = rol === "SUPERADMIN";

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {esEdicion ? "Editar usuario" : "Crear usuario"}
        </DialogTitle>
        <DialogDescription>
          {esEdicion
            ? `@${usuario!.username} · el username no se puede cambiar.`
            : "Se generará una contraseña temporal que se muestra una sola vez."}
        </DialogDescription>
      </DialogHeader>

      <form
        ref={formulario}
        action={formAction}
        className="flex flex-col gap-4"
      >
        {esEdicion ? (
          <input type="hidden" name="usuarioId" value={usuario!.id} />
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            required
            disabled={pendiente || esEdicion}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="jperez.sc"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombres">Nombres</Label>
            <Input
              id="nombres"
              name="nombres"
              required
              disabled={pendiente}
              defaultValue={usuario?.nombres ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="apellidos">Apellidos</Label>
            <Input
              id="apellidos"
              name="apellidos"
              required
              disabled={pendiente}
              defaultValue={usuario?.apellidos ?? ""}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="rol">Rol</Label>
          <select
            id="rol"
            name="rol"
            className="border-input bg-background text-foreground h-8 w-full rounded-md border px-2 text-sm"
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            disabled={pendiente || esUnoMismo}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {!esEdicion && esSuperadmin ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="empresaId">Empresa</Label>
            <select
              id="empresaId"
              name="empresaId"
              className="border-input bg-background text-foreground h-8 w-full rounded-md border px-2 text-sm"
              value={esSuperadminRol ? "" : empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              disabled={pendiente || esSuperadminRol}
            >
              <option value="">—</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombreComercial}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {!esSuperadminRol ? (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="empleadoId">Empleado (opcional)</Label>
              <select
                id="empleadoId"
                name="empleadoId"
                className="border-input bg-background text-foreground h-8 w-full rounded-md border px-2 text-sm"
                value={empleadoId}
                onChange={(e) => setEmpleadoId(e.target.value)}
                disabled={pendiente}
              >
                <option value="">Sin empleado</option>
                {empleadosDeEmpresa.map((em) => (
                  <option key={em.id} value={em.id}>
                    {em.apellidos}, {em.nombres} (
                    {em.tipoDocumento === "DNI" ? "DNI" : "CE"}{" "}
                    {em.numeroDocumento})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="sedePorDefectoId">
                Sede por defecto (opcional)
              </Label>
              <select
                id="sedePorDefectoId"
                name="sedePorDefectoId"
                className="border-input bg-background text-foreground h-8 w-full rounded-md border px-2 text-sm"
                value={sedeId}
                onChange={(e) => setSedeId(e.target.value)}
                disabled={pendiente}
              >
                <option value="">Sin sede</option>
                {sedesDeEmpresa.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {esEdicion ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <Label htmlFor="activo">Usuario activo</Label>
              <span className="text-muted-foreground text-sm">
                Al desactivarlo se revocan sus sesiones de inmediato.
              </span>
            </div>
            <Switch
              id="activo"
              checked={activo}
              onCheckedChange={(v) => setActivo(v)}
              disabled={pendiente || esUnoMismo}
            />
            <input type="hidden" name="activo" value={activo ? "on" : ""} />
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
              : esEdicion
                ? "Guardar cambios"
                : "Crear usuario"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
