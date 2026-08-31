"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  Handshake,
  History,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Paperclip,
  Percent,
  Search,
  SearchCheck,
  ShieldAlert,
  ShoppingCart,
  UserCheck,
  UserCog,
  UserPlus,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { diffAuditoria } from "@/lib/audit/diff";
import {
  ACCIONES_AUDITORIA,
  ENTIDADES_AUDITORIA,
  FAMILIAS_AUDITORIA,
  etiquetaAccion,
  etiquetaCampo,
  etiquetaEntidad,
  fraseAuditoria,
  metaDeAccion,
  type FamiliaAuditoria,
  type TonoAuditoria,
} from "@/lib/audit/semantica";
import type { AccionAuditoria } from "@/lib/audit/registrar";
import {
  etiquetaDiaLima,
  fechaLimaDe,
  formatearFechaUI,
  formatearHoraLima,
  sumarDias,
} from "@/lib/fechas";
import type {
  DetalleAuditoria,
  FilaAuditoria,
  FiltroAuditoria,
} from "@/modules/auditoria/query";
import type { Pagina } from "@/lib/tipos";
import {
  cargarAuditoria,
  cargarDetalleAuditoria,
  verificarIntegridad,
} from "./actions";
import { CabeceraPagina, EstadoVacio } from "@/components/shell/pagina-ui";

type EstadoVerificacion =
  | { estado: "idle" }
  | { estado: "pending"; verificadas: number }
  | { estado: "success"; verificadas: number }
  | { estado: "broken"; enId: number; verificadas: number }
  | { estado: "error" };

const ICONO_ACCION: Record<AccionAuditoria, LucideIcon> = {
  LOGIN_OK: LogIn,
  LOGIN_FALLIDO: ShieldAlert,
  LOGOUT: LogOut,
  PASSWORD_CAMBIADA: KeyRound,
  PASSWORD_RESETEADA: KeyRound,
  EMPRESA_CREADA: Building2,
  EMPRESA_ACTUALIZADA: Building2,
  SEDE_CREADA: MapPin,
  SEDE_ACTUALIZADA: MapPin,
  CONVENIO_CREADO: Handshake,
  CONVENIO_ACTUALIZADO: Handshake,
  TERMINO_CREADO: Percent,
  TERMINO_CERRADO: Percent,
  USUARIO_CREADO: UserPlus,
  USUARIO_ACTUALIZADO: UserCog,
  USUARIO_DESACTIVADO: UserX,
  EMPLEADO_CREADO: UserPlus,
  EMPLEADO_ACTUALIZADO: UserCog,
  EMPLEADO_VERIFICADO: UserCheck,
  EMPLEADO_RECHAZADO: UserX,
  BUSQUEDA_DNI: Search,
  BUSQUEDA_DOCUMENTO: Search,
  VENTA_CREADA: ShoppingCart,
  VENTA_ANULADA: Ban,
  ADJUNTO_SUBIDO: Paperclip,
  ADJUNTO_VISTO: Eye,
  EXPORTACION: Download,
};

const CLASES_TONO: Record<TonoAuditoria, string> = {
  success: "bg-success/10 text-success ring-success/10",
  warning: "bg-warning/10 text-warning ring-warning/10",
  destructive: "bg-destructive/10 text-destructive ring-destructive/10",
  neutral: "bg-muted text-muted-foreground ring-border",
};

const CLASE_SELECT =
  "border-input bg-background text-foreground h-11 w-full rounded-xl border px-3 text-base sm:text-sm";
const CLASE_INPUT = CLASE_SELECT;

/** Claves visibles como chip; `actorId`, en cambio, no tiene control propio en la UI. */
const CAMPOS_FILTRO_CHIP = [
  "desde",
  "hasta",
  "familia",
  "accion",
  "entidad",
  "entidadId",
  "actor",
] as const;

function urlAuditoria(
  base: FiltroAuditoria,
  cambios: Partial<Record<keyof FiltroAuditoria, string | null>>,
): string {
  const combinado: Partial<Record<keyof FiltroAuditoria, string>> = {
    ...base,
    cursor: undefined,
  };
  for (const [clave, valor] of Object.entries(cambios)) {
    const campo = clave as keyof FiltroAuditoria;
    if (valor === null || valor === undefined) delete combinado[campo];
    else combinado[campo] = valor;
  }
  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(combinado)) {
    if (valor) query.set(clave, valor);
  }
  const texto = query.toString();
  return texto ? `/auditoria?${texto}` : "/auditoria";
}

function etiquetaChip(
  campo: (typeof CAMPOS_FILTRO_CHIP)[number],
  filtros: FiltroAuditoria,
): string {
  switch (campo) {
    case "desde":
      return `Desde ${formatearFechaUI(filtros.desde!)}`;
    case "hasta":
      return `Hasta ${formatearFechaUI(filtros.hasta!)}`;
    case "familia":
      return (
        FAMILIAS_AUDITORIA.find((f) => f.valor === filtros.familia)?.etiqueta ??
        "Familia"
      );
    case "accion":
      return etiquetaAccion(filtros.accion!);
    case "entidad":
      return etiquetaEntidad(filtros.entidad!);
    case "entidadId":
      return `ID ${filtros.entidadId}`;
    case "actor":
      return `Actor “${filtros.actor}”`;
  }
}

export function AuditoriaClient({
  pagina,
  filtros,
  puedeVerificar,
  alcanceGlobal,
  hoy,
}: {
  pagina: Pagina<FilaAuditoria>;
  filtros: FiltroAuditoria;
  puedeVerificar: boolean;
  alcanceGlobal: boolean;
  /** `hoyLima()` calculado en el servidor: fija "Hoy"/"Ayer" para que no cambien al hidratar. */
  hoy: string;
}) {
  const [eventos, setEventos] = useState(pagina.items);
  const [cursor, setCursor] = useState(pagina.cursor);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [verificacion, setVerificacion] = useState<EstadoVerificacion>({
    estado: "idle",
  });
  const [familiaSeleccionada, setFamiliaSeleccionada] = useState(
    filtros.familia ?? "",
  );

  async function verificar() {
    setVerificacion({ estado: "pending", verificadas: 0 });
    let desdeId: number | undefined;
    let verificadas = 0;
    try {
      do {
        const resultado = await verificarIntegridad(desdeId);
        verificadas += resultado.verificadas;
        if (resultado.rota) {
          setVerificacion({
            estado: "broken",
            enId: resultado.enId,
            verificadas,
          });
          return;
        }
        desdeId = resultado.ultimoId ?? undefined;
        setVerificacion({ estado: "pending", verificadas });
        if (resultado.completa) {
          setVerificacion({ estado: "success", verificadas });
          return;
        }
      } while (desdeId !== undefined);
    } catch {
      setVerificacion({ estado: "error" });
    }
  }

  async function cargarMas() {
    if (!cursor || cargandoMas) return;
    setCargandoMas(true);
    try {
      const siguiente = await cargarAuditoria(filtros, cursor);
      setEventos((actuales) => [...actuales, ...siguiente.items]);
      setCursor(siguiente.cursor);
    } finally {
      setCargandoMas(false);
    }
  }

  const filtrosActivos = CAMPOS_FILTRO_CHIP.filter((campo) => filtros[campo]);
  const acciones = familiaSeleccionada
    ? ACCIONES_AUDITORIA.filter((a) => a.familia === familiaSeleccionada)
    : ACCIONES_AUDITORIA;
  const grupos = agruparPorDia(eventos, hoy);

  return (
    <section className="page-shell">
      <CabeceraPagina
        kicker="Trazabilidad"
        titulo="Auditoría"
        descripcion={
          alcanceGlobal
            ? "Revisa la actividad crítica del sistema y verifica la integridad de la cadena de registros."
            : "Revisa la actividad crítica registrada por tu empresa."
        }
        icono={<History className="size-5" />}
        acciones={
          puedeVerificar ? (
            <Button
              variant="outline"
              disabled={verificacion.estado === "pending"}
              onClick={verificar}
            >
              <SearchCheck className="size-4" />
              {verificacion.estado === "pending"
                ? "Verificando…"
                : "Verificar integridad"}
            </Button>
          ) : null
        }
      />
      {puedeVerificar ? <EstadoIntegridad estado={verificacion} /> : null}

      <div className="control-bar flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {presetsFecha(hoy).map((preset) => (
            <Link
              key={preset.etiqueta}
              href={urlAuditoria(filtros, {
                desde: preset.desde,
                hasta: preset.hasta,
              })}
              aria-current={
                filtros.desde === preset.desde && filtros.hasta === preset.hasta
                  ? "true"
                  : undefined
              }
              className="border-input aria-[current]:bg-primary aria-[current]:text-primary-foreground rounded-full border px-3 py-1.5 text-xs font-semibold aria-[current]:border-transparent"
            >
              {preset.etiqueta}
            </Link>
          ))}
        </div>
        {/* Navegación GET nativa: `/auditoria` sigue funcionando sin JS. */}
        <form className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Desde
            <input
              type="date"
              name="desde"
              defaultValue={filtros.desde}
              aria-label="Fecha inicial"
              className={CLASE_INPUT}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Hasta
            <input
              type="date"
              name="hasta"
              defaultValue={filtros.hasta}
              aria-label="Fecha final"
              className={CLASE_INPUT}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Familia
            <select
              name="familia"
              defaultValue={filtros.familia ?? ""}
              className={CLASE_SELECT}
              onChange={(e) =>
                setFamiliaSeleccionada(e.target.value as FamiliaAuditoria | "")
              }
            >
              <option value="">Todas</option>
              {FAMILIAS_AUDITORIA.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Acción
            <select
              key={familiaSeleccionada}
              name="accion"
              defaultValue={familiaSeleccionada ? "" : (filtros.accion ?? "")}
              className={CLASE_SELECT}
            >
              <option value="">Todas</option>
              {acciones.map((a) => (
                <option key={a.valor} value={a.valor}>
                  {a.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Entidad
            <select
              name="entidad"
              defaultValue={filtros.entidad ?? ""}
              className={CLASE_SELECT}
            >
              <option value="">Todas</option>
              {ENTIDADES_AUDITORIA.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            ID de entidad
            <input
              name="entidadId"
              defaultValue={filtros.entidadId}
              placeholder="UUID exacto"
              className={CLASE_INPUT}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Actor (usuario)
            <input
              name="actor"
              defaultValue={filtros.actor}
              placeholder="Nombre de usuario"
              className={CLASE_INPUT}
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Filtrar
            </Button>
          </div>
        </form>
      </div>

      {filtrosActivos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filtrosActivos.map((campo) => (
            <Badge key={campo} variant="outline" className="gap-1">
              {etiquetaChip(campo, filtros)}
              <Link
                href={urlAuditoria(filtros, { [campo]: null })}
                aria-label="Quitar filtro"
                className="ml-1"
              >
                <X className="size-3" />
              </Link>
            </Badge>
          ))}
          <Link
            href="/auditoria"
            className="text-muted-foreground text-xs font-semibold hover:underline"
          >
            Limpiar filtros
          </Link>
        </div>
      )}

      {eventos.length ? (
        <div className="surface-panel divide-y px-5 sm:px-6">
          {grupos.map((grupo) => (
            <div key={grupo.dia} className="py-4">
              <h2 className="text-muted-foreground mb-1 text-xs font-bold tracking-wide uppercase">
                {grupo.etiqueta}
              </h2>
              <ol className="divide-y">
                {grupo.eventos.map((fila) => (
                  <Evento key={fila.id} fila={fila} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      ) : (
        <EstadoVacio
          icono={<History className="size-6" />}
          titulo="No hay registros"
          descripcion="No encontramos actividad para los filtros seleccionados."
          accion={
            filtrosActivos.length > 0 ? (
              <Link href="/auditoria">
                <Button variant="outline">Limpiar filtros</Button>
              </Link>
            ) : undefined
          }
        />
      )}
      {cursor && (
        <Button
          variant="outline"
          className="self-start"
          onClick={cargarMas}
          disabled={cargandoMas}
        >
          {cargandoMas ? (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              Cargando más…
            </>
          ) : (
            "Cargar más"
          )}
        </Button>
      )}
    </section>
  );
}

function presetsFecha(hoy: string) {
  return [
    { etiqueta: "Hoy", desde: hoy, hasta: hoy },
    { etiqueta: "Últimos 7 días", desde: sumarDias(hoy, -6), hasta: hoy },
    { etiqueta: "Últimos 30 días", desde: sumarDias(hoy, -29), hasta: hoy },
  ];
}

function agruparPorDia(
  eventos: FilaAuditoria[],
  hoy: string,
): { dia: string; etiqueta: string; eventos: FilaAuditoria[] }[] {
  const grupos: { dia: string; etiqueta: string; eventos: FilaAuditoria[] }[] =
    [];
  for (const evento of eventos) {
    const dia = fechaLimaDe(evento.ts);
    const actual = grupos.at(-1);
    if (actual?.dia === dia) actual.eventos.push(evento);
    else
      grupos.push({
        dia,
        etiqueta: etiquetaDiaLima(evento.ts, hoy),
        eventos: [evento],
      });
  }
  return grupos;
}

function EstadoIntegridad({ estado }: { estado: EstadoVerificacion }) {
  if (estado.estado === "idle") {
    return (
      <p
        role="status"
        className="text-muted-foreground border-border/70 bg-card/60 flex items-center gap-2 rounded-xl border border-dashed p-3 text-sm"
      >
        <SearchCheck className="size-4" />
        Integridad no verificada en esta sesión.
      </p>
    );
  }
  if (estado.estado === "pending") {
    return (
      <p
        role="status"
        aria-live="polite"
        className="text-muted-foreground border-border/70 bg-card/60 flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold"
      >
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
        Verificando integridad… {estado.verificadas} registros comprobados.
      </p>
    );
  }
  if (estado.estado === "success") {
    return (
      <p
        role="status"
        className="border-success/20 bg-success/8 text-success flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold"
      >
        <CheckCircle2 className="size-4" />
        Cadenas íntegras: {estado.verificadas} registros verificados.
      </p>
    );
  }
  if (estado.estado === "broken") {
    return (
      <p
        role="alert"
        className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold"
      >
        <AlertCircle className="size-4" />
        Cadena rota en el registro {estado.enId} ({estado.verificadas} registros
        comprobados).
      </p>
    );
  }
  return (
    <div
      role="alert"
      className="border-warning/30 bg-warning/10 text-warning flex items-center justify-between gap-3 rounded-xl border p-3 text-sm font-semibold"
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="size-4" />
        No se pudo verificar la integridad. Inténtalo nuevamente.
      </span>
    </div>
  );
}

function Evento({ fila }: { fila: FilaAuditoria }) {
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState<DetalleAuditoria | null>();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const cambios = detalle
    ? diffAuditoria(detalle.datosAntes, detalle.datosDespues)
    : [];
  const meta = metaDeAccion(fila.accion);
  const Icono = ICONO_ACCION[fila.accion as AccionAuditoria] ?? History;
  const tono = meta?.tono ?? "neutral";
  const panelId = `auditoria-evento-${fila.id}`;

  async function cargar() {
    setCargando(true);
    setError(false);
    try {
      const respuesta = await cargarDetalleAuditoria(fila.id);
      setDetalle(respuesta);
      if (!respuesta) setError(true);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }

  function alternar() {
    if (abierto) return setAbierto(false);
    setAbierto(true);
    if (detalle === undefined && !cargando) cargar();
  }

  return (
    <li className="flex gap-3 py-4">
      <span
        className={`ring-card mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ring-4 ${CLASES_TONO[tono]}`}
      >
        <Icono className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          {formatearHoraLima(fila.ts)}
        </p>
        <p className="mt-0.5 text-sm font-medium">{fraseAuditoria(fila)}</p>
        <p className="text-muted-foreground text-xs">
          {etiquetaEntidad(fila.entidad)} · {fila.entidadId}
        </p>
        <button
          type="button"
          onClick={alternar}
          aria-expanded={abierto}
          aria-controls={panelId}
          className="text-primary mt-2 inline-flex items-center gap-1 text-xs font-bold"
        >
          <ChevronDown
            className={`size-3.5 transition-transform ${abierto ? "rotate-180" : ""}`}
          />
          {abierto ? "Ocultar cambios" : "Ver cambios"}
        </button>
        {abierto && (
          <div id={panelId} className="bg-muted/70 mt-3 rounded-xl p-3 text-xs">
            {cargando ? (
              <span className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                Cargando cambios…
              </span>
            ) : error ? (
              <span className="text-destructive flex items-center gap-2">
                <AlertTriangle className="size-3.5" />
                No se pudieron cargar los cambios.
                <button
                  type="button"
                  onClick={cargar}
                  className="font-bold underline"
                >
                  Reintentar
                </button>
              </span>
            ) : cambios.length ? (
              <dl className="space-y-3">
                {cambios.map((c) => (
                  <div key={c.campo}>
                    <dt className="text-muted-foreground font-bold">
                      {etiquetaCampo(c.campo)}
                    </dt>
                    <dd className="mt-1 grid grid-cols-2 gap-2">
                      <ValorDiff etiqueta="Antes" valor={c.antes} />
                      <ValorDiff etiqueta="Después" valor={c.despues} />
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              "Este evento no contiene cambios comparables."
            )}
          </div>
        )}
      </div>
    </li>
  );
}

const LARGO_MAXIMO_DIFF = 140;

function ValorDiff({ etiqueta, valor }: { etiqueta: string; valor: unknown }) {
  const [expandido, setExpandido] = useState(false);
  const texto = mostrar(valor);
  const esLargo = texto.length > LARGO_MAXIMO_DIFF;
  const visible =
    esLargo && !expandido ? `${texto.slice(0, LARGO_MAXIMO_DIFF)}…` : texto;
  return (
    <div className="bg-card rounded-lg p-2">
      <p className="text-muted-foreground text-[10px] font-bold uppercase">
        {etiqueta}
      </p>
      <p className="mt-0.5 break-words">{visible}</p>
      {esLargo && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="text-primary mt-1 text-[11px] font-bold"
        >
          {expandido ? "Ver menos" : "Ver todo"}
        </button>
      )}
    </div>
  );
}

function mostrar(v: unknown) {
  return v === undefined
    ? "—"
    : typeof v === "string"
      ? `“${v}”`
      : JSON.stringify(v);
}
