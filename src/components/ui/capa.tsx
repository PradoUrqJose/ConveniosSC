"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogForm,
  DialogHeader,
  DialogTitle,
  type DialogTone,
} from "@/components/ui/dialog";
import {
  MobileSheet,
  MobileSheetAcciones,
  MobileSheetCerrar,
  MobileSheetCuerpo,
  MobileSheetDescripcion,
  MobileSheetEncabezado,
  MobileSheetFormulario,
  MobileSheetPagina,
  MobileSheetTitulo,
  type AlturaSheet,
} from "@/components/ui/mobile-sheet";
import { useEsMovil } from "@/components/ui/use-es-movil";

/**
 * Capa adaptativa — issue #54 (PWA-MOB-04).
 *
 * Una sola pantalla describe su capa una vez y el mecanismo lo elige el
 * ancho: por debajo de 1024px un bottom sheet (`MobileSheet`), a partir de
 * 1024px exactamente el `Dialog` de escritorio que ya estaba aprobado, con
 * su mismo marcado y sus mismas clases. No es un componente "responsive"
 * con `lg:` sobre un único árbol: son dos árboles distintos y solo se monta
 * uno, porque un bottom sheet con la geometría de un diálogo centrado (o al
 * revés) es justo lo que este issue viene a eliminar.
 *
 * El corte (`useEsMovil`) es el mismo `max-width: 1023.98px` que aísla los
 * tokens móviles en `globals.css`, así que CSS y JS no pueden discrepar.
 */

type VarianteCapa = "form" | "confirm" | "detail" | "secret";

type ContextoCapa = { movil: boolean };

const Contexto = React.createContext<ContextoCapa>({ movil: false });

function useCapa() {
  return React.useContext(Contexto);
}

/** Altura del sheet equivalente a cada variante de diálogo. */
const ALTURA_POR_VARIANTE: Record<VarianteCapa, AlturaSheet> = {
  form: "casi-completa",
  confirm: "compacta",
  detail: "media",
  secret: "media",
};

export function Capa({
  abierto,
  alCerrar,
  pendiente = false,
  hayCambios = false,
  altura,
  variante = "form",
  children,
}: {
  abierto: boolean;
  alCerrar: () => void;
  pendiente?: boolean;
  hayCambios?: boolean;
  /** Fuerza la altura del sheet; por defecto la deriva de `variante`. */
  altura?: AlturaSheet;
  variante?: VarianteCapa;
  children: React.ReactNode;
}) {
  const movil = useEsMovil();
  const contexto = React.useMemo(() => ({ movil }), [movil]);

  if (movil) {
    return (
      <Contexto.Provider value={contexto}>
        <MobileSheet
          abierto={abierto}
          alCerrar={alCerrar}
          altura={altura ?? ALTURA_POR_VARIANTE[variante]}
          pendiente={pendiente}
          hayCambios={hayCambios}
        >
          {children}
        </MobileSheet>
      </Contexto.Provider>
    );
  }

  return (
    <Contexto.Provider value={contexto}>
      <Dialog
        open={abierto}
        pending={pendiente}
        hasUnsavedChanges={hayCambios}
        onOpenChange={(siguiente) => {
          if (!siguiente) alCerrar();
        }}
      >
        {children}
      </Dialog>
    </Contexto.Provider>
  );
}

export function CapaContenido({
  children,
  variante = "form",
  pendiente = false,
  className,
}: {
  children: React.ReactNode;
  variante?: VarianteCapa;
  pendiente?: boolean;
  /** Solo escritorio: el sheet no acepta anchos ni topes de alto sueltos. */
  className?: string;
}) {
  const { movil } = useCapa();
  if (movil) {
    return <MobileSheetPagina id="raiz">{children}</MobileSheetPagina>;
  }
  return (
    <DialogContent variant={variante} pending={pendiente} className={className}>
      {children}
    </DialogContent>
  );
}

export function CapaEncabezado({
  children,
  icono,
  eyebrow,
  tone,
  className,
}: {
  children: React.ReactNode;
  /** Solo escritorio: en móvil el doc §5 pide título grande, sin eyebrow. */
  icono?: React.ReactNode;
  eyebrow?: string;
  /** Solo escritorio: el sheet no tiñe su encabezado por tono. */
  tone?: DialogTone;
  className?: string;
}) {
  const { movil } = useCapa();
  if (movil) return <MobileSheetEncabezado>{children}</MobileSheetEncabezado>;
  return (
    <DialogHeader icon={icono} eyebrow={eyebrow} tone={tone} className={className}>
      {children}
    </DialogHeader>
  );
}

export function CapaTitulo({ children }: { children: React.ReactNode }) {
  const { movil } = useCapa();
  return movil ? (
    <MobileSheetTitulo>{children}</MobileSheetTitulo>
  ) : (
    <DialogTitle>{children}</DialogTitle>
  );
}

export function CapaDescripcion({ children }: { children: React.ReactNode }) {
  const { movil } = useCapa();
  return movil ? (
    <MobileSheetDescripcion>{children}</MobileSheetDescripcion>
  ) : (
    <DialogDescription>{children}</DialogDescription>
  );
}

export function CapaCuerpo({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { movil } = useCapa();
  return movil ? (
    <MobileSheetCuerpo className={className}>{children}</MobileSheetCuerpo>
  ) : (
    <DialogBody className={className}>{children}</DialogBody>
  );
}

/**
 * Formulario de la capa. En escritorio es `DialogForm` tal cual. En móvil
 * el `<form>` envuelve cuerpo y acciones —para que el submit siga siendo
 * nativo— pero solo el cuerpo desplaza: el pie queda fijo, como pide el
 * doc §5, y por eso hay que separarlo de los hijos antes de montarlo.
 */
export function CapaFormulario({
  children,
  ...props
}: React.ComponentProps<"form">) {
  const { movil } = useCapa();

  if (!movil) {
    return <DialogForm {...props}>{children}</DialogForm>;
  }

  const ocultos: React.ReactNode[] = [];
  const visibles: React.ReactNode[] = [];
  let pie: React.ReactNode = null;

  React.Children.toArray(children).forEach((hijo) => {
    if (
      React.isValidElement(hijo) &&
      hijo.type === "input" &&
      (hijo.props as React.ComponentProps<"input">).type === "hidden"
    ) {
      ocultos.push(hijo);
      return;
    }
    if (React.isValidElement(hijo) && hijo.type === CapaPie) {
      pie = hijo;
      return;
    }
    visibles.push(hijo);
  });

  return (
    <MobileSheetFormulario {...props}>
      {ocultos}
      <MobileSheetCuerpo className="flex flex-col gap-5">
        {visibles}
      </MobileSheetCuerpo>
      {pie}
    </MobileSheetFormulario>
  );
}

export function CapaPie({
  children,
  className,
}: {
  children: React.ReactNode;
  /** Solo escritorio. */
  className?: string;
}) {
  const { movil } = useCapa();
  return movil ? (
    <MobileSheetAcciones>{children}</MobileSheetAcciones>
  ) : (
    <DialogFooter className={className}>{children}</DialogFooter>
  );
}

/** Cancelar: en móvil pasa por la misma protección que Escape o el arrastre. */
export function CapaCerrar({ children }: { children: React.ReactNode }) {
  const { movil } = useCapa();
  return movil ? (
    <MobileSheetCerrar variante="secundario">{children}</MobileSheetCerrar>
  ) : (
    <DialogClose render={<Button variant="outline" />}>{children}</DialogClose>
  );
}
