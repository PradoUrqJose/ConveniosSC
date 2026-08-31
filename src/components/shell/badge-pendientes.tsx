type VarianteBadge = "sidebar" | "movil";

/**
 * Badge que se resuelve dentro de su propia frontera de Suspense. El shell no
 * necesita esperar el conteo para ser interactivo; cuando llega, sólo se
 * reemplaza este pequeño fragmento.
 */
export async function BadgePendientes({
  pendientes,
  variante,
}: {
  pendientes: Promise<number>;
  variante: VarianteBadge;
}) {
  const total = await pendientes;
  if (total <= 0) return null;

  return (
    <span
      className={
        variante === "sidebar"
          ? "ml-auto rounded-full bg-cyan-300 px-2 py-0.5 text-[10px] font-extrabold text-slate-950"
          : "bg-primary text-primary-foreground absolute -top-1 left-1/2 min-w-4 translate-x-1.5 rounded-full px-1 text-center text-[0.58rem] leading-4 font-bold"
      }
    >
      {total}
    </span>
  );
}
