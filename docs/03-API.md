# 03 — Contratos de API

Todo son **Server Actions** salvo dos Route Handlers. Cada action:

1. `const ctx = await requireSession()`
2. Valida la entrada con su esquema Zod
3. Autoriza según [`02-LOGICA-NEGOCIO.md §3`](./02-LOGICA-NEGOCIO.md)
4. Ejecuta en transacción, escribiendo en `auditoria` dentro de la misma
5. Devuelve `Resultado<T>` (nunca lanza al cliente)
6. Llama a `revalidatePath()` de las rutas afectadas

Los esquemas Zod viven en `src/modules/<dominio>/schemas.ts` y se importan **tanto en el
formulario como en la action**. Un solo esquema, dos usos.

## Tipos compartidos

```ts
// src/lib/tipos.ts
export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; codigo: CodigoError; mensaje: string; campo?: string }

export type Pagina<T> = {
  items: T[]
  cursor: string | null      // null = no hay más
  total?: number             // solo en la primera página
}
```

### Primitivos Zod reutilizables (`src/lib/zod.ts`)

```ts
export const zDni      = z.string().regex(/^\d{8}$/, 'El DNI debe tener 8 dígitos')
export const zRuc      = z.string().regex(/^\d{11}$/, 'El RUC debe tener 11 dígitos')
export const zTelefono = z.string().regex(/^\d{6,15}$/, 'Teléfono inválido').optional()
export const zUuid     = z.uuid()
export const zFecha    = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
export const zUsername = z.string().regex(/^[a-z0-9._-]{3,32}$/,
  'Solo minúsculas, números, punto, guion y guion bajo. Entre 3 y 32 caracteres')
export const zPassword = z.string().min(8, 'Mínimo 8 caracteres')
  .regex(/[a-zA-Z]/, 'Debe incluir al menos una letra')
  .regex(/\d/, 'Debe incluir al menos un número')
export const zNombre   = z.string().trim().min(2).max(80)
/** Monto en soles como texto → céntimos enteros */
export const zMontoSoles = z.string()
  .regex(/^\d{1,9}([.,]\d{1,2})?$/, 'Monto inválido. Usa hasta 2 decimales')
  .transform(parsearSoles)
```

---

## 1. `modules/auth`

### `iniciarSesion`
```ts
entrada: { username: zUsername, password: z.string().min(1) }
salida:  { debeCambiarPassword: boolean; rol: RolUsuario }
```
Rate limit por username e IP. Error siempre genérico (`'Usuario o contraseña incorrectos'`,
código `VALIDACION`) sin distinguir usuario inexistente, contraseña mala o bloqueo.
Establece la cookie de sesión. Audita `LOGIN_OK` / `LOGIN_FALLIDO`.

### `cerrarSesion`
```ts
entrada: {}    salida: {}
```
Marca `revocada_at`, borra la cookie, audita `LOGOUT`, redirige a `/login`.

### `cambiarPassword`
```ts
entrada: {
  actual: z.string().min(1),
  nueva: zPassword,
  confirmacion: z.string(),
}  // .refine(nueva === confirmacion, 'Las contraseñas no coinciden')
salida: {}
```
Verifica la actual. Rechaza si `nueva === actual`. Pone `debe_cambiar_password = false`.
**Revoca todas las demás sesiones** del usuario, conserva la actual. Audita `PASSWORD_CAMBIADA`.

---

## 2. `modules/empresas` — SUPERADMIN

### `crearEmpresa`
```ts
entrada: {
  ruc: zRuc,
  razonSocial: z.string().trim().min(3).max(200),
  nombreComercial: z.string().trim().min(2).max(100),
  topeMontoVenta: zMontoSoles.default('50000'),
  requiereEvidenciaEnVenta: z.boolean().default(false),
  diasRetroactivosVenta: z.number().int().min(0).max(30).default(7),
}
salida: { empresaId: string }
```
En la misma transacción crea la sede `"Principal"`. RUC duplicado → `CONFLICTO`.

### `actualizarEmpresa`
```ts
entrada: { empresaId: zUuid, ...los mismos campos, todos opcionales, más activo: z.boolean() }
salida:  {}
```
Desactivar una empresa: bloquea el login de todos sus usuarios y suspende sus convenios.
Requiere confirmación explícita en la UI mostrando cuántos usuarios se verán afectados.

### `listarEmpresas` *(query)*
```ts
entrada: { q?: string; activo?: boolean; cursor?: string }
salida:  Pagina<{ id, ruc, nombreComercial, razonSocial, activo,
                  totalUsuarios, totalEmpleados, totalConvenios }>
```

---

## 3. `modules/sedes`

### `crearSede` / `actualizarSede`
```ts
entrada: { empresaId: zUuid, nombre: z.string().trim().min(2).max(80),
           direccion: z.string().trim().max(200).optional() }
salida:  { sedeId: string }
```
`ADMIN_EMPRESA` solo sobre su empresa; el `empresaId` recibido se **ignora** y se usa el de la
sesión (salvo `SUPERADMIN`). Nombre duplicado en la empresa → `CONFLICTO`.
No se puede desactivar la última sede activa ni una sede con ventas del mes en curso.

### `listarSedes` *(query)*
```ts
entrada: { empresaId?: zUuid; soloActivas?: boolean }
salida:  Array<{ id, nombre, direccion, activo, totalVentas30d }>
```

---

## 4. `modules/convenios` — SUPERADMIN

### `crearConvenio`
```ts
entrada: {
  empresaXId: zUuid,
  empresaYId: zUuid,
  vigenciaDesde: zFecha,
  vigenciaHasta: zFecha.nullable(),
  notas: z.string().max(1000).optional(),
  descuentoXotorgaBps: z.number().int().min(0).max(10000),   // X vende a empleados de Y
  descuentoYotorgaBps: z.number().int().min(0).max(10000),
  activarInmediatamente: z.boolean().default(true),
}
salida: { convenioId: string }
```
La action **ordena** `empresaXId`/`empresaYId` para cumplir `empresa_a_id < empresa_b_id` y crea
los dos `convenio_terminos` con `vigencia_desde = convenio.vigenciaDesde`. Par duplicado →
`CONFLICTO` con enlace al convenio existente.

En la UI el porcentaje se ingresa como número con hasta 2 decimales (`15`, `12.5`) y se convierte
a bps multiplicando por 100. La conversión ocurre en el cliente y se **revalida** en el servidor.

### `actualizarConvenio`
```ts
entrada: { convenioId: zUuid, estado?: EstadoConvenio, vigenciaHasta?: zFecha|null, notas?: string }
salida:  {}
```
No permite cambiar las empresas. Terminar un convenio no afecta ventas ya registradas.

### `cambiarTermino`
```ts
entrada: {
  convenioId: zUuid,
  empresaOtorganteId: zUuid,
  nuevoDescuentoBps: z.number().int().min(0).max(10000),
  vigenteDesde: zFecha,          // no puede ser anterior a hoy
}
salida: { terminoId: string }
```
Transacción: cierra el término vigente con `vigencia_hasta = vigenteDesde − 1 día`, inserta el
nuevo. Audita `TERMINO_CERRADO` + `TERMINO_CREADO`. El constraint `EXCLUDE` es la garantía final
de que no queden solapes.

### `listarConvenios` *(query, SUPERADMIN)*
```ts
salida: Array<{ id, empresaA: {id,nombre}, empresaB: {id,nombre}, estado,
                vigenciaDesde, vigenciaHasta,
                terminoAotorga: {bps, desde}, terminoBotorga: {bps, desde},
                ventas30d: number }>
```

### `misConveniosVigentes` *(query, cualquier rol)*
Alimenta el selector del formulario de venta.
```ts
entrada: { aFecha?: zFecha }   // default: hoy en Lima
salida:  Array<{ convenioId, empresaId, empresaNombre, descuentoBps, terminoId }>
```
Devuelve solo los convenios donde **mi empresa otorga** el descuento, con el término vigente a
esa fecha. Si el array viene vacío, el formulario de venta muestra el estado vacío
correspondiente y no permite continuar.

---

## 5. `modules/usuarios`

### `crearUsuario`
```ts
entrada: {
  empresaId: zUuid.nullable(),          // ignorado si el actor es ADMIN_EMPRESA
  username: zUsername,
  nombres: zNombre,
  apellidos: zNombre,
  rol: z.enum(['SUPERADMIN','ADMIN_EMPRESA','VENDEDOR']),
  empleadoId: zUuid.nullable(),         // enlaza su ficha de empleado (D14)
  sedePorDefectoId: zUuid.nullable(),
}
salida: { usuarioId: string; passwordTemporal: string }
```
- `ADMIN_EMPRESA` solo puede crear `VENDEDOR` o `ADMIN_EMPRESA`, y solo en su empresa.
- Solo `SUPERADMIN` puede crear `SUPERADMIN` (y entonces `empresaId` debe ser `null`).
- Genera contraseña temporal legible de 3 bloques (ej. `verde-42-lima`), `debe_cambiar_password = true`.
- **La contraseña temporal se devuelve una sola vez** y no se persiste en claro. La UI la muestra
  con botón de copiar y un aviso de que no se volverá a mostrar.
- Si `empleadoId` viene: debe ser de la misma empresa y no estar ya asignado a otro usuario.

### `actualizarUsuario`
```ts
entrada: { usuarioId, nombres?, apellidos?, rol?, sedePorDefectoId?, empleadoId?, activo? }
salida:  {}
```
`username` es **inmutable**. Un usuario no puede cambiar su propio rol ni desactivarse a sí mismo.
Desactivar revoca todas sus sesiones en la misma transacción.

### `resetearPassword`
```ts
entrada: { usuarioId: zUuid }
salida:  { passwordTemporal: string }
```
Ver [`02 §6`](./02-LOGICA-NEGOCIO.md).

### `listarUsuarios` *(query)*
```ts
entrada: { empresaId?, rol?, activo?, q?, cursor? }
salida:  Pagina<{ id, username, nombres, apellidos, rol, empresaNombre, activo,
                  ultimoAccesoAt, debeCambiarPassword, ventas30d }>
```

---

## 6. `modules/empleados`

### `buscarPorDni` *(query, la más usada)*
```ts
entrada: { dni: zDni }
salida:
  | { encontrado: true; empleado: {
        id, dni, nombres, apellidos, telefono,
        empresaId, empresaNombre, estado, tieneFotoDni: boolean,
        convenioId, descuentoBps            // el término vigente hoy, para el preview
      } }
  | { encontrado: false; motivo: 'NO_EXISTE'; puedeCrear: true }
  | { encontrado: false; motivo: 'PROPIA_EMPRESA' }
  | { encontrado: false; motivo: 'SIN_CONVENIO'; empresaNombre: string }
  | { encontrado: false; motivo: 'NO_HABILITADO' }
```
Lógica completa en [`02 §4`](./02-LOGICA-NEGOCIO.md). Rate limit 20/min. Audita siempre.

### `crearEmpleado`
```ts
entrada: {
  empresaId: zUuid,
  dni: zDni,
  nombres: zNombre,
  apellidos: zNombre,
  telefono: zTelefono,
  fotoDniBlobPath: z.string().min(1),
  fotoDniSha256: z.string().regex(/^[a-f0-9]{64}$/),
  fotoDniMime: z.enum(['image/jpeg','image/png','image/webp']),
  fotoDniSizeBytes: z.number().int().positive().max(10_485_760),
  consentimiento: z.literal(true, { message: 'Debes confirmar la autorización de datos' }),
}
salida: { empleadoId: string; estado: EstadoEmpleado }
```
Estado resultante: `ACTIVO` si `empresaId` es la del actor y el actor es admin;
`PENDIENTE_VERIFICACION` en cualquier otro caso (D23).
Si `empresaId` no es la del actor, debe existir convenio vigente. DNI duplicado → `CONFLICTO`
con mensaje que indica en qué empresa está registrado.

### `actualizarEmpleado` *(admin de la empresa dueña)*
```ts
entrada: { empleadoId, nombres?, apellidos?, telefono?, estado?: 'ACTIVO'|'INACTIVO' }
salida:  {}
```
El **DNI y la empresa son inmutables**. Cambiar de empresa a un empleado requiere darlo de baja
y crear uno nuevo — así el historial de ventas nunca queda atribuido a la empresa equivocada.

### `verificarEmpleado` / `rechazarEmpleado`
```ts
verificar: entrada { empleadoId }                       salida {}
rechazar:  entrada { empleadoId, motivo: z.string().trim().min(5).max(300) }   salida {}
```
Ver [`02 §10`](./02-LOGICA-NEGOCIO.md). Solo el admin de la empresa **dueña** del empleado.

### `listarEmpleados` *(query)*
```ts
entrada: { empresaId?, estado?, q?, cursor? }   // q busca por DNI exacto o nombre parcial
salida:  Pagina<{ id, dni, nombres, apellidos, telefono, estado, tieneFotoDni,
                  comprasUltimos30d: number, montoUltimos30d: number }>
```

### `contarPendientesVerificacion` *(query)*
```ts
salida: { total: number }
```
Para el badge de la navegación. Cacheable 60 s.

---

## 7. `modules/ventas`

### `crearVenta` — la action central
```ts
entrada: {
  ventaId: zUuid,                      // generado por el CLIENTE → idempotencia
  empleadoCompradorId: zUuid,
  sedeId: zUuid,
  montoBruto: zMontoSoles,
  fechaVenta: zFecha,
  observacion: z.string().trim().max(500).optional(),
  documento: {
    blobPath: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    mime: z.enum(['image/jpeg','image/png','image/webp','application/pdf']),
    sizeBytes: z.number().int().positive().max(10_485_760),
  },
  evidencias: z.array(z.object({
    blobPath: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    mime: z.enum(['image/jpeg','image/png','image/webp']),
    sizeBytes: z.number().int().positive().max(10_485_760),
    descripcion: z.string().trim().max(120).optional(),
  })).max(5).default([]),
}
salida: {
  ventaId, montoBrutoCentimos, descuentoBps,
  montoDescuentoCentimos, montoFinalCentimos, fechaVenta,
  yaExistia: boolean,                  // true si fue una respuesta idempotente
}
```
**El cliente nunca envía el descuento ni el total.** Algoritmo completo en
[`02 §2`](./02-LOGICA-NEGOCIO.md).

### `previsualizarDescuento` *(query, para el campo read-only)*
```ts
entrada: { empleadoCompradorId: zUuid, montoBruto: zMontoSoles, fechaVenta: zFecha }
salida:  { descuentoBps, montoDescuentoCentimos, montoFinalCentimos }
```
Solo cosmético. `crearVenta` recalcula todo desde cero.
Se puede calcular en el cliente con el `descuentoBps` que ya devolvió `buscarPorDni`; esta action
existe para el caso de venta retroactiva, donde el término vigente puede ser otro.

### `anularVenta`
```ts
entrada: { ventaId: zUuid, motivo: z.string().trim().min(5).max(300) }
salida:  {}
```
Reglas en [`02 §9`](./02-LOGICA-NEGOCIO.md).

### `listarVentas` *(query)*
```ts
entrada: {
  desde?: zFecha, hasta?: zFecha,
  empresaId?: zUuid, estado?: 'REGISTRADA'|'ANULADA'|'TODAS',
  q?: string, vendedorId?: zUuid, sedeId?: zUuid,
  montoMin?: zMontoSoles, montoMax?: zMontoSoles,
  soloRevision?: boolean,
  direccion?: 'vendidas'|'compradas',
  orden?: 'fecha_desc'|'fecha_asc'|'monto_desc'|'monto_asc',
  cursor?: string,
}
salida: Pagina<{
  id, fechaVenta, createdAt,
  empleado: { id, dni, nombres, apellidos },
  empresaCompradora: { id, nombre },
  empresaVendedora: { id, nombre },
  sede: { id, nombre },
  vendedor: { id, nombres, apellidos },
  montoBrutoCentimos, descuentoBps, montoDescuentoCentimos, montoFinalCentimos,
  estado, requiereRevision, totalAdjuntos,
}> & { resumen: { cantidad, sumaBruto, sumaDescuento, sumaFinal } }
```
El alcance lo determina el rol, **no el parámetro**: el `VENDEDOR` siempre recibe solo sus
ventas aunque mande `vendedorId` de otro.
`resumen` corresponde al filtro completo, no solo a la página visible.

### `obtenerVenta` *(query)*
```ts
entrada: { ventaId: zUuid }
salida:  { ...los campos del listado,
           observacion, motivoAnulacion, anuladaPor, anuladaAt,
           adjuntos: Array<{ id, tipo, descripcion, mime, sizeBytes, createdAt,
                             puedeVer: boolean }>,
           puedeAnular: boolean }
```
`puedeVer` y `puedeAnular` los calcula el servidor. La UI solo los obedece.

---

## 8. `modules/metricas`

### `obtenerDashboard` *(query)*
```ts
entrada: {
  desde: zFecha, hasta: zFecha,
  direccion: z.enum(['vendidas','compradas']).default('vendidas'),
  empresaId?: zUuid,       // solo SUPERADMIN; si se omite, agrega todo el sistema
  sedeId?: zUuid,
}
salida: {
  totales: {
    cantidad, sumaBrutoCentimos, sumaDescuentoCentimos, sumaFinalCentimos,
    ticketPromedioCentimos,
    variacion: { cantidad: number, bruto: number, descuento: number },  // % vs periodo anterior
  },
  anuladas: { cantidad, sumaBrutoCentimos },
  serie: Array<{ periodo: string, cantidad: number, brutoCentimos: number,
                 descuentoCentimos: number }>,
  granularidad: 'dia' | 'semana' | 'mes',
  porConvenio: Array<{ empresaId, empresaNombre, cantidad,
                       brutoCentimos, descuentoCentimos }>,
  topVendedores: Array<{ usuarioId, nombre, cantidad, brutoCentimos }>,
  topEmpleados:  Array<{ empleadoId, nombre, dni, cantidad, brutoCentimos }>,
  porSede:       Array<{ sedeId, nombre, cantidad, brutoCentimos }>,
  adopcion: { empleadosQueCompraron: number, empleadosActivos: number, tasa: number },
}
```
Una sola action, una sola llamada por carga de dashboard. Internamente son varias consultas
ejecutadas en paralelo con `Promise.all`. Detalle de cada una en
[`02 §11`](./02-LOGICA-NEGOCIO.md).

### `resumenVendedor` *(query, home del vendedor)*
```ts
entrada: {}     // implícito: yo, mes actual
salida:  { cantidadMes, sumaBrutoMesCentimos, sumaDescuentoMesCentimos, ultimas5: Venta[] }
```

---

## 9. `modules/auditoria`

### `listarAuditoria` *(query)*
```ts
entrada: { desde?, hasta?, accion?: AccionAuditoria, entidad?: string, entidadId?: string,
           actorId?: zUuid, cursor? }
salida:  Pagina<{ id, ts, actor: {id, username, nombres, apellidos, rol} | null,
                  accion, entidad, entidadId, datosAntes, datosDespues, ip }>
```
`ADMIN_EMPRESA` ve solo filas con `actor_empresa_id = su empresa`.

### `verificarCadena` *(query, SUPERADMIN)*
```ts
entrada: { desdeId?: number, limite?: number }
salida:  { verificadas: number, rota: false } | { verificadas: number, rota: true, enId: number }
```

---

## 10. Route Handlers

### `POST /api/blob/upload`
Implementa `handleUpload` de `@vercel/blob/client`.

```ts
onBeforeGenerateToken(pathname, clientPayload):
  1. requireSession()
  2. Rate limit upload:<usuarioId>
  3. Validar que pathname coincide con las convenciones de ruta de 02 §8
  4. Devolver: {
       allowedContentTypes: ['image/jpeg','image/png','image/webp','application/pdf'],
       maximumSizeInBytes: 10_485_760,
       addRandomSuffix: true,
       access: 'private',
       tokenPayload: JSON.stringify({ usuarioId: ctx.usuarioId }),
     }

onUploadCompleted({ blob, tokenPayload }):
  Auditar ADJUNTO_SUBIDO con la ruta y el usuario.
  NO se crea fila en `adjuntos` aquí — eso ocurre al guardar la venta o el empleado.
```

### `GET /api/adjuntos/[id]`
Devuelve `302` a una URL firmada con TTL de 600 s. Flujo completo en
[`02 §8`](./02-LOGICA-NEGOCIO.md).

Cabeceras: `Cache-Control: private, no-store`.
Errores: `401` sin sesión, `403` sin permiso, `404` si no existe (mismo cuerpo que el 403, para
no filtrar existencia).

---

## 11. Reglas transversales

- **Nunca** exponer un ID de una entidad de otra empresa en una respuesta de error.
- Toda action que modifica llama a `revalidatePath` de las rutas afectadas antes de retornar.
- Las queries de listado son Server Components con `searchParams`; no hay fetching en cliente
  salvo `buscarPorDni` y `previsualizarDescuento`, que sí son interactivas.
- Ninguna action confía en `empresaId` recibido del cliente cuando el actor no es `SUPERADMIN`:
  se usa siempre el de la sesión.
- Todo `Resultado` de error se registra en el log del servidor con `requestId`, rol y acción.
