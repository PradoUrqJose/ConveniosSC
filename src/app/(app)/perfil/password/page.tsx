import { redirect } from "next/navigation";

import { ErrorAuth, requireSession } from "@/lib/auth/guardas";
import { CambiarPasswordForm } from "./form-cambiar-password";

export default async function CambiarPasswordPage() {
  let sesion;
  try {
    sesion = await requireSession();
  } catch (error) {
    if (error instanceof ErrorAuth) {
      redirect("/login");
    }
    throw error;
  }

  // Cuando el cambio es obligatorio la pantalla es un bloqueo: no hay
  // "atrás" al que volver, así que la cabecera de formulario se dibuja sin
  // back (issue #52).
  return <CambiarPasswordForm forzado={sesion.debeCambiarPassword} />;
}
