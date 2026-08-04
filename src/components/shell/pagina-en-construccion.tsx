export function PaginaEnConstruccion({
  titulo,
  descripcion,
}: {
  titulo: string;
  descripcion?: string;
}) {
  return (
    <section className="flex flex-col items-center justify-center gap-2 py-20 text-center">
      <h1 className="text-xl font-semibold">{titulo}</h1>
      <p className="text-muted-foreground text-sm">
        {descripcion ?? "Esta sección está en construcción."}
      </p>
    </section>
  );
}
