"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cerrarSesion } from "@/modules/auth/actions";
import { nombreRol } from "@/lib/navegacion";
import type { RolUsuario } from "@/lib/auth/sesion";
import type { PerfilNav } from "@/lib/auth/perfil";
import { cn } from "@/lib/utils";

export function Header({
  perfil,
  rol,
  className,
}: {
  perfil: PerfilNav;
  rol: RolUsuario;
  className?: string;
}) {
  const iniciales =
    `${perfil.nombres[0] ?? ""}${perfil.apellidos[0] ?? ""}`.toUpperCase();

  return (
    <header
      className={cn(
        "border-border bg-background/90 sticky top-0 z-40 flex h-14 items-center gap-3 border-b px-4 backdrop-blur supports-backdrop-filter:backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="text-lg font-semibold tracking-tight">Convenios</span>
        {perfil.empresaNombre ? (
          <span className="text-muted-foreground truncate text-sm">
            · {perfil.empresaNombre}
          </span>
        ) : null}
      </div>

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Abrir menú de usuario"
              className="size-11 rounded-full"
            />
          }
        >
          <Avatar size="default">
            <AvatarFallback>{iniciales || "U"}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <span className="block truncate">
              {perfil.nombres} {perfil.apellidos}
            </span>
            <span className="text-muted-foreground block truncate text-xs">
              {nombreRol(rol)}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            render={<form action={cerrarSesion} />}
          >
            <button type="submit" className="flex w-full items-center gap-1.5">
              <LogOut className="size-4" />
              Cerrar sesión
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
