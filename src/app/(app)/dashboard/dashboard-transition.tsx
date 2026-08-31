"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  use,
  useCallback,
  useTransition,
  type ReactNode,
} from "react";

import { Skeleton } from "@/components/ui/skeleton";

type NavegacionDashboard = {
  pendiente: boolean;
  navegar: (href: string) => void;
};

const ContextoNavegacionDashboard = createContext<NavegacionDashboard | null>(
  null,
);

/** Mantiene visible la lectura anterior mientras el RSC del nuevo filtro llega. */
export function DashboardTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const navegar = useCallback(
    (href: string) => startTransition(() => router.push(href)),
    [router],
  );

  return (
    <ContextoNavegacionDashboard value={{ pendiente, navegar }}>
      {children}
    </ContextoNavegacionDashboard>
  );
}

export function useNavegacionDashboard() {
  const contexto = use(ContextoNavegacionDashboard);
  if (!contexto) {
    throw new Error("useNavegacionDashboard requiere DashboardTransition.");
  }
  return contexto;
}

/** El contenido anterior conserva su tamaño, pero comunica que será renovado. */
export function DashboardDataRegion({ children }: { children: ReactNode }) {
  const { pendiente } = useNavegacionDashboard();
  return (
    <div className="relative" aria-busy={pendiente}>
      {pendiente ? <EsqueletoTransicionDashboard /> : children}
    </div>
  );
}

/** Misma geometría de los módulos reales mientras cambia la dirección. */
function EsqueletoTransicionDashboard() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3.5 sm:gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, indice) => (
          <Skeleton key={indice} className="h-24 rounded-[1.25rem] sm:h-28" />
        ))}
      </div>
      <div className="surface-panel p-4 sm:p-6">
        <Skeleton className="mb-5 h-5 w-48" />
        <Skeleton className="h-64 rounded-xl lg:h-72" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        {Array.from({ length: 4 }, (_, indice) => (
          <div key={indice} className="surface-panel space-y-3 p-4 sm:p-6">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 3 }, (_, fila) => (
              <Skeleton key={fila} className="h-10 w-full" />
            ))}
          </div>
        ))}
      </div>
      <div className="surface-panel space-y-3 p-4 sm:p-6">
        <Skeleton className="h-5 w-48" />
        {Array.from({ length: 5 }, (_, indice) => (
          <Skeleton key={indice} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
