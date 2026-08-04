"use client";

import { WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function PaginaSinConexion() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <div className="bg-muted flex size-14 items-center justify-center rounded-full">
        <WifiOff className="text-muted-foreground size-6" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Sin conexión</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          No se pudo cargar esta página porque no hay conexión a internet. Los
          datos de ventas y empleados nunca se guardan en el dispositivo, así
          que necesitas conexión para verlos o registrarlos.
        </p>
      </div>
      <Button onClick={() => window.location.reload()}>Reintentar</Button>
    </main>
  );
}
