import { Skeleton } from "@/components/ui/skeleton";

type Variante =
  | "inicio"
  | "inicio-vendedor"
  | "tabla"
  | "dashboard"
  | "formulario"
  | "nueva-venta"
  | "detalle"
  | "login"
  | "ventas"
  | "empleados"
  | "sedes"
  | "usuarios"
  | "empresas"
  | "convenios"
  | "auditoria"
  | "perfil"
  | "password";

function Cabecera() {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-9 w-28" />
    </div>
  );
}

function Tabla() {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="bg-muted/40 flex gap-5 border-b px-4 py-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="ml-auto h-4 w-20" />
      </div>
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-5 border-b px-4 py-4 last:border-0"
        >
          <Skeleton className="size-9 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-5 w-20 sm:block" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

function Formulario() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Cabecera />
      <div className="space-y-5 rounded-xl border p-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="ml-auto h-10 w-32" />
      </div>
    </div>
  );
}

function Dashboard() {
  return (
    <section
      aria-busy="true"
      className="page-shell animate-in fade-in-0 space-y-5 duration-300 motion-reduce:animate-none"
    >
      <span className="sr-only" role="status">
        Cargando dashboard
      </span>
      <div aria-hidden="true" className="space-y-5">
        <div className="bg-primary/10 relative grid gap-6 overflow-hidden rounded-[1.25rem] px-4 py-5 shadow-[0_24px_65px_rgba(29,78,216,.22)] sm:rounded-[1.75rem] sm:px-7 sm:py-8 md:grid-cols-[1fr_22rem] lg:px-9">
          <div>
            <Skeleton className="h-3 w-48" />
            <Skeleton className="mt-3 h-9 w-64 sm:h-10" />
            <Skeleton className="mt-3 h-4 w-full max-w-xl" />
          </div>
          <div className="space-y-2.5">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="space-y-3 rounded-[1.25rem] border p-4 sm:p-5"
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-24" />
            </div>
          ))}
        </div>
        <div className="surface-panel p-4 sm:p-6">
          <Skeleton className="mb-5 h-5 w-40" />
          <Skeleton className="h-64 w-full rounded-xl lg:h-72" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="surface-panel space-y-3 p-4 sm:p-6">
              <Skeleton className="h-5 w-40" />
              {Array.from({ length: 3 }, (_, row) => (
                <Skeleton key={row} className="h-10 w-full" />
              ))}
            </div>
          ))}
        </div>
        <div className="surface-panel space-y-3 p-4 sm:p-6">
          <Skeleton className="h-5 w-48" />
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </section>
  );
}

function InicioVendedor() {
  return (
    <section
      aria-busy="true"
      className="page-shell animate-in fade-in-0 duration-300 motion-reduce:animate-none"
    >
      <span className="sr-only" role="status">
        Cargando inicio
      </span>
      <div aria-hidden="true" className="contents">
        {/* Hero: mismo radio, relleno y alto que src/app/(app)/page.tsx. */}
        <div className="bg-primary/10 relative overflow-hidden rounded-[1.25rem] px-4 py-4 shadow-[0_24px_65px_rgba(29,78,216,.22)] sm:rounded-[1.75rem] sm:px-7 sm:py-8 lg:px-9">
          <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
            <div className="space-y-2 sm:space-y-3">
              <Skeleton className="hidden h-3.5 w-40 bg-white/25 sm:block" />
              <Skeleton className="h-7 w-44 bg-white/25 sm:h-10 sm:w-64" />
              <Skeleton className="h-4 w-56 bg-white/20 sm:h-5 sm:w-72" />
            </div>
            <Skeleton className="hidden h-16 w-60 rounded-2xl bg-white/25 sm:block md:min-w-60" />
          </div>
        </div>

        {/* Cuatro métricas: misma grilla y card que <Metrica />. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="bg-card/90 ring-foreground/7 relative min-w-0 overflow-hidden rounded-[1.25rem] p-3.5 shadow-[0_10px_30px_rgba(15,23,42,.045)] ring-1 sm:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-3 w-16 sm:h-3.5 sm:w-20" />
                <Skeleton className="size-7 shrink-0 rounded-lg sm:size-9 sm:rounded-xl" />
              </div>
              <Skeleton className="mt-2.5 h-6 w-20 sm:mt-3 sm:h-7 sm:w-24" />
              <Skeleton className="mt-1.5 hidden h-3 w-24 sm:mt-2 sm:block" />
            </div>
          ))}
        </div>

        {/* Panel de ventas recientes: cabecera + cinco filas. */}
        <div className="surface-panel">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="hidden h-3 w-40 sm:block" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:px-6 sm:py-4"
              >
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Tarjeta de paso del formulario de venta: mismo radio, padding y cabecera
 * (círculo de número + título + descripción) que `PasoTarjeta` en
 * `form-venta.tsx`. */
function TarjetaPasoSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] border-2 border-transparent bg-[var(--venta-papel)] p-5 sm:p-7">
      <div className="mb-6 flex items-center gap-3.5">
        <Skeleton className="size-[34px] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-40 sm:h-[19px]" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      {children}
    </section>
  );
}

function NuevaVenta() {
  return (
    <section
      aria-busy="true"
      className="venta-shell animate-in fade-in-0 flex flex-col gap-6 pb-6 duration-300"
    >
      <span className="sr-only" role="status">
        Cargando nueva venta
      </span>
      <div aria-hidden="true" className="contents">
        {/* ── Barra superior: mismo layout que el <header> real. ── */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-[22px] w-64" />
          </div>
          <Skeleton className="h-[42px] w-48 rounded-full" />
        </header>

        {/* ── Misma grilla que el <form>: 1fr + aside de 372px desde lg. ── */}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_372px]">
          <div className="flex min-w-0 flex-col gap-4">
            {/* Paso 1: documento del empleado */}
            <TarjetaPasoSkeleton>
              <div className="flex flex-wrap items-center gap-2.5">
                <Skeleton className="h-[50px] w-20 shrink-0 rounded-full sm:h-[58px]" />
                <Skeleton className="h-[50px] min-w-0 flex-1 basis-64 rounded-2xl sm:h-[58px]" />
                <Skeleton className="h-[50px] w-[50px] shrink-0 rounded-full sm:h-[58px] sm:w-[132px]" />
              </div>
              <Skeleton className="mt-3 h-3 w-52" />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-[58px] rounded-[18px]" />
                <Skeleton className="h-[58px] rounded-[18px]" />
              </div>
            </TarjetaPasoSkeleton>

            {/* Paso 2: sede, fecha e importe */}
            <TarjetaPasoSkeleton>
              <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-[58px] rounded-[18px]" />
                <Skeleton className="h-[58px] rounded-[18px]" />
                <div className="grid min-w-0 gap-4 sm:col-span-2 sm:grid-cols-2">
                  <Skeleton className="h-[72px] rounded-[22px]" />
                  <Skeleton className="h-[72px] rounded-[22px]" />
                </div>
              </div>
            </TarjetaPasoSkeleton>

            {/* Paso 3: comprobante, evidencia y observación */}
            <TarjetaPasoSkeleton>
              <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-[154px] rounded-[22px] lg:h-[192px]" />
                <Skeleton className="h-[154px] rounded-[22px] lg:h-[192px]" />
              </div>
              <Skeleton className="mt-5 h-[104px] rounded-[18px]" />
            </TarjetaPasoSkeleton>
          </div>

          {/* ── Resumen: aside fijo de 372px desde lg, igual que el real. ── */}
          <div className="hidden overflow-hidden rounded-[26px] border bg-[var(--venta-papel)] lg:sticky lg:top-[96px] lg:block">
            <div className="space-y-3 px-6 pt-6 pb-5">
              <Skeleton className="h-[19px] w-28" />
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
            </div>
            <div className="space-y-3 px-6 pb-5">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </div>
            <Skeleton className="mx-[18px] mb-[18px] h-[136px] rounded-[22px]" />
            <div className="px-6 pb-6">
              <Skeleton className="h-[58px] w-full rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Barra inferior móvil: solo por debajo de lg, como en el real. ── */}
      <div
        aria-hidden="true"
        className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      >
        <Skeleton className="h-14 w-full rounded-full" />
      </div>
    </section>
  );
}

function Login() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#f5f7ff] px-4 py-6 sm:py-8">
      <div className="bg-card w-full max-w-4xl overflow-hidden rounded-3xl border shadow-2xl lg:grid lg:grid-cols-[1.05fr_.95fr]">
        <aside className="bg-primary/90 hidden min-h-[570px] p-9 lg:flex lg:flex-col">
          <Skeleton className="size-11 rounded-2xl bg-white/20" />
          <div className="mt-auto space-y-4">
            <Skeleton className="h-4 w-40 bg-white/20" />
            <Skeleton className="h-10 w-64 bg-white/25" />
            <Skeleton className="h-4 w-full max-w-sm bg-white/20" />
          </div>
        </aside>
        <div className="flex min-h-[500px] flex-col justify-center gap-6 px-6 py-8 sm:px-10 lg:min-h-[570px] lg:py-9">
          <div className="space-y-3">
            <Skeleton className="h-10 w-10 rounded-xl lg:hidden" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  );
}

function CabeceraPaginaSkeleton({ accion = true }: { accion?: boolean }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72 max-w-[75vw]" />
      </div>
      {accion ? <Skeleton className="h-10 w-36 rounded-xl" /> : null}
    </header>
  );
}

function MetricasSkeleton({
  columnas = "lg:grid-cols-4",
}: {
  columnas?: string;
}) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${columnas}`}>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="bg-card/90 ring-foreground/7 rounded-[1.25rem] p-3.5 shadow-sm ring-1 sm:p-5"
        >
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="size-7 rounded-lg sm:size-9 sm:rounded-xl" />
          </div>
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-2 hidden h-3 w-28 sm:block" />
        </div>
      ))}
    </div>
  );
}

function TarjetaCatalogo({
  tipo,
}: {
  tipo: "sede" | "usuario" | "empresa" | "convenio";
}) {
  if (tipo === "convenio") {
    return (
      <div className="bg-card/90 space-y-4 rounded-[1.4rem] p-5 shadow-sm sm:p-6">
        <div className="flex justify-between gap-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-4 w-36" />
        <div className="flex gap-2 border-t pt-4">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>
    );
  }
  if (tipo === "empresa") {
    return (
      <div className="bg-card/90 space-y-4 rounded-[1.35rem] p-5 shadow-sm">
        <div className="flex justify-between gap-3">
          <div className="flex gap-2.5">
            <Skeleton className="size-9 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-16" />
      </div>
    );
  }
  if (tipo === "usuario") {
    return (
      <div className="bg-card/90 rounded-[1.35rem] p-5 shadow-sm">
        <div className="flex justify-between gap-3">
          <div className="flex gap-3">
            <Skeleton className="size-11 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
        <div className="mt-4 flex gap-2 border-t pt-4">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    );
  }
  return (
    <div className="bg-card/90 space-y-4 rounded-[1.35rem] p-5 shadow-sm">
      <div className="flex justify-between gap-3">
        <div className="flex gap-2">
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

function Catalogo({
  tipo,
}: {
  tipo: "sedes" | "usuarios" | "empresas" | "convenios";
}) {
  const config = {
    sedes: {
      tarjeta: "sede" as const,
      grid: "sm:grid-cols-2 xl:grid-cols-3",
      accion: true,
      buscador: false,
    },
    usuarios: {
      tarjeta: "usuario" as const,
      grid: "xl:grid-cols-2",
      accion: true,
      buscador: true,
    },
    empresas: {
      tarjeta: "empresa" as const,
      grid: "md:grid-cols-2 xl:grid-cols-3",
      accion: true,
      buscador: true,
    },
    convenios: {
      tarjeta: "convenio" as const,
      grid: "xl:grid-cols-2",
      accion: true,
      buscador: false,
    },
  }[tipo];
  return (
    <section className="page-shell space-y-5">
      <CabeceraPaginaSkeleton accion={config.accion} />
      {tipo === "sedes" ? <MetricasSkeleton columnas="" /> : null}
      {config.buscador ? (
        <div className="control-bar flex gap-2">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 w-24 rounded-xl" />
        </div>
      ) : null}
      <div className={`grid grid-cols-1 gap-4 ${config.grid}`}>
        {Array.from({ length: 6 }, (_, index) => (
          <TarjetaCatalogo key={index} tipo={config.tarjeta} />
        ))}
      </div>
    </section>
  );
}

function Ventas() {
  return (
    <section className="page-shell space-y-5">
      <CabeceraPaginaSkeleton />
      <div className="control-bar flex gap-2">
        <Skeleton className="h-11 flex-1 rounded-xl" />
        <Skeleton className="h-11 w-11 rounded-xl" />
      </div>
      <MetricasSkeleton />
      <div className="lg:hidden">
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, index) => (
            <TarjetaCatalogo key={index} tipo="usuario" />
          ))}
        </div>
      </div>
      <div className="hidden overflow-hidden rounded-2xl border lg:block">
        <div className="bg-muted/45 h-12 border-b" />
        {Array.from({ length: 7 }, (_, index) => (
          <div
            key={index}
            className="flex h-[72px] items-center gap-6 border-b px-5"
          >
            <Skeleton className="h-8 w-16" />
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        ))}
      </div>
    </section>
  );
}

function Empleados() {
  return (
    <section className="page-shell space-y-5">
      <CabeceraPaginaSkeleton />
      <MetricasSkeleton columnas="sm:grid-cols-2 xl:grid-cols-4" />
      <div className="bg-card overflow-hidden rounded-2xl border">
        <div className="space-y-3 border-b p-4 lg:flex lg:items-center lg:justify-between lg:space-y-0">
          <Skeleton className="h-10 w-full lg:w-[360px]" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex h-12 gap-6 border-b px-4">
          <Skeleton className="h-4 w-20 self-center" />
          <Skeleton className="h-4 w-20 self-center" />
          <Skeleton className="h-4 w-20 self-center" />
        </div>
        <div className="divide-y lg:hidden">
          {Array.from({ length: 5 }, (_, index) => (
            <TarjetaCatalogo key={index} tipo="usuario" />
          ))}
        </div>
        <div className="hidden lg:block">
          <div className="bg-muted/45 h-12" />
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex h-[76px] items-center gap-5 px-5">
              <Skeleton className="size-4" />
              <Skeleton className="size-10 rounded-xl" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Auditoria() {
  return (
    <section className="page-shell space-y-5">
      <CabeceraPaginaSkeleton />
      <div className="control-bar grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_1.2fr_auto]">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-11 rounded-xl" />
        ))}
      </div>
      <ol className="surface-panel divide-y px-5 sm:px-6">
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index} className="relative space-y-2 py-5 pl-5">
            <Skeleton className="absolute top-6 left-0 size-2.5 rounded-full" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
            {index % 2 === 0 ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Perfil() {
  return (
    <section className="flex flex-col gap-6">
      <CabeceraPaginaSkeleton accion={false} />
      <div className="rounded-xl border p-5">
        <div className="flex gap-4">
          <Skeleton className="size-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-36 rounded-full" />
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-5 h-10 w-44 border-t pt-5" />
      </div>
    </section>
  );
}

function Password() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10">
      <div className="bg-card w-full max-w-[460px] rounded-[1.6rem] border px-6 py-7 shadow-sm sm:px-8">
        <Skeleton className="size-12 rounded-2xl" />
        <div className="mt-5 space-y-3">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="mt-6 space-y-4">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </main>
  );
}

function DetalleVenta() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-10">
      <Skeleton className="h-9 w-32 rounded-xl" />
      <div className="bg-primary/90 rounded-[1.6rem] p-5 sm:p-7">
        <Skeleton className="h-3 w-28 bg-white/25" />
        <Skeleton className="mt-3 h-10 w-48 bg-white/25" />
        <Skeleton className="mt-3 h-3 w-36 bg-white/20" />
      </div>
      <div className="surface-panel flex gap-4 p-5 sm:p-6">
        <Skeleton className="size-11 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="surface-panel space-y-3 p-5 sm:p-6">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: index === 2 ? 3 : 4 }, (_, row) => (
            <Skeleton key={row} className="h-9 w-full" />
          ))}
        </div>
      ))}
    </section>
  );
}

function LoadingRegion({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">
        Cargando {etiqueta}
      </span>
      <div aria-hidden="true" className="contents">
        {children}
      </div>
    </div>
  );
}

export function PageSkeleton({ variante = "tabla" }: { variante?: Variante }) {
  let contenido: React.ReactNode;
  if (variante === "login") contenido = <Login />;
  else if (variante === "inicio-vendedor" || variante === "inicio")
    contenido = <InicioVendedor />;
  else if (variante === "dashboard") contenido = <Dashboard />;
  else if (variante === "formulario") contenido = <Formulario />;
  else if (variante === "nueva-venta") contenido = <NuevaVenta />;
  else if (variante === "detalle") contenido = <DetalleVenta />;
  else if (variante === "ventas") contenido = <Ventas />;
  else if (variante === "empleados") contenido = <Empleados />;
  else if (
    variante === "sedes" ||
    variante === "usuarios" ||
    variante === "empresas" ||
    variante === "convenios"
  )
    contenido = <Catalogo tipo={variante} />;
  else if (variante === "auditoria") contenido = <Auditoria />;
  else if (variante === "perfil") contenido = <Perfil />;
  else if (variante === "password") contenido = <Password />;
  else
    contenido = (
      <section className="page-shell space-y-5">
        <CabeceraPaginaSkeleton />
        <div className="control-bar flex gap-2">
          <Skeleton className="h-11 flex-1" />
          <Skeleton className="h-11 w-24" />
        </div>
        <Tabla />
      </section>
    );

  return (
    <LoadingRegion etiqueta={variante.replaceAll("-", " ")}>
      {contenido}
    </LoadingRegion>
  );
}
