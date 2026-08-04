# 06 — Backlog de implementación

Tareas ordenadas por dependencia. Cada una es un bloque de trabajo cerrado con criterio de
aceptación verificable. **No avanzar a la siguiente sin cumplir el criterio de la anterior.**

Leyenda: 🔴 bloqueante para todo lo demás · 🟡 bloqueante para su área · 🟢 independiente

---

## Bloque 0 — Cimientos

### T01 🔴 Scaffolding del proyecto
- `npx create-next-app@latest` — TypeScript, App Router, Tailwind v4, ESLint, sin `src/` alias por
  defecto (usar la estructura de [`PLAN.md §4`](./PLAN.md)).
- `tsconfig.json` con `strict: true`, `noUncheckedIndexedAccess: true`.
- Prettier + ESLint configurados. Script `npm run check` = typecheck + lint.
- `shadcn init` con el tema neutro; instalar los componentes de [`05 §4`](./05-DESIGN-SYSTEM.md).
- Tokens de color de [`05 §1`](./05-DESIGN-SYSTEM.md) en `globals.css`, con toggle de tema
  funcionando y script anti-parpadeo.

**Aceptación**: `npm run check` y `npm run build` pasan. La página raíz muestra un botón de
shadcn y el toggle de tema funciona sin parpadeo al recargar.

### T02 🔴 Base de datos y esquema
- Provisionar Neon Postgres vía Vercel Marketplace (usar la skill `vercel:marketplace`).
- `src/db/schema.ts` con **todas** las tablas de [`01-MODELO-DATOS.md`](./01-MODELO-DATOS.md).
- Migración generada por `drizzle-kit`, más migraciones SQL manuales para: extensiones, el
  constraint `EXCLUDE` de `convenio_terminos`, los triggers (`updated_at`, otorgante válido,
  usuario/empleado misma empresa, auditoría inmutable), y los `REVOKE` de `auditoria`.
- `src/db/seed.ts` según [`01 §15`](./01-MODELO-DATOS.md), idempotente, que se niega a correr
  en producción.

**Aceptación**: `npm run db:migrate && npm run db:seed` deja la BD lista.
Tests que verifican: (a) `UPDATE auditoria` lanza excepción, (b) dos términos solapados son
rechazados por la BD, (c) un DNI duplicado es rechazado.

### T03 🔴 Utilidades base
- `src/lib/dinero.ts` con los casos de prueba de [`02 §1`](./02-LOGICA-NEGOCIO.md).
- `src/lib/fechas.ts` con `hoyLima()` y los formateadores.
- `src/lib/tipos.ts` con `Resultado<T>`, `Pagina<T>`, `CodigoError`.
- `src/lib/zod.ts` con los primitivos de [`03`](./03-API.md).

**Aceptación**: `dinero.test.ts` cubre los 6 casos de la tabla y pasa. `hoyLima()` devuelve el día
correcto simulando las 23:00 hora de Lima (que en UTC ya es el día siguiente).

### T04 🔴 Auditoría
- `src/lib/audit/registrar.ts`: función que inserta en `auditoria` dentro de una transacción
  recibida, con el advisory lock y el cálculo de la cadena de hash.
- Función de canonicalización JSON (claves ordenadas) determinista.
- Redacción automática de campos sensibles (`password_hash`, tokens).
- `verificarCadena()`.

**Aceptación**: test que inserta 100 registros concurrentes y luego verifica que la cadena está
íntegra y que los `id` son consecutivos.

---

## Bloque 1 — Autenticación

### T05 🔴 Sesión y guardas
- `src/lib/auth/password.ts` (argon2id con los parámetros de [`02 §6`](./02-LOGICA-NEGOCIO.md)).
- `src/lib/auth/sesion.ts`: crear, validar, revocar, refrescar `ultimo_uso_at`.
- `requireSession()`, `requireRol()`, `requireMismaEmpresa()`.
- `src/lib/rate-limit.ts` sobre la tabla `rate_limits`.
- Middleware que redirige a `/login` si no hay cookie, y a `/perfil/password` si
  `debe_cambiar_password`. **El middleware es solo para redirigir**: la autorización real vive en
  cada action.

**Aceptación**: tests de `requireRol` para las 3 combinaciones. Un usuario desactivado con sesión
activa recibe 401 en la siguiente petición.

### T06 🟡 Pantalla de login y cambio de contraseña
Pantallas [`04 §1`](./04-UI.md) y [`04 §2`](./04-UI.md). Actions `iniciarSesion`,
`cerrarSesion`, `cambiarPassword`.

**Aceptación**: e2e Playwright — login con seed, cambio forzado de contraseña, logout, y
5 intentos fallidos que producen bloqueo. El mensaje de error es idéntico en todos los fallos.

---

## Bloque 2 — Administración base (SUPERADMIN)

### T07 🟡 Shell y navegación
Layout, header, tab bar móvil, sidebar de escritorio, destinos por rol, banner offline,
menú de usuario. Estados transversales de [`04 §14`](./04-UI.md).

**Aceptación**: los tres roles ven exactamente los destinos de la tabla de [`04 §0`](./04-UI.md).
Sin scroll horizontal en 375 px en ninguna pantalla existente.

### T08 🟡 Empresas y sedes
Módulos `empresas` y `sedes` completos: schemas, queries, actions, pantallas
([`04 §13`](./04-UI.md) y [`04 §10`](./04-UI.md)).

**Aceptación**: crear una empresa genera su sede «Principal» en la misma transacción.
Un `ADMIN_EMPRESA` que llama a `crearSede` con el `empresaId` de otra empresa crea la sede **en
la suya**, no en la ajena (el parámetro se ignora). Test de aislamiento incluido.

### T09 🟡 Convenios y términos
Módulo `convenios` completo, incluyendo `cambiarTermino` y `misConveniosVigentes`.
Pantalla de [`04 §13`](./04-UI.md) con las dos direcciones explícitas.

**Aceptación**: crear un convenio en cualquier orden de empresas produce siempre
`empresa_a_id < empresa_b_id`. Cambiar un descuento cierra el término anterior y crea el nuevo sin
solape. `misConveniosVigentes` con una fecha pasada devuelve el término que estaba vigente ese día.

### T10 🟡 Usuarios
Módulo `usuarios` completo, con generación de contraseña temporal legible y el diálogo de
[`04 §9`](./04-UI.md).

**Aceptación**: un `ADMIN_EMPRESA` no puede crear un `SUPERADMIN` ni un usuario en otra empresa.
Desactivar un usuario invalida sus sesiones de inmediato. La contraseña temporal nunca aparece en
la BD ni en los logs.

---

## Bloque 3 — Empleados

### T11 🟡 Almacenamiento de archivos
- `POST /api/blob/upload` con `handleUpload`.
- `GET /api/adjuntos/[id]` con URL firmada, autorización y auditoría.
- Validación de firma de archivo por magic bytes.
- `<CampoArchivo>`: cámara, archivo, compresión, sha256, progreso, miniatura, eliminar.

**Aceptación**: subir una foto de 4 MB desde un móvil produce un blob de menos de 1 MB.
Un usuario de la empresa A recibe 404 al pedir un adjunto de la empresa B. Cada acceso deja una
fila `ADJUNTO_VISTO`. Renombrar un `.exe` a `.jpg` es rechazado.

### T12 🔴 Búsqueda por DNI
`buscarPorDni` con los cinco resultados posibles de [`02 §4`](./02-LOGICA-NEGOCIO.md),
rate limit y auditoría.

**Aceptación**: test unitario que cubre los cinco casos. La respuesta `SIN_CONVENIO` no incluye
nombres ni teléfono. La búsqueda 21 en un minuto devuelve 429.

### T13 🟡 CRUD de empleados y verificación
Módulo completo, pantallas [`04 §5`](./04-UI.md) y [`04 §8`](./04-UI.md), incluyendo la bandeja
de pendientes y el texto de consentimiento de [`02 §7`](./02-LOGICA-NEGOCIO.md).

**Aceptación**: un empleado creado por el vendedor de la empresa convenio nace
`PENDIENTE_VERIFICACION`; creado por el admin de su propia empresa nace `ACTIVO`. Rechazar marca
`requiere_revision = true` en todas sus ventas registradas. El badge de la navegación refleja el
conteo real.

---

## Bloque 4 — El núcleo

### T14 🔴 Registrar venta
La action `crearVenta` con los 12 pasos de [`02 §2`](./02-LOGICA-NEGOCIO.md) y la pantalla
[`04 §4`](./04-UI.md) completa, incluyendo borrador local y pantalla de confirmación.

**Aceptación** (todas obligatorias):
1. Enviar dos veces el mismo `ventaId` crea **una** venta y la segunda respuesta trae
   `yaExistia: true`.
2. Un cliente que manda un `montoFinal` manipulado es ignorado: el servidor recalcula.
3. Una venta con fecha de hace 30 días es rechazada (el límite es 7).
4. Una venta retroactiva usa el `descuento_bps` vigente **en esa fecha**, no el de hoy.
5. Cambiar el descuento del convenio después no altera la venta guardada.
6. Vender a un empleado de la propia empresa es rechazado.
7. Vender sin documento adjunto es rechazado.
8. La venta y sus adjuntos y su fila de auditoría se crean en una sola transacción: si falla la
   auditoría, no queda venta.
9. Cronómetro manual en móvil real: registrar una venta con el empleado ya existente toma
   menos de 60 s.

### T15 🟡 Listado y detalle de ventas
`listarVentas` con todos los filtros y paginación por cursor, `obtenerVenta`, `anularVenta`.
Pantallas [`04 §6`](./04-UI.md) y [`04 §7`](./04-UI.md).

**Aceptación**: un `VENDEDOR` que manda `vendedorId` de otro usuario sigue viendo solo sus
ventas. Un `ADMIN_EMPRESA` ve la pestaña «Compraron mis empleados» con montos pero **sin** poder
abrir los adjuntos. El `resumen` corresponde al filtro completo, no a la página. Anular fuera de
la ventana permitida devuelve `SIN_PERMISO`.

---

## Bloque 5 — Cierre de v1

### T16 🟢 PWA
Manifest, iconos (192, 512, maskable), Serwist con las políticas de caché de
[`04 §16`](./04-UI.md), página offline, banner de instalación.

**Aceptación**: Lighthouse PWA sin errores. Instalada en Android y iOS, abre en `standalone`.
Ninguna respuesta de `/api/*` ni de Server Action queda cacheada — verificar con el
inspector de Application.

### T17 🟢 Dashboard
`obtenerDashboard` con las consultas en paralelo y la pantalla [`04 §11`](./04-UI.md).
Antes de escribir los gráficos, cargar la skill `dataviz`.

**Aceptación**: los totales del dashboard coinciden exactamente con el `resumen` de
`listarVentas` aplicando el mismo rango. Las anuladas están excluidas de los totales y se
muestran aparte. Un mes sin ventas muestra estado vacío, no ceros.

### T18 🟢 Visor de auditoría
`listarAuditoria`, `verificarCadena` y la pantalla [`04 §12`](./04-UI.md) con diff campo a campo.

**Aceptación**: un `ADMIN_EMPRESA` solo ve filas de su empresa. El diff no muestra campos sin
cambio. `verificarCadena` detecta una fila alterada manualmente en la BD.

### T19 🟢 Endurecimiento
- Cabeceras de seguridad: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`.
- Revisar que ninguna respuesta de error filtre IDs o existencia de recursos ajenos.
- Repasar la matriz de [`02 §3`](./02-LOGICA-NEGOCIO.md) action por action.
- `npm audit` limpio.

**Aceptación**: correr `/security-review` sobre el diff completo y resolver todo lo que aparezca.

### T20 🟢 Pruebas end-to-end
Playwright sobre los tres flujos críticos:
1. Login → nueva venta con empleado existente → confirmación → aparece en el listado.
2. Login → nueva venta con DNI inexistente → crear empleado → guardar → bandeja del otro admin →
   verificar.
3. Admin → cambiar descuento del convenio → nueva venta → verifica el % nuevo → abre una venta
   anterior → verifica que conserva el % viejo.

**Aceptación**: los tres pasan en CI, en viewport móvil (`Pixel 5`) y escritorio.

---

## Variables de entorno

```
DATABASE_URL=                 # Neon, pooled
DATABASE_URL_UNPOOLED=        # Neon, directo (migraciones)
BLOB_READ_WRITE_TOKEN=        # Vercel Blob
SESSION_COOKIE_NAME=convenios_sesion
NODE_ENV=
```
Gestionar con `vercel env` y `vercel env pull`. Nunca commitear `.env.local`.

---

## Definición de «terminado» (aplica a toda tarea)

- [ ] `npm run check` y `npm run build` pasan
- [ ] Funciona en 375 px sin scroll horizontal
- [ ] Funciona en tema claro **y** oscuro
- [ ] Toda action nueva tiene su guarda de autorización explícita
- [ ] Toda mutación deja fila en `auditoria`
- [ ] Estados de carga, vacío y error implementados
- [ ] Ningún importe pasa por `float`
- [ ] Los textos visibles siguen [`05 §7`](./05-DESIGN-SYSTEM.md)
- [ ] Si toca datos de más de una empresa, hay test de aislamiento

---

## Orden sugerido de ejecución

```
T01 → T02 → T03 → T04 → T05 → T06 → T07
                                     ├→ T08 → T09 → T10
                                     └→ T11 → T12 → T13
                                                     └→ T14 → T15
                                                               ├→ T16
                                                               ├→ T17
                                                               ├→ T18
                                                               └→ T19 → T20
```

T08-T10 y T11-T13 son dos ramas paralelizables tras T07. T14 necesita ambas.
