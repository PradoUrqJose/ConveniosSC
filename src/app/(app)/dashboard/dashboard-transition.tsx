"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  use,
  useCallback,
  useTransition,
  type ReactNode,
} from "react";

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
    <div
      className="relative transition-opacity duration-200 motion-reduce:transition-none"
      aria-busy={pendiente}
      aria-live="polite"
      aria-label={pendiente ? "Actualizando datos del dashboard" : undefined}
      data-actualizando={pendiente}
    >
      <div className={pendiente ? "pointer-events-none opacity-45" : undefined}>
        {children}
      </div>
    </div>
  );
}
