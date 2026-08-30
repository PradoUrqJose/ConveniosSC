import { Skeleton } from "@/components/ui/skeleton";

type Variante =
  | "inicio"
  | "inicio-vendedor"
  | "tabla"
  | "dashboard"
  | "formulario"
  | "detalle"
  | "login";

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
    <div className="space-y-5">
      <Cabecera />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-xl border p-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-4">
        <Skeleton className="mb-5 h-5 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

function InicioVendedor() {
  return (
    <section
      aria-busy="true"
      className="page-shell animate-in fade-in-0 duration-300"
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

function Detalle() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Skeleton className="h-5 w-20" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-3/5" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="space-y-4 border-y py-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex justify-between gap-8">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function Login() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-[400px] space-y-6 rounded-xl border p-6">
        <div className="mx-auto space-y-2 text-center">
          <Skeleton className="mx-auto h-7 w-32" />
          <Skeleton className="mx-auto h-4 w-64" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </main>
  );
}

export function PageSkeleton({ variante = "tabla" }: { variante?: Variante }) {
  if (variante === "login") return <Login />;
  if (variante === "inicio-vendedor") return <InicioVendedor />;
  if (variante === "dashboard") return <Dashboard />;
  if (variante === "formulario") return <Formulario />;
  if (variante === "detalle") return <Detalle />;

  return (
    <section className="animate-in fade-in-0 space-y-5 duration-300">
      <Cabecera />
      {variante === "inicio" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="space-y-4 rounded-xl border p-5">
              <Skeleton className="size-10" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-24" />
          </div>
          <Tabla />
        </>
      )}
    </section>
  );
}
