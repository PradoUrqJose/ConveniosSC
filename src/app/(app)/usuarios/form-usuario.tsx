"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserCog, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SelectorAsincrono } from "@/components/selector-asincrono";
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
import type { Resultado } from "@/lib/tipos";
import {
  actualizarUsuario,
  buscarEmpleadosOpciones,
  buscarSedesOpciones,
  crearUsuario,
} from "@/modules/usuarios/actions";
import type { EmpresaOpcion, FilaUsuario } from "@/modules/usuarios/query";

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
  esSuperadmin,
  esUnoMismo,
  onCerrar,
  onCreado,
  empresas,
}: {
  usuario?: FilaUsuario | null;
  esSuperadmin: boolean;
  esUnoMismo: boolean;
  onCerrar: () => void;
  onCreado: (username: string, passwordTemporal: string) => void;
  empresas: EmpresaOpcion[];
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
  const [empresaId, setEmpresaId] = useState(usuario?.empresaId ?? "");
  const [empleadoId, setEmpleadoId] = useState(usuario?.empleadoId ?? "");
  const [sedeId, setSedeId] = useState(usuario?.sedePorDefectoId ?? "");
  const [activo, setActivo] = useState(usuario?.activo ?? true);
  const formulario = useRef<HTMLFormElement>(null);

  const buscarEmpleados = useCallback(
    (q: string) => buscarEmpleadosOpciones(q, empresaId),
    [empresaId],
  );
  const buscarSedes = useCallback(
    (q: string) => buscarSedesOpciones(q, empresaId),
    [empresaId],
  );

  useEffect(() => {
    if (!estado.ok || !estado.data) {
      return;
    }
    if (!esEdicion) {
      toast.success("Usuario creado");
      router.refresh();
      onCreado(username, estado.data.passwordTemporal!);
      return;
    }
    toast.success("Usuario actualizado");
    router.refresh();
    onCerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  const error = !estado.ok && estado.mensaje ? estado.mensaje : null;
  useDialogFormError(estado, formulario, "error-form-usuario");
  const esSuperadminRol = rol === "SUPERADMIN";

  return (
    <CapaContenido pendiente={pendiente} className="sm:max-w-lg">
      <CapaEncabezado
        icono={esEdicion ? <UserCog /> : <UserPlus />}
        eyebrow="Gestión de accesos"
      >
        <CapaTitulo>
          {esEdicion ? "Editar usuario" : "Crear usuario"}
        </CapaTitulo>
        <CapaDescripcion>
          {esEdicion
            ? `@${usuario!.username} · el username no se puede cambiar.`
            : "Se generará una contraseña temporal que se muestra una sola vez."}
        </CapaDescripcion>
      </CapaEncabezado>

      <CapaFormulario
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
            /* Es el usuario de otra persona: el autocompletado del
               navegador ofrecería el del administrador que está creándolo
               y el gestor de contraseñas trataría el formulario como un
               alta de credencial propia. */
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
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
            <SelectorLocal
              id="empresaId"
              name="empresaId"
              value={esSuperadminRol ? "" : empresaId}
              etiquetaInicial={usuario?.empresaNombre ?? ""}
              opciones={empresas.map((empresa) => ({
                id: empresa.id,
                etiqueta: empresa.nombreComercial,
              }))}
              onChange={(id) => {
                setEmpresaId(id);
                setEmpleadoId("");
                setSedeId("");
              }}
              disabled={pendiente || esSuperadminRol}
              placeholder="Buscar empresa"
            />
          </div>
        ) : null}

        {!esSuperadminRol ? (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="empleadoId">Empleado (opcional)</Label>
              <SelectorAsincrono
                id="empleadoId"
                name="empleadoId"
                value={empleadoId}
                etiquetaInicial={usuario?.empleadoId ? "Empleado asignado" : ""}
                buscar={buscarEmpleados}
                onChange={setEmpleadoId}
                disabled={pendiente || !empresaId}
                placeholder="Buscar por nombre o documento"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="sedePorDefectoId">
                Sede por defecto (opcional)
              </Label>
              <SelectorAsincrono
                id="sedePorDefectoId"
                name="sedePorDefectoId"
                value={sedeId}
                etiquetaInicial={
                  usuario?.sedePorDefectoId ? "Sede asignada" : ""
                }
                buscar={buscarSedes}
                onChange={setSedeId}
                disabled={pendiente || !empresaId}
                placeholder="Buscar sede"
              />
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
          <p
            id="error-form-usuario"
            role="alert"
            className="text-destructive text-sm"
          >
            {error}
          </p>
        ) : null}

        <CapaPie className="mt-2">
          <CapaCerrar>Cancelar</CapaCerrar>
          <Button type="submit" disabled={pendiente}>
            {pendiente
              ? "Guardando…"
              : esEdicion
                ? "Guardar cambios"
                : "Crear usuario"}
          </Button>
        </CapaPie>
      </CapaFormulario>
    </CapaContenido>
  );
}
