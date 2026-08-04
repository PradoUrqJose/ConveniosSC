import { notFound, redirect } from "next/navigation";

import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import { zUuid } from "@/lib/zod";
import { obtenerVenta } from "@/modules/ventas/query";
import { VentaDetalleClient } from "./venta-detalle-client";

export default async function VentaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let sesion;
  try {
    sesion = await requireSession();
  } catch (error) {
    if (error instanceof ErrorAuth) {
      redirect("/login");
    }
    throw error;
  }

  const { id } = await params;
  if (!zUuid.safeParse(id).success) {
    notFound();
  }

  const res = await obtenerVenta(sesion, id);
  if (!res.ok) {
    notFound();
  }

  return <VentaDetalleClient venta={res.data} />;
}
