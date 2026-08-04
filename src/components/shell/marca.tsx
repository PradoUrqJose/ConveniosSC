import { Building2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function Marca({
  compacta = false,
  className,
}: {
  compacta?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-linear-to-br from-cyan-300 via-sky-400 to-blue-600 text-slate-950 shadow-[0_10px_28px_rgba(14,165,233,.28)]">
        <span className="absolute -top-3 -right-2 size-7 rounded-full bg-white/45 blur-sm" />
        <Building2 className="relative size-5" strokeWidth={2.25} />
      </span>
      {!compacta ? (
        <span className="min-w-0 leading-none">
          <span className="block text-[17px] font-extrabold tracking-[-0.035em]">
            Convenios
          </span>
          <span className="mt-1 block text-[10px] font-semibold tracking-[0.16em] opacity-60">
            BENEFICIOS EN RED
          </span>
        </span>
      ) : null}
    </div>
  );
}
