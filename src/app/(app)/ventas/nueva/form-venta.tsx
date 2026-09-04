"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
  Search,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  claseFuentes,
  usuarioId,
  convenios,
  sedes,
  sedePorDefectoId,
  config,
}: {
  /** Clases de `next/font` con las fuentes del flujo (se aplican al portal del Sheet). */
  claseFuentes: string;
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
  const esDni = tipoDocumento === "DNI";
  const longitudVisualDocumento = esDni ? 8 : 12;

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

  /** Desglose del total: solo existe cuando hay un cálculo válido que enseñar. */
  const desglose =
    preview !== null && !superaTope && montoBrutoCentimos !== null
      ? { bruto: montoBrutoCentimos, ...preview }
      : null;

  // Avance para la barra del resumen: cada paso vale un tramo.
  const pasoUnoListo = puedeContinuar;
  const pasoDosListo =
    sedeId !== "" &&
    fechaVenta !== "" &&
    montoBrutoCentimos !== null &&
    montoBrutoCentimos > 0 &&
    !superaTope;
  const pasoTresListo = documento !== null && evidenciaOk;
  const pasos = [pasoUnoListo, pasoDosListo, pasoTresListo];
  const completados = pasos.filter(Boolean).length;

  /** Primer requisito que falta: el resumen solo muestra uno, el accionable. */
  const faltante = !pasoUnoListo
    ? "Identifica al empleado para empezar."
    : !pasoDosListo
      ? superaTope
        ? `El monto no puede superar ${formatearSoles(config.topeMontoVentaCentimos)}.`
        : "Completa la sede, la fecha y el monto de la venta."
      : !pasoTresListo
        ? documento === null
          ? "Adjunta el documento de venta."
          : "Esta empresa exige al menos una evidencia adicional."
        : "Todo listo. Revisa los importes antes de registrar.";

  return (
    <section className={`venta-shell flex flex-col gap-6 pb-6 ${claseFuentes}`}>
      {/* ── Barra superior ── */}
      {/* En móvil el título de la pantalla lo pone la cabecera de ruta
          (`CabeceraPuntoVenta`, issue #52); acá solo queda el indicador de
          estado del borrador, que sí es información del formulario. */}
      <header className="flex flex-wrap items-center justify-end gap-4 lg:justify-between">
        <div className="hidden lg:block">
          <p className="font-mono text-[12px] font-bold tracking-[0.16em] text-[var(--venta-azul)] uppercase">
            Registro de operación
          </p>
          <h1 className="mt-1 text-[22px] leading-tight font-bold tracking-[-0.02em]">
            Nueva venta con convenio
          </h1>
        </div>
        <p
          data-listo={puedeGuardar ? "" : undefined}
          className="inline-flex items-center gap-2.5 rounded-full border-2 border-[var(--venta-linea)] bg-[var(--venta-papel)] px-4 py-2.5 text-sm font-semibold text-[var(--venta-gris)] transition-colors data-[listo]:border-[var(--venta-azul-borde)] data-[listo]:bg-[var(--venta-azul-humo)] data-[listo]:text-[var(--venta-azul)]"
        >
          <span className="size-2 rounded-full bg-[var(--venta-gris-claro)] transition-colors group-data-[listo]:bg-current [[data-listo]>&]:bg-[var(--venta-azul)]" />
          {puedeGuardar ? "Listo para registrar" : "Borrador sin guardar"}
        </p>
      </header>

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
        className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_372px]"
      >
        <input type="hidden" name="ventaId" value={ventaId} />
        <input
          type="hidden"
          name="empleadoCompradorId"
          value={empleado?.id ?? ""}
        />

        <div className="flex min-w-0 flex-col gap-4">
          {/* ── Paso 1: empleado ── */}
          <PasoTarjeta
            numero={1}
            titulo="Identifica al empleado"
            descripcion="Busca por documento y traemos su empresa de convenio."
            activo={!pasoUnoListo}
            hecho={pasoUnoListo}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <Select
                value={tipoDocumento}
                onValueChange={(valor) =>
                  cambiarTipoDocumento(valor as TipoDocumento)
                }
              >
                <SelectTrigger
                  aria-label="Tipo de documento"
                  className="order-1 h-[50px] w-auto shrink-0 rounded-full border-2 border-[var(--venta-linea)] bg-[var(--venta-papel)] px-5 text-[15px] font-semibold data-[size=default]:h-[50px] sm:h-[58px] sm:data-[size=default]:h-[58px]"
                >
                  <SelectValue>{() => (esDni ? "DNI" : "CE")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DNI">DNI</SelectItem>
                  <SelectItem value="CARNET_EXTRANJERIA">CE</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                disabled={!documentoValido || buscando}
                onClick={() => void buscarEmpleado()}
                aria-label="Buscar empleado"
                className={`order-2 ml-auto h-[50px] w-[50px] shrink-0 gap-2 rounded-full bg-[var(--venta-azul)] px-0 text-[15px] font-semibold text-white transition-[width] duration-300 ease-out hover:bg-[var(--venta-azul-hondo)] disabled:bg-[var(--venta-linea)] disabled:text-[var(--venta-gris-claro)] sm:order-3 sm:ml-0 sm:h-[58px] ${esDni ? "sm:w-[132px]" : "sm:w-[58px]"}`}
              >
                {buscando ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Search className="size-5" />
                )}
                <span
                  className={`max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-300 ease-out ${esDni ? "sm:max-w-20 sm:opacity-100" : ""}`}
                >
                  {buscando ? "Buscando…" : "Buscar"}
                </span>
              </Button>

              {/* Casillas: el `<input>` real va encima, invisible y a pantalla
                  completa, para que el teclado móvil siga funcionando. */}
              <div className="relative order-3 h-[50px] min-w-0 basis-full sm:order-2 sm:h-[58px] sm:flex-1 sm:basis-64">
                <Label htmlFor="numeroDocumento" className="sr-only">
                  Documento del empleado
                </Label>
                <div
                  aria-hidden="true"
                  className="grid h-full gap-[7px]"
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
                          key={`${tipoDocumento}-${indice}`}
                          className={
                            caracter
                              ? "flex min-w-0 items-center justify-center rounded-[13px] border-2 border-[var(--venta-azul-borde)] bg-[var(--venta-azul-humo)] font-mono text-lg font-bold text-[var(--venta-azul-hondo)] transition-all duration-200 sm:rounded-2xl sm:text-xl"
                              : esCursor
                                ? "flex min-w-0 items-center justify-center rounded-[13px] border-2 border-[var(--venta-azul)] bg-[var(--venta-papel)] shadow-[0_0_0_4px_rgba(0,71,255,0.12)] transition-all duration-200 sm:rounded-2xl"
                                : "flex min-w-0 items-center justify-center rounded-[13px] border-2 border-transparent bg-[var(--venta-hueco)] transition-all duration-200 sm:rounded-2xl"
                          }
                        >
                          {caracter ??
                            (esCursor ? (
                              <span className="h-5.5 w-0.5 animate-pulse rounded-full bg-[var(--venta-azul)]" />
                            ) : null)}
                        </span>
                      );
                    },
                  )}
                </div>
                <input
                  id="numeroDocumento"
                  value={numeroDocumento}
                  onChange={(e) => cambiarNumeroDocumento(e.target.value)}
                  onFocus={() => setDocumentoEnfocado(true)}
                  onBlur={() => setDocumentoEnfocado(false)}
                  inputMode={esDni ? "numeric" : "text"}
                  maxLength={longitudVisualDocumento}
                  autoFocus={convenios.length === 1}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="pista-documento"
                  className="absolute inset-0 size-full cursor-text rounded-2xl text-base opacity-0 outline-none"
                />
              </div>
            </div>

            <p
              id="pista-documento"
              className="mt-3 text-[13px] text-[var(--venta-gris)]"
            >
              {esDni
                ? "8 dígitos, sin puntos ni guiones."
                : "Hasta 12 caracteres, letras y números."}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <CampoSoloLectura
                rotulo="Empresa convenio"
                htmlFor="empresaConvenio"
                valor={empleado?.empresaNombre ?? ""}
                marcador="Aparece al buscar"
              />
              <CampoSoloLectura
                rotulo="Nombre del empleado"
                htmlFor="nombreEmpleado"
                valor={
                  empleado
                    ? `${empleado.nombres.toUpperCase()} ${empleado.apellidos.toUpperCase()}`
                    : ""
                }
                marcador="Aparece al buscar"
              />
            </div>

            {empleado ? (
              <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-[var(--venta-azul-humo)] px-4 py-3.5">
                <span className="font-mono text-[22px] font-bold text-[var(--venta-azul)]">
                  {bpsAPorcentaje(bpsEfectivo ?? empleado.descuentoBps)}%
                </span>
                <p className="text-sm leading-snug text-[var(--venta-azul-hondo)]">
                  Descuento de convenio vigente para{" "}
                  <b className="font-bold">{empleado.empresaNombre}</b>. Se
                  aplica solo a este empleado.
                </p>
              </div>
            ) : null}

            <div className="mt-4 empty:mt-0">
              {buscando ? (
                <div className="bg-muted h-9 animate-pulse rounded-md" />
              ) : resultadoBusqueda && !resultadoBusqueda.encontrado ? (
                <ResultadoNegativo resultado={resultadoBusqueda} />
              ) : empleado ? (
                <div className="space-y-1.5">
                  {empleado.estado === "PENDIENTE_VERIFICACION" ? (
                    <p className="text-[13px] text-[var(--venta-gris)]">
                      Puedes registrar la venta; el administrador de{" "}
                      {empleado.empresaNombre} confirmará los datos.
                    </p>
                  ) : null}
                  {previaBps !== null && previaBps !== empleado.descuentoBps ? (
                    <p className="text-[13px] text-[var(--venta-gris)]">
                      En esa fecha el descuento era {bpsAPorcentaje(previaBps)}
                      %.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </PasoTarjeta>

          {/* ── Paso 2: detalle ── */}
          <PasoTarjeta
            numero={2}
            titulo="Detalle de la venta"
            descripcion="Sede, fecha e importe de la operación."
            activo={pasoUnoListo && !pasoDosListo}
            hecho={pasoDosListo}
            bloqueado={!pasoUnoListo}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col">
                <Rotulo htmlFor="sedeId">Sede</Rotulo>
                <Select
                  value={sedeId}
                  onValueChange={(valor) => setSedeId(valor ?? "")}
                >
                  <input type="hidden" name="sedeId" value={sedeId} />
                  <SelectTrigger
                    id="sedeId"
                    className="h-[58px] w-full rounded-[18px] border-2 border-[var(--venta-linea)] bg-[var(--venta-papel)] px-4 text-base font-medium data-[size=default]:h-[58px]"
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

              <div className="flex min-w-0 flex-col">
                <Rotulo htmlFor="fechaVenta">Fecha</Rotulo>
                <DatePicker
                  id="fechaVenta"
                  name="fechaVenta"
                  value={fechaVenta}
                  min={minFecha}
                  max={hoy}
                  onChange={setFechaVenta}
                  className="h-[58px] rounded-[18px] border-2 border-[var(--venta-linea)] text-base"
                />
              </div>

              <div className="grid min-w-0 gap-4 sm:col-span-2 sm:grid-cols-2">
                {/* ── Monto ── */}
                <div className="flex min-w-0 flex-col">
                  <Rotulo htmlFor="montoBruto">Monto de venta (S/)</Rotulo>
                  <div
                    className={`flex h-[72px] items-center gap-2.5 rounded-[22px] border-2 bg-[var(--venta-papel)] px-4 transition focus-within:border-[var(--venta-azul)] focus-within:shadow-[0_0_0_4px_rgba(0,71,255,0.12)] ${
                      superaTope
                        ? "border-destructive"
                        : "border-[var(--venta-linea)]"
                    }`}
                  >
                    <span className="font-mono text-[22px] font-bold text-[var(--venta-gris)]">
                      S/
                    </span>
                    <input
                      id="montoBruto"
                      name="montoBruto"
                      value={montoBrutoTexto}
                      onChange={(e) => setMontoBrutoTexto(e.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-invalid={superaTope}
                      className="h-full min-w-0 flex-1 border-none bg-transparent font-mono text-[28px] font-bold outline-none placeholder:text-[var(--venta-gris-claro)]"
                    />
                  </div>
                  {superaTope ? (
                    <p className="text-destructive mt-3 text-[13px] font-semibold">
                      El monto no puede superar{" "}
                      {formatearSoles(config.topeMontoVentaCentimos)}.
                    </p>
                  ) : null}
                </div>

                {/* ── Total con descuento: mismo campo, en azul y calculado ── */}
                <div className="flex min-w-0 flex-col">
                  <Rotulo htmlFor="montoFinal">Total con descuento</Rotulo>
                  <output
                    id="montoFinal"
                    htmlFor="montoBruto"
                    aria-live="polite"
                    className="flex h-[72px] items-center gap-2.5 rounded-[22px] border-2 border-[var(--venta-azul-borde)] bg-[var(--venta-azul-humo)] px-4"
                  >
                    <span className="font-mono text-[22px] font-bold text-[var(--venta-azul)]/60">
                      S/
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate font-mono text-[28px] font-bold tabular-nums ${
                        desglose
                          ? "text-[var(--venta-azul)]"
                          : "text-[var(--venta-azul)]/35"
                      }`}
                    >
                      {desglose
                        ? formatearSoles(desglose.final).replace("S/ ", "")
                        : "0.00"}
                    </span>
                  </output>
                  {desglose ? (
                    <p className="mt-3 font-mono text-[13px] text-[var(--venta-gris)] tabular-nums">
                      {formatearSoles(desglose.bruto)}
                      <span className="mx-1.5 text-[var(--venta-gris-claro)]">
                        −
                      </span>
                      {formatearSoles(desglose.descuento)}
                      <span className="ml-1.5 text-[var(--venta-azul)]">
                        ({bpsAPorcentaje(bpsEfectivo ?? 0)}%)
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </PasoTarjeta>

          {/* ── Paso 3: comprobante ── */}
          <PasoTarjeta
            numero={3}
            titulo="Comprobante y evidencia"
            descripcion="Adjunta el documento de venta y evidencia adicional."
            activo={pasoDosListo && !pasoTresListo}
            hecho={pasoTresListo}
            bloqueado={!pasoUnoListo}
          >
            {notaArchivosRestaurados ? (
              <Alert className="mb-4">
                <AlertDescription>{notaArchivosRestaurados}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
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
              <p className="text-destructive mt-3 text-[13px] font-semibold">
                Esta empresa exige al menos una evidencia adicional.
              </p>
            ) : null}

            <div className="mt-5 flex flex-col">
              <Rotulo htmlFor="observacion">
                Observación{" "}
                <span className="font-medium text-[var(--venta-gris-claro)]">
                  Opcional
                </span>
              </Rotulo>
              <Textarea
                id="observacion"
                name="observacion"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Añade información relevante sobre la venta, el empleado o el comprobante…"
                className="min-h-[104px] rounded-[18px] border-2 border-[var(--venta-linea)] bg-[var(--venta-papel)] px-4 py-3 text-base placeholder:text-[var(--venta-gris-claro)]"
              />
            </div>
          </PasoTarjeta>

          {errorEnvio ? (
            <p role="alert" className="text-destructive text-sm">
              {errorEnvio}
            </p>
          ) : null}
        </div>

        {/* ── Resumen ── */}
        <aside className="hidden overflow-hidden rounded-[26px] bg-[var(--venta-papel)] lg:sticky lg:top-[96px] lg:block">
          <div className="px-6 pt-6 pb-5">
            <h2 className="text-[19px] font-bold tracking-[-0.01em]">
              Resumen
            </h2>
            <p className="mt-0.5 text-sm text-[var(--venta-gris)]">
              Verifica antes de registrar.
            </p>
            <div
              className="mt-4 flex items-center gap-1.5"
              role="img"
              aria-label={`Avance del registro: ${completados} de 3 pasos`}
            >
              {pasos.map((hecho, indice) => (
                <i
                  key={indice}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${hecho ? "bg-[var(--venta-azul)]" : "bg-[var(--venta-linea)]"}`}
                />
              ))}
              <b className="font-mono text-[12px] font-bold tracking-[0.1em] text-[var(--venta-gris)]">
                {completados} / 3
              </b>
            </div>
          </div>

          <div className="px-6 pb-5">
            <FilaResumen
              etiqueta="Empresa"
              valor={
                empresaSeleccionada?.empresaNombre ?? empleado?.empresaNombre
              }
              marcador="Por definir"
            />
            <FilaResumen
              etiqueta="Empleado"
              valor={
                empleado ? `${empleado.nombres} ${empleado.apellidos}` : null
              }
              marcador="Por definir"
            />
            <FilaResumen
              etiqueta="Sede"
              valor={sedes.find((s) => s.id === sedeId)?.nombre}
              marcador="Por definir"
            />
            <FilaResumen
              etiqueta="Fecha"
              valor={fechaVenta ? formatearFechaUI(fechaVenta) : null}
              marcador="Por definir"
            />
            <FilaResumen
              etiqueta="Comprobante"
              valor={documento ? "Adjunto" : null}
              marcador="Sin adjuntar"
            />
          </div>

          <div
            aria-live="polite"
            className="mx-[18px] mb-[18px] rounded-[22px] bg-[var(--venta-azul)] p-[22px] text-white"
          >
            <div className="flex justify-between py-0.5 font-mono text-sm text-white/90">
              <span>Monto de venta</span>
              <b className="font-bold text-white">
                {montoBrutoCentimos === null
                  ? "S/ 0.00"
                  : formatearSoles(montoBrutoCentimos)}
              </b>
            </div>
            <div className="flex justify-between py-0.5 font-mono text-sm text-white/90">
              <span>Descuento convenio</span>
              <b className="font-bold text-white">
                − {preview ? formatearSoles(preview.descuento) : "S/ 0.00"}
              </b>
            </div>
            <div className="my-3.5 h-px bg-white/25" />
            {/* Apilado, no en línea: la columna mide 372 px y en Courier un
                importe de cinco cifras no cabe junto al rótulo. */}
            <div>
              <span className="block font-mono text-[12px] font-bold tracking-[0.14em] text-white/90 uppercase">
                Total final
              </span>
              <p className="mt-2 font-mono text-[clamp(28px,3vw,36px)] leading-none font-bold tracking-[-0.02em] tabular-nums">
                {preview ? formatearSoles(preview.final) : "S/ 0.00"}
              </p>
            </div>
          </div>

          <div className="px-6 pb-6">
            <Button
              type="submit"
              disabled={!puedeGuardar}
              className="h-[58px] w-full rounded-full bg-[var(--venta-azul)] text-base font-semibold text-white hover:bg-[var(--venta-azul-hondo)] disabled:bg-[var(--venta-hueco)] disabled:text-[var(--venta-gris-claro)]"
            >
              {pendiente ? "Guardando…" : "Guardar venta"}
            </Button>
            <p className="mt-3 text-center text-[13px] leading-snug text-[var(--venta-gris)]">
              {faltante}
            </p>
          </div>
        </aside>
      </form>

      {/* ── Barra inferior móvil (PWA) ── */}
      <div className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <Button
          type="button"
          size="lg"
          disabled={!puedeGuardar}
          onClick={() => setResumenAbierto(true)}
          className="h-14 w-full rounded-full bg-[var(--venta-azul)] text-base font-semibold text-white shadow-[var(--venta-azul)]/20 shadow-lg hover:bg-[var(--venta-azul-hondo)] disabled:bg-[var(--venta-hueco)] disabled:text-[var(--venta-gris-claro)]"
        >
          Revisar venta
        </Button>
      </div>

      <Sheet open={resumenAbierto} onOpenChange={setResumenAbierto}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className={`venta-shell gap-0 rounded-t-[26px] px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] ${claseFuentes}`}
        >
          <SheetHeader className="p-0 text-left">
            <SheetTitle className="text-[19px] font-bold tracking-[-0.01em]">
              Revisa la venta
            </SheetTitle>
            <p className="text-sm text-[var(--venta-gris)]">
              Confirma los datos antes de registrarla.
            </p>
          </SheetHeader>
          <div className="my-5">
            <FilaResumen
              etiqueta="Empleado"
              valor={
                empleado ? `${empleado.nombres} ${empleado.apellidos}` : null
              }
              marcador="—"
            />
            <FilaResumen
              etiqueta="Sede"
              valor={sedes.find((s) => s.id === sedeId)?.nombre}
              marcador="—"
            />
            <FilaResumen
              etiqueta="Monto de venta"
              valor={
                montoBrutoCentimos === null
                  ? null
                  : formatearSoles(montoBrutoCentimos)
              }
              marcador="—"
            />
            <FilaResumen
              etiqueta="Descuento convenio"
              valor={preview ? `− ${formatearSoles(preview.descuento)}` : null}
              marcador="—"
            />
          </div>
          <div className="mb-5 flex items-baseline justify-between gap-3 rounded-[22px] bg-[var(--venta-azul)] px-5 py-4 text-white">
            <span className="shrink-0 font-mono text-[12px] font-bold tracking-[0.14em] text-white/75 uppercase">
              Total final
            </span>
            <span className="font-mono text-[clamp(24px,7vw,30px)] leading-none font-bold tracking-[-0.02em] tabular-nums">
              {preview ? formatearSoles(preview.final) : "S/ 0.00"}
            </span>
          </div>
          <Button
            type="submit"
            form="form-venta"
            size="lg"
            disabled={!puedeGuardar}
            className="h-14 w-full rounded-full bg-[var(--venta-azul)] text-base font-semibold text-white hover:bg-[var(--venta-azul-hondo)] disabled:bg-[var(--venta-hueco)] disabled:text-[var(--venta-gris-claro)]"
          >
            {pendiente ? "Guardando…" : "Confirmar y guardar"}
          </Button>
        </SheetContent>
      </Sheet>
    </section>
  );
}

/**
 * Tarjeta de paso. `activo` marca el paso en curso con borde azul, `hecho`
 * pone el número en verde y `bloqueado` lo atenúa y lo saca de la interacción
 * mientras no se cumpla el requisito previo (los `input` siguen enviándose).
 */
function PasoTarjeta({
  numero,
  titulo,
  descripcion,
  activo = false,
  hecho = false,
  bloqueado = false,
  children,
}: {
  numero: number;
  titulo: string;
  descripcion: string;
  activo?: boolean;
  hecho?: boolean;
  bloqueado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      // `inert` (no solo `pointer-events`) también saca el paso del foco por
      // teclado y del árbol de accesibilidad; los `input` se siguen enviando.
      inert={bloqueado}
      className={`rounded-[26px] border-2 bg-[var(--venta-papel)] p-5 transition-[border-color,opacity] duration-200 sm:p-7 ${
        activo && !bloqueado
          ? "border-[var(--venta-azul-borde)]"
          : "border-transparent"
      } ${bloqueado ? "opacity-50" : ""}`}
    >
      <div className="mb-6 flex items-center gap-3.5">
        <span
          className={`grid size-[34px] shrink-0 place-items-center rounded-full font-mono text-[15px] font-bold transition-colors ${
            hecho
              ? "bg-success text-success-foreground"
              : activo && !bloqueado
                ? "bg-[var(--venta-azul)] text-white"
                : "bg-[var(--venta-hueco)] text-[var(--venta-gris)]"
          }`}
        >
          {hecho ? <Check className="size-4" strokeWidth={3} /> : numero}
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold tracking-[-0.01em] sm:text-[19px]">
            {titulo}
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--venta-gris)] sm:text-sm">
            {descripcion}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Rotulo({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="mb-2 block text-[13px] font-semibold text-[var(--venta-gris)]"
    >
      {children}
    </Label>
  );
}

/** Campo de solo lectura del paso 1: hueco gris hasta que la búsqueda responde. */
function CampoSoloLectura({
  rotulo,
  htmlFor,
  valor,
  marcador,
}: {
  rotulo: string;
  htmlFor: string;
  valor: string;
  marcador: string;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <Rotulo htmlFor={htmlFor}>{rotulo}</Rotulo>
      <input
        id={htmlFor}
        value={valor}
        placeholder={marcador}
        readOnly
        tabIndex={-1}
        className={`h-[58px] min-w-0 truncate rounded-[18px] bg-[var(--venta-hueco)] px-4 text-base outline-none placeholder:font-normal placeholder:text-[var(--venta-gris-claro)] ${valor ? "font-semibold" : ""}`}
      />
    </div>
  );
}

function FilaResumen({
  etiqueta,
  valor,
  marcador,
}: {
  etiqueta: string;
  valor: string | null | undefined;
  marcador: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 border-b border-[var(--venta-linea)] py-2.5 text-sm last:border-b-0">
      <span className="shrink-0 text-[var(--venta-gris)]">{etiqueta}</span>
      <strong
        className={`truncate text-right ${valor ? "font-semibold" : "font-normal text-[var(--venta-gris-claro)]"}`}
      >
        {valor || marcador}
      </strong>
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
        {/* Enlaces reales: Base UI espera un `<button>` nativo en `render`
            y avisa por consola al recibir un `<a>` (issue #52). */}
        <Link
          href={`/ventas/${venta.ventaId}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Ver detalle
        </Link>
        <Link href="/" className={buttonVariants({ variant: "ghost" })}>
          Ir al inicio
        </Link>
      </div>
    </section>
  );
}
