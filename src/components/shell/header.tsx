"use client";

import Link from "next/link";
import { Download, KeyRound, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CambiarPasswordDialog } from "@/components/auth/cambiar-password-dialog";
import { cerrarSesion } from "@/modules/auth/actions";
import { estaActivo, navegacionPorRol, nombreRol } from "@/lib/navegacion";
import type { RolUsuario } from "@/lib/auth/sesion";
import type { PerfilNav } from "@/lib/auth/perfil";
import { cn } from "@/lib/utils";
import { Marca } from "@/components/shell/marca";

export function Header({
  perfil,
  rol,
  className,
  tituloSecundario,
}: {
  perfil: PerfilNav;
  rol: RolUsuario;
  className?: string;
  tituloSecundario?: string;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [dialogoPasswordAbierto, setDialogoPasswordAbierto] = useState(false);
  const [puedeInstalar, setPuedeInstalar] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const iniciales =
    `${perfil.nombres[0] ?? ""}${perfil.apellidos[0] ?? ""}`.toUpperCase();

  useEffect(() => {
    const instalada =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        Boolean(
          (navigator as Navigator & { standalone?: boolean }).standalone,
        ));
    const temporizadorInstalacion = window.setTimeout(
      () => setPuedeInstalar(!instalada),
      0,
    );

    function cerrarAlSalir(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuAbierto(false);
      }
    }

    function cerrarConEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuAbierto(false);
      }
    }

    document.addEventListener("mousedown", cerrarAlSalir);
    document.addEventListener("keydown", cerrarConEscape);
    return () => {
      window.clearTimeout(temporizadorInstalacion);
      document.removeEventListener("mousedown", cerrarAlSalir);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, []);

  const destinos = navegacionPorRol(rol);
  const destinoActual = [...destinos.lateral, ...destinos.mas].find((destino) =>
    estaActivo(pathname, destino.href),
  );
  const tituloContexto = tituloSecundario ?? destinoActual?.etiqueta ?? "Panel";

  return (
    <header
      className={cn(
        "border-border/70 bg-background/78 sticky top-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-3 border-b px-4 pt-[env(safe-area-inset-top)] backdrop-blur-2xl lg:h-[76px] lg:px-8 lg:pt-0",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Marca className="lg:hidden" />
        <div className="hidden min-w-0 lg:block">
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.15em] uppercase">
            {perfil.empresaNombre ?? "Administración general"}
          </p>
          <p className="mt-0.5 truncate text-sm font-bold tracking-tight">
            {tituloContexto}
          </p>
        </div>
      </div>

      <ThemeToggle className="text-muted-foreground hover:bg-muted hover:text-foreground size-10 rounded-[11px]" />

      <div ref={menuRef} className="relative">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label="Abrir menú de usuario"
          aria-haspopup="menu"
          aria-expanded={menuAbierto}
          className="size-11 rounded-full"
          onClick={() => setMenuAbierto((abierto) => !abierto)}
        >
          <Avatar size="default">
            <AvatarFallback>{iniciales || "U"}</AvatarFallback>
          </Avatar>
        </Button>

        {menuAbierto ? (
          <div
            role="menu"
            aria-label="Menú de usuario"
            className="bg-popover text-popover-foreground ring-foreground/10 absolute top-[calc(100%+0.5rem)] right-0 z-50 w-64 overflow-hidden rounded-xl p-1 shadow-lg ring-1"
          >
            <div className="px-3 py-2.5">
              <p className="truncate text-sm font-semibold">
                {perfil.nombres} {perfil.apellidos}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {nombreRol(rol)}
              </p>
              {perfil.empresaNombre ? (
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {perfil.empresaNombre}
                </p>
              ) : null}
            </div>
            <div className="bg-border mx-1 h-px" />
            <Link
              href="/perfil/password"
              role="menuitem"
              onClick={() => setMenuAbierto(false)}
              className="hover:bg-muted focus-visible:bg-muted flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium outline-none lg:hidden"
            >
              <KeyRound className="size-4" />
              Cambiar contraseña
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuAbierto(false);
                setDialogoPasswordAbierto(true);
              }}
              className="hover:bg-muted focus-visible:bg-muted hidden h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium outline-none lg:flex"
            >
              <KeyRound className="size-4" />
              Cambiar contraseña
            </button>
            {puedeInstalar ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuAbierto(false);
                  window.dispatchEvent(
                    new Event("convenios:mostrar-instalacion"),
                  );
                }}
                className="hover:bg-muted focus-visible:bg-muted flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium outline-none"
              >
                <Download className="size-4" />
                Instalar aplicación
              </button>
            ) : null}
            <form action={cerrarSesion}>
              <button
                type="submit"
                role="menuitem"
                className="text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10 flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium outline-none"
              >
                <LogOut className="size-4" />
                Cerrar sesión
              </button>
            </form>
          </div>
        ) : null}
      </div>
      <CambiarPasswordDialog
        abierto={dialogoPasswordAbierto}
        alCambiarAbierto={setDialogoPasswordAbierto}
      />
    </header>
  );
}
