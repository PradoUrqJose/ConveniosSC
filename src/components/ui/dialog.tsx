"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DialogVariant = "form" | "confirm" | "detail" | "secret";
type DialogTone = "default" | "destructive" | "warning" | "success";

type CloseAttempt = {
  reason: DialogPrimitive.Root.ChangeEventReason;
  hasUnsavedChanges: boolean;
  pending: boolean;
};

type DialogContextValue = {
  pending: boolean;
  setContentState: (state: {
    pending: boolean;
    hasUnsavedChanges: boolean;
  }) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

/** Protege el cierre durante una operación o mientras haya cambios sin guardar. */
function Dialog({
  pending = false,
  hasUnsavedChanges = false,
  onCloseAttempt,
  onOpenChange,
  disablePointerDismissal,
  ...props
}: DialogPrimitive.Root.Props & {
  pending?: boolean;
  hasUnsavedChanges?: boolean;
  onCloseAttempt?: (attempt: CloseAttempt) => void;
}) {
  const [contentState, setContentState] = React.useState({
    pending: false,
    hasUnsavedChanges: false,
  });
  const isPending = pending || contentState.pending;
  const isDirty = hasUnsavedChanges || contentState.hasUnsavedChanges;

  const handleOpenChange = React.useCallback(
    (open: boolean, eventDetails: DialogPrimitive.Root.ChangeEventDetails) => {
      if (!open && (isPending || isDirty)) {
        eventDetails.preventUnmountOnClose();
        onCloseAttempt?.({
          reason: eventDetails.reason,
          hasUnsavedChanges: isDirty,
          pending: isPending,
        });
        return;
      }
      onOpenChange?.(open, eventDetails);
    },
    [isDirty, isPending, onCloseAttempt, onOpenChange],
  );

  const contextValue = React.useMemo(
    () => ({ pending: isPending, setContentState }),
    [isPending],
  );

  return (
    <DialogContext.Provider value={contextValue}>
      <DialogPrimitive.Root
        data-slot="dialog"
        disablePointerDismissal={disablePointerDismissal || isPending}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </DialogContext.Provider>
  );
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ disabled, ...props }: DialogPrimitive.Close.Props) {
  const context = React.useContext(DialogContext);
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      disabled={disabled || context?.pending}
      {...props}
    />
  );
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "dialog-overlay fixed inset-0 isolate z-[var(--z-overlay)] bg-slate-950/42 backdrop-blur-[6px]",
        className,
      )}
      {...props}
    />
  );
}

const widths: Record<DialogVariant, string> = {
  form: "41.25rem",
  confirm: "30rem",
  detail: "38rem",
  secret: "31rem",
};

function DialogContent({
  className,
  children,
  showCloseButton = true,
  variant = "form",
  pending = false,
  hasUnsavedChanges = false,
  style,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  variant?: DialogVariant;
  pending?: boolean;
  hasUnsavedChanges?: boolean;
}) {
  const context = React.useContext(DialogContext);
  const protectedFromClose = pending || context?.pending;
  const setContentState = context?.setContentState;

  React.useEffect(() => {
    setContentState?.({ pending, hasUnsavedChanges });
    return () =>
      setContentState?.({ pending: false, hasUnsavedChanges: false });
  }, [hasUnsavedChanges, pending, setContentState]);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-variant={variant}
        className={cn(
          "dialog-popup bg-popover text-popover-foreground ring-foreground/10 fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex max-h-[min(88dvh,46rem)] w-full flex-col overflow-hidden rounded-t-[var(--radius-modal)] ring-1 outline-none sm:top-1/2 sm:right-auto sm:bottom-auto sm:left-1/2 sm:max-h-[min(calc(100dvh-3rem),44rem)] sm:w-[min(calc(100vw-3rem),var(--dialog-width))] sm:!max-w-none sm:rounded-[var(--radius-modal)] [&>[data-slot=dialog-body]]:min-h-0 [&>[data-slot=dialog-body]]:flex-1 [&>form]:min-h-0 [&>form]:flex-1",
          className,
        )}
        style={
          {
            "--dialog-width": widths[variant],
            ...style,
          } as React.CSSProperties & Record<"--dialog-width", string>
        }
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            disabled={protectedFromClose}
            aria-label="Cerrar"
            title="Cerrar"
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                className="dialog-close text-muted-foreground hover:bg-muted hover:text-foreground absolute top-4 right-4 z-10 size-10 rounded-full border-0 bg-transparent shadow-none focus-visible:ring-2 sm:top-5 sm:right-5"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({
  className,
  icon,
  tone = "default",
  eyebrow,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ReactNode;
  tone?: DialogTone;
  eyebrow?: string;
}) {
  const tones: Record<DialogTone, string> = {
    default: "text-primary",
    destructive: "text-destructive",
    warning: "text-foreground",
    success: "text-success",
  };

  return (
    <div
      data-slot="dialog-header"
      data-tone={tone}
      className={cn(
        "relative z-[1] flex shrink-0 items-start px-5 pt-6 pb-5 sm:px-[1.875rem] sm:pt-[1.625rem]",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        {eyebrow || icon ? (
          <div
            className={cn(
              "mb-2 flex items-center gap-1.5 text-[0.6875rem] leading-4 font-bold tracking-[0.18em] uppercase [&_svg]:size-3.5",
              tones[tone],
            )}
          >
            {icon}
            {eyebrow ? <span>{eyebrow}</span> : null}
          </div>
        ) : null}
        <div className="space-y-1">{children}</div>
      </div>
    </div>
  );
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        "dialog-stagger overflow-y-auto px-5 pt-0 pb-6 sm:px-[1.875rem]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Mantiene el footer dentro del formulario (para submit), pero fuera de la
 * región desplazable. Cada hijo visible directo representa una unidad
 * conceptual de la secuencia de entrada.
 */
function DialogForm({
  className,
  children,
  ...props
}: React.ComponentProps<"form">) {
  const hiddenChildren: React.ReactNode[] = [];
  const visibleChildren: React.ReactNode[] = [];
  let footer: React.ReactNode = null;

  React.Children.toArray(children).forEach((child) => {
    if (
      React.isValidElement(child) &&
      child.type === "input" &&
      (child.props as React.ComponentProps<"input">).type === "hidden"
    ) {
      hiddenChildren.push(child);
      return;
    }

    if (React.isValidElement(child) && child.type === DialogFooter) {
      footer = child;
      return;
    }

    visibleChildren.push(child);
  });

  const delay = (index: number) =>
    ({
      "--dialog-stagger-delay": `${90 + index * 45}ms`,
    }) as React.CSSProperties;

  return (
    <form
      data-slot="dialog-form"
      className={cn(
        className,
        "flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden",
      )}
      {...props}
    >
      {hiddenChildren}
      <div
        data-slot="dialog-stagger"
        className="dialog-stagger flex min-h-0 min-w-0 flex-1 flex-col gap-[1.375rem] overflow-y-auto px-5 pb-6 sm:px-[1.875rem]"
      >
        {visibleChildren.map((child, index) => (
          <div
            key={React.isValidElement(child) ? (child.key ?? index) : index}
            data-slot="dialog-stagger-item"
            style={delay(index)}
          >
            {child}
          </div>
        ))}
      </div>
      {footer}
    </form>
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & { showCloseButton?: boolean }) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "border-border bg-popover relative z-[2] flex min-h-20 w-full shrink-0 flex-col-reverse gap-2.5 border-t px-5 pt-[1.125rem] pb-[max(1.375rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:px-[1.875rem] [&_[data-slot=button]]:min-h-12 [&_[data-slot=button]]:px-6",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogClose render={<Button variant="outline" />}>Cerrar</DialogClose>
      )}
    </div>
  );
}

function DialogProgress({
  current,
  total,
  className,
}: {
  current: number;
  total: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground hidden items-center gap-3 sm:flex",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={`${current} de ${total} campos requeridos completos`}
    >
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: total }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-1 w-[1.375rem] rounded-full transition-colors duration-[var(--duration-base)]",
              index < current ? "bg-primary" : "bg-border",
            )}
          />
        ))}
      </span>
      <span className="font-mono text-xs tabular-nums">
        {current} / {total}
      </span>
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading pr-12 text-[1.625rem] leading-8 font-extrabold tracking-[-0.025em] text-balance sm:text-[1.6875rem]",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-muted-foreground *:[a]:hover:text-foreground max-w-[56ch] pr-8 text-[0.90625rem] leading-5.5 text-pretty *:[a]:underline *:[a]:underline-offset-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogForm,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogProgress,
  DialogTitle,
  DialogTrigger,
};
