"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

type Tema = "light" | "dark";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): Tema {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Tema {
  return "light";
}

function fijarTema(siguiente: Tema) {
  document.documentElement.classList.toggle("dark", siguiente === "dark");
  window.localStorage.setItem("theme", siguiente);
  listeners.forEach((listener) => listener());
}

export function ThemeToggle() {
  const tema = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function alternar() {
    fijarTema(tema === "dark" ? "light" : "dark");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={alternar}
      aria-label="Cambiar tema"
      className="size-11"
    >
      {tema === "dark" ? (
        <Sun className="size-5" />
      ) : (
        <Moon className="size-5" />
      )}
    </Button>
  );
}
