"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

/** Cabecera mínima para el flujo concentrado de registro de ventas en PWA. */
export function CabeceraPuntoVenta() {
  return (
    <header className="border-border/70 bg-background/94 sticky top-0 z-40 flex items-center gap-1 border-b px-3 pt-[calc(0.375rem+env(safe-area-inset-top))] pb-1.5 backdrop-blur-xl supports-backdrop-filter:backdrop-blur-sm">
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label="Volver a ventas"
        className="rounded-full"
        render={<Link href="/ventas" />}
      >
        <ArrowLeft className="size-5" />
      </Button>
      <h1 className="text-foreground min-w-0 flex-1 truncate text-[17px] font-bold tracking-tight">
        Registrar venta
      </h1>
      <ThemeToggle />
    </header>
  );
}
