import { redirect } from "next/navigation";
import { Courier_Prime, IBM_Plex_Sans } from "next/font/google";

import { db } from "@/db";
import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import { cargarPerfilNav } from "@/lib/auth/perfil";
import { misConveniosVigentes } from "@/modules/convenios/query";
import {
  configuracionEmpresaVenta,
  sedesParaVenta,
} from "@/modules/ventas/query";
import { FormVenta } from "./form-venta";

/**
 * Tipografía del flujo de venta. Se sirve con `next/font`, que descarga las
 * fuentes en build y las publica bajo `/_next/static`: mismo origen (la CSP
 * fija `font-src 'self' data:`) y precacheadas por el service worker, así que
 * la PWA sigue funcionando sin conexión. Un `<link>` a fonts.googleapis.com
 * rompería ambas cosas.
 */
const fuenteTexto = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-venta-sans",
  display: "swap",
});

const fuenteCifras = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-venta-mono",
  display: "swap",
});

export default async function NuevaVentaPage() {
  let ctx;
  try {
    ctx = await requireSession();
  } catch (error) {
    if (error instanceof ErrorAuth) {
      redirect("/login");
    }
    throw error;
  }

  try {
    requireRol(ctx, ["VENDEDOR", "ADMIN_EMPRESA"]);
  } catch {
    redirect("/");
  }

  const [convenios, sedes, config, perfil] = await Promise.all([
    misConveniosVigentes(ctx),
    sedesParaVenta(ctx),
    configuracionEmpresaVenta(ctx),
    cargarPerfilNav(db, ctx.usuarioId),
  ]);

  if (convenios.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
        <p className="text-muted-foreground max-w-sm text-sm">
          Tu empresa no tiene convenios vigentes. Contacta al administrador
          general.
        </p>
      </section>
    );
  }

  return (
    <FormVenta
      claseFuentes={`${fuenteTexto.variable} ${fuenteCifras.variable}`}
      usuarioId={ctx.usuarioId}
      convenios={convenios}
      sedes={sedes}
      sedePorDefectoId={perfil.sedePorDefectoId}
      config={config}
    />
  );
}
