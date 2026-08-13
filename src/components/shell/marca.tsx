import { cn } from "@/lib/utils";
import { Isotipo } from "@/components/shell/isotipo";

export function Marca({
  compacta = false,
  sobreOscuro = false,
  className,
}: {
  compacta?: boolean;
  /** El sidebar es oscuro sin importar el tema de la app: usa el tinte de
   *  marca fijo para superficies oscuras en vez del que sigue el tema. */
  sobreOscuro?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <Isotipo
        className={cn(
          "size-9 shrink-0",
          sobreOscuro ? "text-brand-on-dark" : "text-brand",
        )}
      />
      {!compacta ? (
        <span className="min-w-0 leading-none">
          <span
            className={cn(
              "block font-serif text-[19px] font-semibold tracking-tight",
              sobreOscuro ? "text-white" : "text-foreground",
            )}
          >
            Convenios
          </span>
          <span
            className={cn(
              "mt-1 block text-[10px] font-semibold tracking-[0.16em]",
              sobreOscuro ? "text-slate-500" : "text-muted-foreground",
            )}
          >
            BENEFICIOS EN RED
          </span>
        </span>
      ) : null}
    </div>
  );
}
