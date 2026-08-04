"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import {
  CampoArchivo,
  type DatosSubida,
} from "@/app/(app)/empleados/campo-archivo";
import { FormEmpleado } from "@/app/(app)/empleados/form-empleado";
import { bpsAPorcentaje } from "@/app/(app)/admin/convenios/dialogo-cambiar-termino";
import { buscarPorDni } from "@/modules/empleados/actions";
import type { ResultadoBusquedaDni } from "@/modules/empleados/query";
import { crearVenta, previsualizarDescuento } from "@/modules/ventas/actions";
import type { ConvenioVigenteMio } from "@/modules/convenios/query";
import type { ConfiguracionVenta, SedeOpcion } from "@/modules/ventas/query";
import type { VentaCreada } from "@/modules/ventas/acciones";
import { calcularDescuento, formatearSoles, parsearSoles } from "@/lib/dinero";
import { formatearFechaUI, hoyLima, sumarDias } from "@/lib/fechas";
import type { Resultado } from "@/lib/tipos";
import {
  borradorVigente,
  borrarBorrador,
  guardarBorrador,
  leerBorrador,
  type BorradorVenta,
} from "@/lib/borrador-venta";
import { CampoEvidencias, type EvidenciaItem } from "./campo-evidencias";

type EmpleadoResuelto = {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  empresaId: string;
  empresaNombre: string;
  estado: "ACTIVO" | "PENDIENTE_VERIFICACION" | "RECHAZADO" | "INACTIVO";
  descuentoBps: number;
};

const ESTADO_INICIAL: Resultado<VentaCreada> = {
  ok: false,
  codigo: "VALIDACION",
  mensaje: "",
};

export function FormVenta({
  usuarioId,
  convenios,
  sedes,
  sedePorDefectoId,
  config,
}: {
  usuarioId: string;
  convenios: ConvenioVigenteMio[];
  sedes: SedeOpcion[];
  sedePorDefectoId: string | null;
  config: ConfiguracionVenta;
}) {
  const hoy = hoyLima();

  const [fase, setFase] = useState<"formulario" | "confirmacion">("formulario");
  const [confirmacion, setConfirmacion] = useState<VentaCreada | null>(null);
  const [ventaId, setVentaId] = useState(() => crypto.randomUUID());

  const [empresaConvenioId, setEmpresaConvenioId] = useState(
    convenios.length === 1 ? convenios[0]!.empresaId : "",
  );
  const [dni, setDni] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultadoBusqueda, setResultadoBusqueda] =
    useState<ResultadoBusquedaDni | null>(null);
  const [empleado, setEmpleado] = useState<EmpleadoResuelto | null>(null);
  const [mostrarCrearEmpleado, setMostrarCrearEmpleado] = useState(false);

  const [sedeId, setSedeId] = useState(sedePorDefectoId ?? sedes[0]?.id ?? "");
  const [fechaVenta, setFechaVenta] = useState(hoy);
  const [montoBrutoTexto, setMontoBrutoTexto] = useState("");
  const [observacion, setObservacion] = useState("");
  const [documento, setDocumento] = useState<DatosSubida | null>(null);
  const [evidencias, setEvidencias] = useState<EvidenciaItem[]>([]);
  const [documentoKey, setDocumentoKey] = useState(0);
  const [evidenciasKey, setEvidenciasKey] = useState(0);

  const [previaBps, setPreviaBps] = useState<number | null>(null);
  const [notaArchivosRestaurados, setNotaArchivosRestaurados] = useState<
    string | null
  >(null);
  const [borrador, setBorrador] = useState<BorradorVenta | null>(null);

  const busquedaIdRef = useRef(0);

  // Banner de borrador al montar (D08).
  useEffect(() => {
    const guardado = leerBorrador(usuarioId);
    if (borradorVigente(guardado)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con localStorage solo al montar, no puede leerse durante el render de servidor
      setBorrador(guardado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistir borrador (debounce 500 ms).
  useEffect(() => {
    if (fase !== "formulario") return;
    const timer = setTimeout(() => {
      const vacio =
        !empleado &&
        !sedeId &&
        montoBrutoTexto === "" &&
        observacion === "" &&
        !documento &&
        evidencias.length === 0;
      if (vacio) return;
      guardarBorrador(usuarioId, {
        ventaId,
        empresaConvenioId: empresaConvenioId || null,
        empleado: empleado
          ? {
              id: empleado.id,
              dni: empleado.dni,
              nombres: empleado.nombres,
              apellidos: empleado.apellidos,
              empresaId: empleado.empresaId,
              empresaNombre: empleado.empresaNombre,
              estado: empleado.estado,
              descuentoBps: empleado.descuentoBps,
            }
          : null,
        sedeId: sedeId || null,
        fechaVenta,
        montoBruto: montoBrutoTexto,
        observacion,
        documento,
        evidencias,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [
    fase,
    ventaId,
    empresaConvenioId,
    empleado,
    sedeId,
    fechaVenta,
    montoBrutoTexto,
    observacion,
    documento,
    evidencias,
    usuarioId,
  ]);

  const continuarBorrador = () => {
    if (!borrador) return;
    setVentaId(borrador.ventaId);
    setEmpresaConvenioId(borrador.empresaConvenioId ?? "");
    if (borrador.empleado) {
      setDni(borrador.empleado.dni);
      setEmpleado({
        id: borrador.empleado.id,
        dni: borrador.empleado.dni,
        nombres: borrador.empleado.nombres,
        apellidos: borrador.empleado.apellidos,
        empresaId: borrador.empleado.empresaId,
        empresaNombre: borrador.empleado.empresaNombre,
        estado: borrador.empleado.estado as EmpleadoResuelto["estado"],
        descuentoBps: borrador.empleado.descuentoBps,
      });
    }
    setSedeId(borrador.sedeId ?? "");
    setFechaVenta(borrador.fechaVenta || hoy);
    setMontoBrutoTexto(borrador.montoBruto);
    setObservacion(borrador.observacion);
    if (borrador.documento) setDocumento(borrador.documento);
    if (borrador.evidencias.length > 0) setEvidencias(borrador.evidencias);
    if (borrador.documento || borrador.evidencias.length > 0) {
      setNotaArchivosRestaurados(
        "Recuperamos el documento y las evidencias de tu borrador anterior. Si necesitas reemplazarlos, vuelve a adjuntarlos.",
      );
    }
    setBorrador(null);
  };

  const descartarBorrador = () => {
    borrarBorrador(usuarioId);
    setBorrador(null);
  };

  // Búsqueda de DNI: automática a los 8 dígitos, con debounce 300 ms.
  useEffect(() => {
    if (dni.length !== 8) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia el resultado anterior al borrar dígitos del DNI
      setResultadoBusqueda(null);
      if (empleado) setEmpleado(null);
      return;
    }
    const idActual = ++busquedaIdRef.current;
    setBuscando(true);
    const timer = setTimeout(() => {
      void buscarPorDni(dni).then((res) => {
        if (busquedaIdRef.current !== idActual) return;
        setBuscando(false);
        if (!res.ok) {
          setResultadoBusqueda(null);
          setEmpleado(null);
          toast.error(res.mensaje);
          return;
        }
        setResultadoBusqueda(res.data);
        if (res.data.encontrado) {
          const e = res.data.empleado;
          setEmpleado({
            id: e.id,
            dni: e.dni,
            nombres: e.nombres,
            apellidos: e.apellidos,
            empresaId: e.empresaId,
            empresaNombre: e.empresaNombre,
            estado: e.estado,
            descuentoBps: e.descuentoBps,
          });
          setEmpresaConvenioId(e.empresaId);
        } else {
          setEmpleado(null);
        }
      });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dni]);

  // Venta retroactiva: el término vigente pudo ser otro (04 §4).
  useEffect(() => {
    if (!empleado || fechaVenta === hoy) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- la fecha volvió a hoy: no hay previsualización que mostrar
      setPreviaBps(null);
      return;
    }
    let cancelado = false;
    void previsualizarDescuento({
      empleadoCompradorId: empleado.id,
      montoBruto: montoBrutoTexto.trim() !== "" ? montoBrutoTexto : "1",
      fechaVenta,
    }).then((res) => {
      if (cancelado) return;
      setPreviaBps(res.ok ? res.data.descuentoBps : null);
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleado?.id, fechaVenta]);

  const [estado, formAction, pendiente] = useActionState(
    crearVenta,
    ESTADO_INICIAL,
  );

  useEffect(() => {
    if (!estado.ok || !estado.data) return;
    borrarBorrador(usuarioId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- transición a la pantalla de confirmación tras un `crearVenta` exitoso
    setConfirmacion(estado.data);
    setFase("confirmacion");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const errorEnvio = !estado.ok && estado.mensaje ? estado.mensaje : null;

  const bpsEfectivo = previaBps ?? empleado?.descuentoBps ?? null;
  let montoBrutoCentimos: number | null = null;
  try {
    if (montoBrutoTexto.trim() !== "") {
      montoBrutoCentimos = parsearSoles(montoBrutoTexto);
    }
  } catch {
    montoBrutoCentimos = null;
  }
  const preview =
    montoBrutoCentimos !== null && bpsEfectivo !== null
      ? calcularDescuento(montoBrutoCentimos, bpsEfectivo)
      : null;

  const superaTope =
    montoBrutoCentimos !== null &&
    montoBrutoCentimos > config.topeMontoVentaCentimos;

  const puedeContinuar =
    empleado !== null &&
    empleado.estado !== "RECHAZADO" &&
    empleado.estado !== "INACTIVO";

  const evidenciaOk = !config.requiereEvidenciaEnVenta || evidencias.length > 0;

  const puedeGuardar =
    puedeContinuar &&
    sedeId !== "" &&
    fechaVenta !== "" &&
    montoBrutoCentimos !== null &&
    montoBrutoCentimos > 0 &&
    !superaTope &&
    documento !== null &&
    evidenciaOk &&
    !pendiente;

  const minFecha = sumarDias(hoy, -config.diasRetroactivosVenta);

  const empresaSeleccionada = convenios.find(
    (c) => c.empresaId === empresaConvenioId,
  );

  const registrarOtra = () => {
    setFase("formulario");
    setConfirmacion(null);
    setVentaId(crypto.randomUUID());
    setDni("");
    setResultadoBusqueda(null);
    setEmpleado(null);
    setFechaVenta(hoy);
    setMontoBrutoTexto("");
    setObservacion("");
    setDocumento(null);
    setEvidencias([]);
    setNotaArchivosRestaurados(null);
    setDocumentoKey((k) => k + 1);
    setEvidenciasKey((k) => k + 1);
  };

  if (fase === "confirmacion" && confirmacion && empleado) {
    return (
      <ConfirmacionVenta
        venta={confirmacion}
        empleado={empleado}
        empresaVendida={empresaSeleccionada?.empresaNombre ?? ""}
        sedeNombre={sedes.find((s) => s.id === sedeId)?.nombre ?? ""}
        onRegistrarOtra={registrarOtra}
      />
    );
  }

  return (
    <section className="flex flex-col gap-6 pb-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nueva venta</h1>

      {borrador ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>Tienes una venta sin terminar.</span>
            <span className="flex gap-2">
              <Button size="sm" onClick={continuarBorrador}>
                Continuar
              </Button>
              <Button size="sm" variant="outline" onClick={descartarBorrador}>
                Descartar
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction} className="flex flex-col gap-6">
        <input type="hidden" name="ventaId" value={ventaId} />
        <input
          type="hidden"
          name="empleadoCompradorId"
          value={empleado?.id ?? ""}
        />

        {/* ① Empleado */}
        <div className="flex flex-col gap-4">
          <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
            ① Empleado
          </h2>

          <div className="flex flex-col gap-2">
            <Label htmlFor="empresaConvenio">Empresa convenio</Label>
            {convenios.length === 1 ? (
              <Input
                id="empresaConvenio"
                value={convenios[0]!.empresaNombre}
                disabled
                readOnly
              />
            ) : (
              <select
                id="empresaConvenio"
                className="border-input bg-background text-foreground h-9 w-full rounded-md border px-2 text-sm"
                value={empresaConvenioId}
                onChange={(e) => {
                  setEmpresaConvenioId(e.target.value);
                  setDni("");
                  setEmpleado(null);
                  setResultadoBusqueda(null);
                }}
              >
                <option value="">Selecciona la empresa</option>
                {convenios.map((c) => (
                  <option key={c.convenioId} value={c.empresaId}>
                    {c.empresaNombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="dni">DNI del empleado</Label>
            <div className="relative">
              <Input
                id="dni"
                value={dni}
                onChange={(e) =>
                  setDni(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                inputMode="numeric"
                maxLength={8}
                autoFocus={convenios.length === 1}
                placeholder="8 dígitos"
                autoComplete="off"
              />
              {buscando ? (
                <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
              ) : (
                <Search className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2" />
              )}
            </div>
          </div>

          {buscando ? (
            <div className="bg-muted h-9 animate-pulse rounded-md" />
          ) : empleado ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="nombreEmpleado">Nombre del empleado</Label>
              <Input
                id="nombreEmpleado"
                value={`${empleado.nombres.toUpperCase()} ${empleado.apellidos.toUpperCase()}`}
                disabled
                readOnly
                className="bg-muted"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-success/10 text-success border-success/20 border">
                  {bpsAPorcentaje(bpsEfectivo ?? empleado.descuentoBps)}% de
                  descuento
                </Badge>
                {empleado.estado === "PENDIENTE_VERIFICACION" ? (
                  <Badge className="bg-warning/10 text-warning border-warning/20 border">
                    Pendiente de verificación
                  </Badge>
                ) : null}
              </div>
              {empleado.estado === "PENDIENTE_VERIFICACION" ? (
                <p className="text-muted-foreground text-xs">
                  Puedes registrar la venta; el administrador de{" "}
                  {empleado.empresaNombre} confirmará los datos.
                </p>
              ) : null}
              {previaBps !== null && previaBps !== empleado.descuentoBps ? (
                <p className="text-muted-foreground text-xs">
                  En esa fecha el descuento era {bpsAPorcentaje(previaBps)}%.
                </p>
              ) : null}
            </div>
          ) : resultadoBusqueda && !resultadoBusqueda.encontrado ? (
            <ResultadoNegativo
              resultado={resultadoBusqueda}
              onCrear={() => setMostrarCrearEmpleado(true)}
            />
          ) : null}
        </div>

        <div className="border-t" />

        {/* ② Venta */}
        <div className="flex flex-col gap-4">
          <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
            ② Venta
          </h2>

          <div className="flex flex-col gap-2">
            <Label htmlFor="sedeId">Sede</Label>
            <select
              id="sedeId"
              name="sedeId"
              className="border-input bg-background text-foreground h-9 w-full rounded-md border px-2 text-sm"
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
            >
              <option value="">Selecciona la sede</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fechaVenta">Fecha</Label>
            <Input
              id="fechaVenta"
              name="fechaVenta"
              type="date"
              value={fechaVenta}
              min={minFecha}
              max={hoy}
              onChange={(e) => setFechaVenta(e.target.value || hoy)}
            />
            <p className="text-muted-foreground text-xs">
              {formatearFechaUI(fechaVenta)}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="montoBruto">Monto de venta (S/)</Label>
            <Input
              id="montoBruto"
              name="montoBruto"
              value={montoBrutoTexto}
              onChange={(e) => setMontoBrutoTexto(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              aria-invalid={superaTope}
              className={superaTope ? "border-destructive" : undefined}
            />
            {superaTope ? (
              <p className="text-destructive text-sm">
                El monto no puede superar{" "}
                {formatearSoles(config.topeMontoVentaCentimos)}.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="montoFinal">Total con descuento (S/)</Label>
            <Input
              id="montoFinal"
              value={preview ? formatearSoles(preview.final) : ""}
              disabled
              readOnly
              className="bg-muted"
            />
            {preview ? (
              <p className="text-muted-foreground text-xs">
                Descuento aplicado: {formatearSoles(preview.descuento)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="border-t" />

        {/* ③ Evidencia */}
        <div className="flex flex-col gap-4">
          <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
            ③ Evidencia
          </h2>

          {notaArchivosRestaurados ? (
            <Alert>
              <AlertDescription>{notaArchivosRestaurados}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label>Documento de venta *</Label>
            <CampoArchivo
              key={documentoKey}
              prefijo="documento"
              etiqueta="documento"
              tipo="documento"
              onCambio={(datos) => {
                setDocumento(datos);
                setNotaArchivosRestaurados(null);
              }}
            />
            {documento ? (
              <>
                <input
                  type="hidden"
                  name="documentoBlobPath"
                  value={documento.blobPath}
                />
                <input
                  type="hidden"
                  name="documentoSha256"
                  value={documento.sha256}
                />
                <input
                  type="hidden"
                  name="documentoMime"
                  value={documento.mime}
                />
                <input
                  type="hidden"
                  name="documentoSizeBytes"
                  value={String(documento.sizeBytes)}
                />
              </>
            ) : null}
          </div>

          <CampoEvidencias
            key={evidenciasKey}
            onCambio={(items) => {
              setEvidencias(items);
              setNotaArchivosRestaurados(null);
            }}
          />
          <input
            type="hidden"
            name="evidenciasJson"
            value={JSON.stringify(evidencias)}
          />
          {config.requiereEvidenciaEnVenta && !evidenciaOk ? (
            <p className="text-destructive text-sm">
              Esta empresa exige al menos una evidencia adicional.
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="observacion">Observación (opcional)</Label>
            <Textarea
              id="observacion"
              name="observacion"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>
        </div>

        {errorEnvio ? (
          <p role="alert" className="text-destructive text-sm">
            {errorEnvio}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          disabled={!puedeGuardar}
          className="h-14 text-base"
        >
          {pendiente ? "Guardando…" : "Guardar venta"}
        </Button>
      </form>

      {mostrarCrearEmpleado && empresaSeleccionada ? (
        <Dialog open onOpenChange={(a) => !a && setMostrarCrearEmpleado(false)}>
          <FormEmpleado
            empresas={[]}
            miEmpresaId={null}
            dniInicial={dni}
            empresaBloqueada={{
              id: empresaSeleccionada.empresaId,
              nombre: empresaSeleccionada.empresaNombre,
            }}
            onCerrar={() => setMostrarCrearEmpleado(false)}
            onExito={(resultado) => {
              setEmpleado({
                id: resultado.empleadoId,
                dni,
                nombres: resultado.nombres,
                apellidos: resultado.apellidos,
                empresaId: empresaSeleccionada.empresaId,
                empresaNombre: empresaSeleccionada.empresaNombre,
                estado: resultado.estado as EmpleadoResuelto["estado"],
                descuentoBps: empresaSeleccionada.descuentoBps,
              });
              setResultadoBusqueda(null);
            }}
          />
        </Dialog>
      ) : null}
    </section>
  );
}

function ResultadoNegativo({
  resultado,
  onCrear,
}: {
  resultado: Extract<ResultadoBusquedaDni, { encontrado: false }>;
  onCrear: () => void;
}) {
  if (resultado.motivo === "NO_EXISTE") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-4">
        <p className="text-muted-foreground text-sm">
          No encontramos este DNI.
        </p>
        <Button type="button" variant="outline" onClick={onCrear}>
          <Plus className="size-4" />
          Crear empleado
        </Button>
      </div>
    );
  }

  const mensajes: Record<string, string> = {
    PROPIA_EMPRESA:
      "Este DNI pertenece a un empleado de tu propia empresa. El beneficio de convenio aplica solo a empleados de la empresa aliada.",
    SIN_CONVENIO:
      "empresaNombre" in resultado
        ? `Este DNI está registrado en ${resultado.empresaNombre}, que no tiene convenio vigente con tu empresa.`
        : "Este DNI no tiene convenio vigente con tu empresa.",
    NO_HABILITADO:
      "Este empleado no está habilitado para el beneficio. Contacta al administrador de su empresa.",
  };

  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertDescription>
        {mensajes[resultado.motivo] ?? "No se puede continuar con este DNI."}
      </AlertDescription>
    </Alert>
  );
}

function ConfirmacionVenta({
  venta,
  empleado,
  empresaVendida,
  sedeNombre,
  onRegistrarOtra,
}: {
  venta: VentaCreada;
  empleado: EmpleadoResuelto;
  empresaVendida: string;
  sedeNombre: string;
  onRegistrarOtra: () => void;
}) {
  return (
    <section className="mx-auto flex max-w-sm flex-col items-center gap-4 py-10 text-center">
      <span className="bg-success/10 text-success flex size-14 items-center justify-center rounded-full">
        <CheckCircle2 className="size-8" />
      </span>
      <h1 className="text-xl font-semibold">Venta registrada</h1>

      <div className="w-full text-left">
        <p className="font-medium">
          {empleado.nombres.toUpperCase()} {empleado.apellidos.toUpperCase()}
        </p>
        <p className="text-muted-foreground text-sm">
          {empresaVendida} · {sedeNombre}
        </p>
        <p className="text-muted-foreground text-sm">
          {formatearFechaUI(venta.fechaVenta)}
        </p>
      </div>

      <div className="w-full rounded-xl border p-4 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">Monto</span>
          <span>{formatearSoles(venta.montoBrutoCentimos)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">
            Descuento ({bpsAPorcentaje(venta.descuentoBps)}%)
          </span>
          <span>− {formatearSoles(venta.montoDescuentoCentimos)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t pt-2 font-semibold">
          <span>Total</span>
          <span>{formatearSoles(venta.montoFinalCentimos)}</span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2">
        <Button onClick={onRegistrarOtra} size="lg">
          Registrar otra venta
        </Button>
        <Button
          variant="outline"
          render={<Link href={`/ventas/${venta.ventaId}`} />}
        >
          Ver detalle
        </Button>
        <Button variant="ghost" render={<Link href="/" />}>
          Ir al inicio
        </Button>
      </div>
    </section>
  );
}
