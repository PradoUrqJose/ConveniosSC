import { describe, expect, it } from "vitest";

import { navegacionPorRol } from "./navegacion";

function rutas(rol: "ADMIN_EMPRESA" | "SUPERADMIN" | "VENDEDOR") {
  const nav = navegacionPorRol(rol);
  return [...nav.tabs, ...nav.mas, ...nav.lateral].map(({ href }) => href);
}

describe("navegacionPorRol", () => {
  it("muestra Auditoría al ADMIN_EMPRESA sin exponer Usuarios", () => {
    expect(rutas("ADMIN_EMPRESA")).toContain("/auditoria");
    expect(rutas("ADMIN_EMPRESA")).not.toContain("/usuarios");
  });

  it("reserva Usuarios y Auditoría global para SUPERADMIN", () => {
    expect(rutas("SUPERADMIN")).toEqual(
      expect.arrayContaining(["/usuarios", "/auditoria"]),
    );
    expect(rutas("VENDEDOR")).not.toContain("/auditoria");
    expect(rutas("VENDEDOR")).not.toContain("/usuarios");
  });
});
