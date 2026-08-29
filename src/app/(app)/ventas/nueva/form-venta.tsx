"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileImage,
  Loader2,
  Plus,
  Search,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CampoArchivo,
  type DatosSubida,
} from "@/app/(app)/empleados/campo-archivo";
import { bpsAPorcentaje } from "@/app/(app)/admin/convenios/dialogo-cambiar-termino";
import { buscarPorDocumento } from "@/modules/empleados/actions";
import type { ResultadoBusquedaDocumento } from "@/modules/empleados/query";
import { crearVenta, previsualizarDescuento } from "@/modules/ventas/actions";
import type { ConvenioVigenteMio } from "@/modules/convenios/query";
import type { ConfiguracionVenta, SedeOpcion } from "@/modules/ventas/query";
import type { VentaCreada } from "@/modules/ventas/acciones";
import { calcularDescuento, formatearSoles, parsearSoles } from "@/lib/dinero";
import { formatearFechaUI, hoyLima, sumarDias } from "@/lib/fechas";
import type { Resultado } from "@/lib/tipos";
import { zDocumentoIdentidad, type TipoDocumento } from "@/lib/zod";
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
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
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

  const [empresaConvenioId, setEmpresaConvenioId] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>("DNI");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [documentoEnfocado, setDocumentoEnfocado] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [resultadoBusqueda, setResultadoBusqueda] =
    useState<ResultadoBusquedaDocumento | null>(null);
  const [empleado, setEmpleado] = useState<EmpleadoResuelto | null>(null);
  const [resumenAbierto, setResumenAbierto] = useState(false);

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
              tipoDocumento: empleado.tipoDocumento,
              numeroDocumento: empleado.numeroDocumento,
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
      setTipoDocumento(borrador.empleado.tipoDocumento ?? "DNI");
      setNumeroDocumento(
        borrador.empleado.numeroDocumento ??
          (borrador.empleado as unknown as { dni?: string }).dni ??
          "",
      );
      setEmpleado({
        id: borrador.empleado.id,
        tipoDocumento: borrador.empleado.tipoDocumento ?? "DNI",
        numeroDocumento:
          borrador.empleado.numeroDocumento ??
          (borrador.empleado as unknown as { dni?: string }).dni ??
          "",
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

  const invalidarBusquedaDocumento = () => {
    busquedaIdRef.current += 1;
    setBuscando(false);
    setResultadoBusqueda(null);
    setEmpleado(null);
    setEmpresaConvenioId("");
  };

  const cambiarTipoDocumento = (valor: TipoDocumento) => {
    invalidarBusquedaDocumento();
    setTipoDocumento(valor);
    setNumeroDocumento("");
  };

  const cambiarNumeroDocumento = (valorIngresado: string) => {
    invalidarBusquedaDocumento();
    const valor = valorIngresado.toUpperCase();
    setNumeroDocumento(
      tipoDocumento === "DNI"
        ? valor.replace(/\D/g, "").slice(0, 8)
        : valor.replace(/[^A-Z0-9-]/g, "").slice(0, 12),
    );
  };

  const documentoValido = zDocumentoIdentidad.safeParse({
    tipoDocumento,
    numeroDocumento,
  }).success;
  const longitudVisualDocumento = tipoDocumento === "DNI" ? 8 : 12;

  const buscarEmpleado = async () => {
    const documento = zDocumentoIdentidad.safeParse({
      tipoDocumento,
      numeroDocumento,
    });
    if (!documento.success) {
      toast.error(documento.error.issues[0]?.message ?? "Documento inválido.");
      return;
    }

    const idActual = ++busquedaIdRef.current;
    setBuscando(true);
    setResultadoBusqueda(null);
    setEmpleado(null);
    setEmpresaConvenioId("");

    const res = await buscarPorDocumento(
      documento.data.tipoDocumento,
      documento.data.numeroDocumento,
    );
    if (busquedaIdRef.current !== idActual) return;
    setBuscando(false);
    if (!res.ok) {
      toast.error(res.mensaje);
      return;
    }
    setResultadoBusqueda(res.data);
    if (!res.data.encontrado) return;

    const e = res.data.empleado;
    setEmpleado({
      id: e.id,
      tipoDocumento: e.tipoDocumento,
      numeroDocumento: e.numeroDocumento,
      nombres: e.nombres,
      apellidos: e.apellidos,
      empresaId: e.empresaId,
      empresaNombre: e.empresaNombre,
      estado: e.estado,
      descuentoBps: e.descuentoBps,
    });
    setEmpresaConvenioId(e.empresaId);
  };

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
    setTipoDocumento("DNI");
    setNumeroDocumento("");
    setResultadoBusqueda(null);
    setEmpleado(null);
    setEmpresaConvenioId("");
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
    <section className="flex flex-col gap-7 pb-6 lg:gap-6">
      <div className="hidden lg:flex lg:items-start lg:justify-between lg:gap-6">
        <div>
          <div className="text-primary mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-[0.04em] uppercase">
            <Plus className="size-3.5" /> Registro de operación
          </div>
          {/* <h1 className="text-[28px] font-bold tracking-[-0.035em]">
            Nueva venta
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Registra la venta asociada a un empleado, adjunta el comprobante y
            valida el importe antes de guardar.
          </p> */}
        </div>
        <span className="border-primary/15 bg-primary/5 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold">
          <span className="bg-primary ring-primary/10 size-1.5 rounded-full ring-4" />
          Borrador sin guardar
        </span>
      </div>
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

      <form
        id="form-venta"
        action={formAction}
        className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6"
      >
        <input type="hidden" name="ventaId" value={ventaId} />
        <input
          type="hidden"
          name="empleadoCompradorId"
          value={empleado?.id ?? ""}
        />

        <div className="flex flex-col gap-5">
          {/* ① Empleado */}
          <section className="bg-card flex flex-col gap-5 rounded-[18px] border p-5 shadow-sm lg:p-[22px]">
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-[10px]">
                <UserRound className="size-[18px]" />
              </span>
              <div>
                <h2 className="text-[15px] font-bold">
                  Información del empleado
                </h2>
                <p className="text-muted-foreground hidden text-xs lg:block">
                  Identifica al empleado y su empresa de convenio.
                </p>
              </div>
              <span className="bg-muted text-muted-foreground ml-auto shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold">
                Paso 1<span className="hidden lg:inline"> de 3</span>
              </span>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_72px] lg:items-end lg:gap-4">
              <div className="order-1 flex min-w-0 flex-col gap-2 lg:order-none">
                <Label htmlFor="empresaConvenio">Empresa convenio</Label>
                <Input
                  id="empresaConvenio"
                  value={empleado?.empresaNombre ?? ""}
                  placeholder="Sin identificar"
                  disabled
                  readOnly
                  className="bg-muted/45 h-14 rounded-2xl px-4"
                />
              </div>

              <div
                className={`${empleado ? "flex" : "hidden lg:flex"} order-3 min-w-0 flex-col gap-2 lg:order-none`}
              >
                <Label htmlFor="nombreEmpleado">Nombre del empleado</Label>
                <Input
                  id="nombreEmpleado"
                  value={
                    empleado
                      ? `${empleado.nombres.toUpperCase()} ${empleado.apellidos.toUpperCase()}`
                      : ""
                  }
                  placeholder="Sin identificar"
                  disabled
                  readOnly
                  className="bg-muted/45 h-14 rounded-2xl px-4"
                />
                {empleado ? (
                  <div className="flex flex-wrap items-center gap-2 lg:hidden">
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
                ) : null}
              </div>

              <div className="order-4 hidden flex-col items-center gap-2 lg:order-none lg:flex">
                <Label>Descuento</Label>
                <div
                  className={
                    empleado
                      ? "bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-2xl text-lg font-bold shadow-sm"
                      : "bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-2xl text-lg font-bold"
                  }
                  aria-label={
                    empleado
                      ? `${bpsAPorcentaje(bpsEfectivo ?? empleado.descuentoBps)} por ciento de descuento`
                      : "Descuento sin calcular"
                  }
                >
                  {empleado
                    ? `${bpsAPorcentaje(bpsEfectivo ?? empleado.descuentoBps)}%`
                    : "—"}
                </div>
              </div>

              <div className="order-2 flex min-w-0 flex-col gap-2 lg:order-none lg:col-span-3">
                <Label htmlFor="numeroDocumento">Documento del empleado</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)_auto] lg:grid-cols-[auto_minmax(0,1fr)_44px] lg:items-center lg:gap-2.5">
                  <Select
                    value={tipoDocumento}
                    onValueChange={(valor) =>
                      cambiarTipoDocumento(valor as TipoDocumento)
                    }
                  >
                    <SelectTrigger
                      size="lg"
                      aria-label="Tipo de documento"
                      className="w-full rounded-2xl px-4 font-semibold lg:w-[108px] lg:rounded-full lg:border-2 lg:data-[size=lg]:h-11"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DNI">DNI</SelectItem>
                      <SelectItem value="CARNET_EXTRANJERIA">CE</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="group relative min-w-0 lg:h-11">
                    <Input
                      id="numeroDocumento"
                      value={numeroDocumento}
                      onChange={(e) => cambiarNumeroDocumento(e.target.value)}
                      onFocus={() => setDocumentoEnfocado(true)}
                      onBlur={() => setDocumentoEnfocado(false)}
                      inputMode={tipoDocumento === "DNI" ? "numeric" : "text"}
                      maxLength={longitudVisualDocumento}
                      autoFocus={convenios.length === 1}
                      placeholder={
                        tipoDocumento === "DNI"
                          ? "8 dígitos"
                          : "Hasta 12 caracteres"
                      }
                      autoComplete="off"
                      spellCheck={false}
                      className="h-14 rounded-2xl px-4 text-base lg:absolute lg:inset-0 lg:z-10 lg:size-full lg:cursor-text lg:opacity-0"
                    />
                    <div
                      aria-hidden="true"
                      className="hidden h-11 gap-1 lg:grid"
                      style={{
                        gridTemplateColumns: `repeat(${longitudVisualDocumento}, minmax(0, 1fr))`,
                      }}
                    >
                      {Array.from({ length: longitudVisualDocumento }).map(
                        (_, indice) => {
                          const caracter = numeroDocumento[indice];
                          const esCursor =
                            documentoEnfocado &&
                            indice === numeroDocumento.length &&
                            numeroDocumento.length < longitudVisualDocumento;
                          return (
                            <span
                              key={indice}
                              className={
                                caracter
                                  ? "flex min-w-0 items-center justify-center rounded-[11px] border-2 border-[#c7d4ff] bg-[#eaefff] font-mono text-base font-bold text-[#0035c4]"
                                  : esCursor
                                    ? "border-primary bg-background flex min-w-0 items-center justify-center rounded-[11px] border-2 shadow-[0_0_0_3px_rgba(0,71,255,0.12)]"
                                    : "bg-muted/80 flex min-w-0 items-center justify-center rounded-[11px] border-2 border-transparent"
                              }
                            >
                              {caracter ??
                                (esCursor ? (
                                  <span className="bg-primary h-5 w-0.5 animate-pulse rounded-full" />
                                ) : null)}
                            </span>
                          );
                        },
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    disabled={!documentoValido || buscando}
                    onClick={() => void buscarEmpleado()}
                    aria-label="Buscar empleado"
                    className="h-14 rounded-2xl px-5 lg:size-11 lg:rounded-full lg:px-0"
                  >
                    {buscando ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Search className="size-4" />
                    )}
                    <span className="lg:hidden">
                      {buscando ? "Buscando…" : "Buscar"}
                    </span>
                  </Button>
                </div>
              </div>

              <div className="order-5 lg:order-none lg:col-span-3">
                {buscando ? (
                  <div className="bg-muted h-9 animate-pulse rounded-md lg:hidden" />
                ) : resultadoBusqueda && !resultadoBusqueda.encontrado ? (
                  <ResultadoNegativo resultado={resultadoBusqueda} />
                ) : empleado ? (
                  <div className="space-y-1.5">
                    {empleado.estado === "PENDIENTE_VERIFICACION" ? (
                      <p className="text-muted-foreground text-xs">
                        Puedes registrar la venta; el administrador de{" "}
                        {empleado.empresaNombre} confirmará los datos.
                      </p>
                    ) : null}
                    {previaBps !== null &&
                    previaBps !== empleado.descuentoBps ? (
                      <p className="text-muted-foreground text-xs">
                        En esa fecha el descuento era{" "}
                        {bpsAPorcentaje(previaBps)}%.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <div className="border-border/70 border-t lg:hidden" />

          {/* ② Venta */}
          <section className="bg-card flex flex-col gap-5 rounded-[18px] border p-5 shadow-sm lg:p-[22px]">
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-[10px]">
                <Building2 className="size-[18px]" />
              </span>
              <div>
                <h2 className="text-[15px] font-bold">Detalle de venta</h2>
                <p className="text-muted-foreground hidden text-xs lg:block">
                  Define la sede, fecha e importe de la operación.
                </p>
              </div>
              <span className="bg-muted text-muted-foreground ml-auto shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold">
                Paso 2<span className="hidden lg:inline"> de 3</span>
              </span>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sedeId">Sede</Label>
                <Select
                  value={sedeId}
                  onValueChange={(valor) => setSedeId(valor ?? "")}
                >
                  <input type="hidden" name="sedeId" value={sedeId} />
                  <SelectTrigger
                    id="sedeId"
                    size="lg"
                    className="w-full rounded-2xl px-4"
                  >
                    <SelectValue placeholder="Selecciona la sede">
                      {(valor) =>
                        sedes.find((sede) => sede.id === valor)?.nombre ??
                        "Selecciona la sede"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {sedes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="fechaVenta">Fecha</Label>
                <DatePicker
                  id="fechaVenta"
                  name="fechaVenta"
                  value={fechaVenta}
                  min={minFecha}
                  max={hoy}
                  onChange={setFechaVenta}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="montoBruto">Monto de venta (S/)</Label>
                <Input
                  id="montoBruto"
                  name="montoBruto"
                  value={montoBrutoTexto}
                  onChange={(e) => setMontoBrutoTexto(e.target.value)}
                  inputMode="decimal"
                  placeholder="S/. 0.00"
                  aria-invalid={superaTope}
                  className={
                    superaTope
                      ? "border-destructive h-14 rounded-2xl px-4 text-lg font-semibold"
                      : "h-14 rounded-2xl px-4 text-lg font-semibold"
                  }
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
                  className="bg-muted/45 h-14 rounded-2xl px-4 text-lg font-semibold"
                  placeholder="S/. 0.00"
                />
                {preview ? (
                  <p className="text-muted-foreground text-xs">
                    Descuento aplicado: {formatearSoles(preview.descuento)}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <div className="border-border/70 border-t lg:hidden" />

          {/* ③ Evidencia */}
          <section className="bg-card flex flex-col gap-5 rounded-[18px] border p-5 shadow-sm lg:gap-0 lg:overflow-hidden lg:border-[#e3e8ef] lg:p-0 lg:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
            <div className="flex items-center gap-3 lg:min-h-[68px] lg:border-b lg:border-[#e3e8ef] lg:px-[22px] lg:py-[17px]">
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-[10px] lg:bg-[#eaf4ff] lg:text-[#0f62ad]">
                <FileImage className="size-[18px]" />
              </span>
              <div>
                <h2 className="text-[15px] font-bold lg:font-semibold">
                  Comprobante y evidencia
                </h2>
                <p className="text-muted-foreground hidden text-xs lg:block">
                  Adjunta el documento de venta y evidencia adicional.
                </p>
              </div>
              <span className="bg-muted text-muted-foreground ml-auto shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold lg:bg-[#f8fafc] lg:px-2.5 lg:text-[#98a2b3]">
                Paso 3<span className="hidden lg:inline"> de 3</span>
              </span>
            </div>

            <div className="flex flex-col gap-5 lg:p-[22px]">
              {notaArchivosRestaurados ? (
                <Alert>
                  <AlertDescription>{notaArchivosRestaurados}</AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-5 lg:grid-cols-2 lg:items-start lg:gap-4">
                <div className="min-w-0">
                  <CampoArchivo
                    key={documentoKey}
                    prefijo="documento"
                    etiqueta="documento"
                    tipo="documento"
                    variante="venta"
                    onCambio={(datos) => {
                      setDocumento(datos);
                      setNotaArchivosRestaurados(null);
                    }}
                  />
                </div>

                <CampoEvidencias
                  key={evidenciasKey}
                  onCambio={(items) => {
                    setEvidencias(items);
                    setNotaArchivosRestaurados(null);
                  }}
                />
              </div>
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

              <div className="flex flex-col gap-2 lg:gap-[7px]">
                <Label
                  htmlFor="observacion"
                  className="lg:text-[13px] lg:font-semibold lg:text-[#344054]"
                >
                  Observación{" "}
                  <span className="text-muted-foreground text-[11px] font-medium">
                    Opcional
                  </span>
                </Label>
                <Textarea
                  id="observacion"
                  name="observacion"
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Añade información relevante sobre la venta, el empleado o el comprobante..."
                  className="rounded-2xl px-4 py-3 lg:min-h-[108px] lg:rounded-xl lg:border-[#d0d7e2] lg:px-3.5 lg:placeholder:text-[#a7b0bd]"
                />
              </div>
            </div>
          </section>

          {errorEnvio ? (
            <p role="alert" className="text-destructive text-sm">
              {errorEnvio}
            </p>
          ) : null}
        </div>

        <aside className="lg:bg-card hidden lg:sticky lg:top-[96px] lg:block lg:overflow-hidden lg:rounded-[18px] lg:border lg:shadow-lg">
          <div className="border-border border-b p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold">Resumen de venta</h2>
              <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-[10px] font-bold">
                NUEVA
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Verifica los datos antes de registrar.
            </p>
          </div>
          <div className="space-y-3.5 p-5 text-xs">
            <ResumenFila
              etiqueta="Empresa"
              valor={empresaSeleccionada?.empresaNombre ?? "Sin seleccionar"}
            />
            <ResumenFila
              etiqueta="Empleado"
              valor={
                empleado
                  ? `${empleado.nombres} ${empleado.apellidos}`
                  : "Sin identificar"
              }
            />
            <ResumenFila
              etiqueta="Sede"
              valor={
                sedes.find((s) => s.id === sedeId)?.nombre ?? "Sin seleccionar"
              }
            />
            <ResumenFila
              etiqueta="Fecha"
              valor={
                fechaVenta ? formatearFechaUI(fechaVenta) : "Sin seleccionar"
              }
            />
            <ResumenFila
              etiqueta="Comprobante"
              valor={documento ? "Adjunto" : "Pendiente"}
            />
            <div className="from-primary/10 to-primary/5 mt-5 rounded-[13px] bg-gradient-to-br p-4">
              <ResumenFila
                etiqueta="Monto original"
                valor={
                  montoBrutoCentimos === null
                    ? "S/ 0.00"
                    : formatearSoles(montoBrutoCentimos)
                }
              />
              <div className="mt-2">
                <ResumenFila
                  etiqueta="Descuento convenio"
                  valor={
                    preview
                      ? `− ${formatearSoles(preview.descuento)}`
                      : "− S/ 0.00"
                  }
                />
              </div>
              <div className="border-primary/15 mt-3 flex items-end justify-between border-t pt-3">
                <span className="text-primary font-semibold">Total final</span>
                <span className="text-primary text-2xl font-extrabold tracking-tight">
                  {preview ? formatearSoles(preview.final) : "S/ 0.00"}
                </span>
              </div>
            </div>
          </div>
          <div className="border-border border-t p-5">
            <Button
              type="submit"
              disabled={!puedeGuardar}
              className="h-12 w-full rounded-xl"
            >
              {pendiente ? "Guardando…" : "Guardar venta"}
            </Button>
            <p className="text-muted-foreground mt-2.5 text-[10px] leading-relaxed">
              Al guardar confirmas que la información y los archivos adjuntos
              son correctos.
            </p>
          </div>
        </aside>
      </form>

      <div className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <Button
          type="button"
          size="lg"
          disabled={!puedeGuardar}
          onClick={() => setResumenAbierto(true)}
          className="shadow-primary/20 h-13 w-full rounded-2xl text-base shadow-lg"
        >
          Revisar venta
        </Button>
      </div>

      <Sheet open={resumenAbierto} onOpenChange={setResumenAbierto}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 rounded-t-3xl px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="p-0 text-left">
            <SheetTitle className="text-xl font-semibold">
              Revisa la venta
            </SheetTitle>
            <p className="text-muted-foreground text-sm">
              Confirma los datos antes de registrarla.
            </p>
          </SheetHeader>
          <div className="bg-muted/50 my-5 space-y-3 rounded-2xl p-4 text-sm">
            <ResumenFila
              etiqueta="Empleado"
              valor={
                empleado ? `${empleado.nombres} ${empleado.apellidos}` : "—"
              }
            />
            <ResumenFila
              etiqueta="Sede"
              valor={sedes.find((s) => s.id === sedeId)?.nombre ?? "—"}
            />
            <ResumenFila
              etiqueta="Monto"
              valor={
                montoBrutoCentimos === null
                  ? "—"
                  : formatearSoles(montoBrutoCentimos)
              }
            />
            <div className="border-border flex items-center justify-between border-t pt-3 text-base font-semibold">
              <span>Total</span>
              <span className="text-primary">
                {preview ? formatearSoles(preview.final) : "—"}
              </span>
            </div>
          </div>
          <Button
            type="submit"
            form="form-venta"
            size="lg"
            disabled={!puedeGuardar}
            className="h-13 w-full rounded-2xl text-base"
          >
            {pendiente ? "Guardando…" : "Confirmar y guardar"}
          </Button>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function ResumenFila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="max-w-[65%] truncate text-right font-medium">
        {valor}
      </span>
    </div>
  );
}

function ResultadoNegativo({
  resultado,
}: {
  resultado: Extract<ResultadoBusquedaDocumento, { encontrado: false }>;
}) {
  if (resultado.motivo === "NO_EXISTE") {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-4">
        <p className="text-muted-foreground text-sm">
          No encontramos este documento.
        </p>
        <p className="text-muted-foreground text-xs">
          Solicita a un administrador que registre al empleado antes de
          continuar con la venta.
        </p>
      </div>
    );
  }

  const mensajes: Record<string, string> = {
    PROPIA_EMPRESA:
      "Este documento pertenece a un empleado de tu propia empresa. El beneficio de convenio aplica solo a empleados de la empresa aliada.",
    SIN_CONVENIO:
      "empresaNombre" in resultado
        ? `Este documento está registrado en ${resultado.empresaNombre}, que no tiene convenio vigente con tu empresa.`
        : "Este documento no tiene convenio vigente con tu empresa.",
    NO_HABILITADO:
      "Este empleado no está habilitado para el beneficio. Contacta al administrador de su empresa.",
  };

  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertDescription>
        {mensajes[resultado.motivo] ??
          "No se puede continuar con este documento."}
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
