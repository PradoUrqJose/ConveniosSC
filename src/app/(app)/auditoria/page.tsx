import { redirect } from "next/navigation";
import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import {
  listarAuditoria,
  type FiltroAuditoria,
} from "@/modules/auditoria/query";
import { AuditoriaClient } from "./auditoria-client";
import { medirServidor } from "@/lib/observabilidad";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  let sesion;
  try {
    sesion = await requireSession();
  } catch (e) {
    if (e instanceof ErrorAuth) redirect("/login");
    throw e;
  }
  try {
    requireRol(sesion, ["SUPERADMIN", "ADMIN_EMPRESA"]);
  } catch {
    redirect("/");
  }
  const sp = await searchParams;
  const filtros: FiltroAuditoria = {
    desde: sp.desde,
    hasta: sp.hasta,
    accion: sp.accion as FiltroAuditoria["accion"],
    entidad: sp.entidad,
    entidadId: sp.entidadId,
    actorId: sp.actorId,
    cursor: sp.cursor,
  };
  return (
    <AuditoriaClient
      pagina={await medirServidor("auditoria.pagina", () =>
        listarAuditoria(sesion, filtros),
      )}
      filtros={filtros}
      puedeVerificar={sesion.rol === "SUPERADMIN"}
      alcanceGlobal={sesion.rol === "SUPERADMIN"}
    />
  );
}
