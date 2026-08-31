import { redirect } from "next/navigation";
import { ErrorAuth, requireRol, requireSession } from "@/lib/auth/guardas";
import { listarAuditoria } from "@/modules/auditoria/query";
import { AuditoriaClient } from "./auditoria-client";
import { medirServidor } from "@/lib/observabilidad";
import {
  normalizarParametrosAuditoria,
  serializarParametrosAuditoria,
  urlAuditoriaCanonica,
} from "@/modules/auditoria/filtros";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  if (!urlAuditoriaCanonica(sp)) {
    const query = serializarParametrosAuditoria(sp);
    redirect(query.size ? `/auditoria?${query}` : "/auditoria");
  }
  const filtros = normalizarParametrosAuditoria(sp);
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
