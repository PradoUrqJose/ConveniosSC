import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ShoppingCart } from "lucide-react";

import { db } from "@/db";
import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import { cargarPerfilNav } from "@/lib/auth/perfil";
import { Card, CardContent } from "@/components/ui/card";

export default async function InicioPage() {
  let sesion;
  try {
    sesion = await requireSession();
  } catch (error) {
    if (error instanceof ErrorAuth) {
      redirect("/login");
    }
    throw error;
  }

  if (sesion.rol !== "VENDEDOR") {
    redirect("/dashboard");
  }

  const perfil = await cargarPerfilNav(db, sesion.usuarioId);
  const nombre = perfil.nombres || "";

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {nombre} 👋
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Registra una venta rápida o revisa tus ventas recientes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="hover:bg-accent/40 transition-colors">
          <CardContent className="flex flex-col items-start gap-3 p-5">
            <Link href="/ventas/nueva" className="flex w-full flex-col gap-3">
              <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg">
                <Plus className="size-5" aria-hidden="true" />
              </span>
              <span className="font-semibold">Nueva venta</span>
              <span className="text-muted-foreground text-sm">
                Registrar una venta con convenio
              </span>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent/40 transition-colors">
          <CardContent className="flex flex-col gap-3 p-5">
            <Link href="/ventas" className="flex w-full flex-col gap-3">
              <span className="bg-card text-card-foreground border-border flex size-10 items-center justify-center rounded-lg border">
                <ShoppingCart className="size-5" aria-hidden="true" />
              </span>
              <span className="font-semibold">Mis ventas</span>
              <span className="text-muted-foreground text-sm">
                Ver tu historial de ventas
              </span>
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
