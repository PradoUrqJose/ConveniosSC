"use client";

import { useEffect, type RefObject } from "react";

type EstadoConError = {
  ok: boolean;
  mensaje?: string;
  campo?: string;
};

/**
 * Vincula el error devuelto por una Server Action con su control y lleva el
 * foco allí. Los formularios pueden seguir devolviendo errores generales si
 * no existe un campo concreto.
 */
export function useDialogFormError(
  estado: EstadoConError,
  formulario: RefObject<HTMLFormElement | null>,
  errorId: string,
) {
  useEffect(() => {
    const form = formulario.current;
    if (!form || estado.ok || !estado.mensaje) return;

    const campo = estado.campo;
    if (!campo) {
      const alerta = document.getElementById(errorId);
      alerta?.setAttribute("tabindex", "-1");
      alerta?.focus();
      return;
    }

    const control = form.elements.namedItem(campo);
    const controlVisible =
      control instanceof HTMLInputElement && control.type === "hidden"
        ? (document.getElementById(campo) ??
          document.getElementById(campo.replace(/Id$/, "")))
        : control;
    if (!(controlVisible instanceof HTMLElement)) {
      const alerta = document.getElementById(errorId);
      alerta?.setAttribute("tabindex", "-1");
      alerta?.focus();
      return;
    }

    controlVisible.setAttribute("aria-invalid", "true");
    controlVisible.setAttribute("aria-describedby", errorId);
    controlVisible.focus();

    return () => {
      controlVisible.removeAttribute("aria-invalid");
      controlVisible.removeAttribute("aria-describedby");
    };
  }, [errorId, estado, formulario]);
}
