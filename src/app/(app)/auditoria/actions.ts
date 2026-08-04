"use server";
import { requireSession, requireRol } from "@/lib/auth/guardas";
import { verificarCadena } from "@/lib/audit/verificar";
export async function verificarIntegridad() {
  const sesion = await requireSession();
  requireRol(sesion, ["SUPERADMIN"]);
  return verificarCadena();
}
