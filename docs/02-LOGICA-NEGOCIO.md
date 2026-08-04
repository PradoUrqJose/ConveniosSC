# 02 — Lógica de negocio

Reglas, cálculos, permisos y validaciones. Todo lo de este documento se aplica **en el servidor**.
Lo que el cliente valide es solo para dar feedback inmediato; nunca sustituye la validación
del servidor.

---

## 1. Aritmética de dinero

`src/lib/dinero.ts`. Único lugar donde se hacen cuentas con importes.

```ts
// Un importe es SIEMPRE un entero de céntimos. Nunca un float, nunca un string.
type Centimos = number

// El descuento es SIEMPRE puntos básicos enteros. 15% = 1500.
type Bps = number

/** Redondeo half-up. Math.round ya es half-up para positivos, y aquí nunca hay negativos. */
export function calcularDescuento(bruto: Centimos, bps: Bps): {
  descuento: Centimos
  final: Centimos
} {
  const descuento = Math.round((bruto * bps) / 10_000)
  return { descuento, final: bruto - descuento }
}

/** "1234.5" | "1,234.50" | "1234,50" → 123450 céntimos. Lanza si es inválido. */
export function parsearSoles(entrada: string): Centimos

/** 123450 → "S/ 1,234.50" */
export function formatearSoles(c: Centimos): string
```

### Reglas
- El vendedor ingresa el **total con IGV, antes del descuento** (D16).
- `monto_final = monto_bruto − monto_descuento`. Siempre, sin excepciones ni redondeos extra.
- El input de monto acepta hasta 2 decimales. Más decimales → error de validación, no truncado
  silencioso.
- Máximo: `empresas.tope_monto_venta_centimos` de la empresa vendedora.
- Mínimo: 1 céntimo.

### Casos de prueba obligatorios (`dinero.test.ts`)

| bruto (céntimos) | bps | descuento esperado | final esperado |
|---|---|---|---|
| `10000` (S/100) | `1500` | `1500` | `8500` |
| `3333` | `1500` | `500` | `2833` |
| `1` | `1500` | `0` | `1` |
| `10` | `1500` | `2` | `8` (1.5 → 2, half-up) |
| `99999999` | `10000` | `99999999` | `0` |
| `12345` | `0` | `0` | `12345` |

---

## 2. Registrar una venta — algoritmo completo

Entrada validada (ver [`03-API.md`](./03-API.md) → `crearVenta`).

```
1.  AUTORIZAR
    rol ∈ { VENDEDOR, ADMIN_EMPRESA }.  Usuario activo.  empresa_id no nulo.
    → si no: 403

2.  IDEMPOTENCIA
    SELECT * FROM ventas WHERE id = :ventaId
    → si existe Y vendedor_usuario_id = usuario actual: devolver esa venta, éxito, FIN.
    → si existe Y es de otro usuario: 409 conflicto.

3.  RESOLVER EMPLEADO
    SELECT * FROM empleados WHERE id = :empleadoId
    → no existe                              → 404
    → estado ∈ { RECHAZADO, INACTIVO }       → 422 "empleado no habilitado"
    → empleado.empresa_id = mi empresa       → 422 "no se registra una venta a un empleado
                                                    de tu propia empresa"

4.  RESOLVER CONVENIO
    Buscar el convenio entre (mi empresa, empleado.empresa_id).
    → no existe / estado ≠ VIGENTE / fuera de vigencia a fecha_venta  → 422

5.  RESOLVER TÉRMINO  ← el descuento real
    SELECT * FROM convenio_terminos
     WHERE convenio_id = :convenio
       AND empresa_otorgante_id = :miEmpresa          -- yo vendo, yo otorgo
       AND vigencia_desde <= :fechaVenta
       AND (vigencia_hasta IS NULL OR vigencia_hasta >= :fechaVenta)
    → 0 filas → 422 "el convenio no tiene descuento definido para esa fecha"
    → el constraint EXCLUDE garantiza que nunca hay más de 1 fila.

    ⚠ El término se resuelve por FECHA DE VENTA, no por la fecha de hoy.
      Una venta retroactiva usa el descuento que estaba vigente ese día.

6.  VALIDAR SEDE
    sede.empresa_id = mi empresa Y sede.activo = true   → si no: 422

7.  VALIDAR FECHA
    fecha_venta <= hoy (Lima)
    fecha_venta >= hoy − empresas.dias_retroactivos_venta
    → si no: 422

8.  VALIDAR MONTO
    0 < monto_bruto_centimos <= empresa.tope_monto_venta_centimos   → si no: 422

9.  VALIDAR ADJUNTOS
    Debe existir exactamente 1 blob de tipo DOCUMENTO_VENTA ya subido y no reclamado.
    Si empresa.requiere_evidencia_en_venta → al menos 1 EVIDENCIA.
    Máximo 5 EVIDENCIA por venta.
    Cada blob: existe, lo subió este usuario, y no está asociado a otra venta.
    → si no: 422

10. CALCULAR   ← ignorando por completo cualquier monto que haya mandado el cliente
    { descuento, final } = calcularDescuento(monto_bruto, termino.descuento_bps)

11. TRANSACCIÓN
    a) INSERT INTO ventas (... descuento_bps = termino.descuento_bps, termino_id = termino.id)
    b) INSERT INTO adjuntos (uno por blob, con venta_id)
    c) INSERT INTO auditoria (VENTA_CREADA, datos_despues = snapshot completo)
    d) Si algún adjunto tiene un sha256 ya presente en otra venta de la misma empresa
       en los últimos 90 días → registrar auditoría extra con la coincidencia.
       NO bloquear: puede ser legítimo. Solo dejar rastro.
    COMMIT

12. RESPUESTA
    { ventaId, montoBruto, descuentoBps, montoDescuento, montoFinal, fechaVenta }
```

---

## 3. Matriz de permisos

`E` = solo dentro de su propia empresa. `P` = solo sus propios registros.

| Acción | SUPERADMIN | ADMIN_EMPRESA | VENDEDOR |
|---|:--:|:--:|:--:|
| Crear / editar empresa | ✅ | ❌ | ❌ |
| Crear / editar convenio y términos | ✅ | ❌ | ❌ |
| Ver convenios de su empresa | ✅ | ✅ lectura | ❌ |
| Crear / editar sedes | ✅ | E | ❌ |
| Crear usuario | ✅ | E, solo rol `VENDEDOR` o `ADMIN_EMPRESA` | ❌ |
| Resetear contraseña de usuario | ✅ | E | ❌ |
| Desactivar usuario | ✅ | E | ❌ |
| Crear empleado de su empresa | ✅ | E → `ACTIVO` | E → `ACTIVO` |
| Crear empleado de empresa convenio | ✅ | ✅ → `PENDIENTE` | ✅ → `PENDIENTE` |
| Editar empleado | ✅ | E | ❌ |
| Verificar / rechazar empleado | ✅ | E (los de **su** empresa) | ❌ |
| Buscar empleado por DNI | ✅ | ✅ | ✅ |
| Registrar venta | ✅ | ✅ | ✅ |
| Ver ventas | todas | E (vendidas **y** compradas) | P |
| Ver adjuntos de una venta | ✅ | solo si su empresa es la **vendedora** | solo las suyas |
| Anular venta | ✅ | E, solo si su empresa es la vendedora, sin límite de tiempo | P, **solo el mismo día** |
| Ver dashboard | global | E | ❌ (ve su resumen personal en el home) |
| Ver auditoría | todo | E | ❌ |

### Implementación
Cada Server Action empieza con una guarda explícita. No hay autorización implícita ni derivada
de que la UI oculte un botón.

```ts
const ctx = await requireSession()          // 401 si no hay sesión válida
requireRol(ctx, ['ADMIN_EMPRESA'])          // 403 si el rol no aplica
requireMismaEmpresa(ctx, recurso.empresaId) // 403 si es de otra empresa
```

---

## 4. Búsqueda de empleado por DNI

Endpoint sensible: consulta datos personales por identificador nacional.

```
ENTRADA: dni (8 dígitos)
CONTEXTO: usuario autenticado, empresa E

1. Rate limit: máx 20 búsquedas / minuto por usuario. Superado → 429.
2. SELECT empleado WHERE dni = :dni       (UNIQUE global, 0 o 1 fila)
3. Auditar SIEMPRE (BUSQUEDA_DNI) con el DNI y el resultado.
4. Resolver la respuesta:

   a) 0 filas
      → { encontrado: false, puedeCrear: true }

   b) empleado.empresa_id = E  (es de mi propia empresa)
      → { encontrado: false, motivo: 'PROPIA_EMPRESA' }
        Mensaje: "Este DNI pertenece a un empleado de tu propia empresa.
                  El beneficio de convenio aplica solo a empleados de la empresa aliada."
        NO se devuelven nombres.

   c) empleado.empresa_id tiene convenio VIGENTE con E
      → { encontrado: true, empleado: { id, nombres, apellidos, dni, telefono,
                                        empresaNombre, estado, tieneFotoDni } }

   d) empleado.empresa_id NO tiene convenio vigente con E
      → { encontrado: false, motivo: 'SIN_CONVENIO', empresaNombre }
        Mensaje: "Este DNI está registrado en <Empresa>, que no tiene convenio
                  vigente con tu empresa."
        NO se devuelven nombres ni teléfono.

   e) empleado.estado ∈ { RECHAZADO, INACTIVO }
      → { encontrado: false, motivo: 'NO_HABILITADO' }
```

> En los casos (b), (d) y (e) se revela **la existencia** del DNI y, en (d), el nombre de la
> empresa. Es un mínimo necesario para que el vendedor entienda por qué no puede continuar. No se
> revela ningún dato personal de la persona.

### Crear empleado desde el formulario de venta
- El vendedor solo puede crear empleados de **una empresa con convenio vigente** con la suya.
- El DNI viene pre-llenado y bloqueado (el que acaba de buscar).
- La empresa viene pre-seleccionada si hay un solo convenio vigente; si hay varios, se elige.
- Foto del DNI **obligatoria** al crear.
- Estado resultante: `PENDIENTE_VERIFICACION` (D23).
- Debe mostrarse y aceptarse el texto de consentimiento (§7).
- Si el DNI ya existe → 409, no se sobrescribe nada.

---

## 5. Rate limits

| Clave | Límite | Ventana | Al superarse |
|---|---|---|---|
| `login:<username>` | 5 intentos fallidos | 15 min | Bloqueo del usuario hasta `now() + 15 min` |
| `login:ip:<ip>` | 30 intentos | 15 min | 429 |
| `dni:<usuarioId>` | 20 | 1 min | 429 |
| `venta:<usuarioId>` | 30 | 1 min | 429 |
| `upload:<usuarioId>` | 60 | 5 min | 429 |
| `adjunto:<usuarioId>` | 100 | 5 min | 429 |

Los intentos fallidos de login se cuentan en `usuarios.intentos_fallidos` y se reinician a `0`
tras un login exitoso. El mensaje de error de login es **siempre el mismo** —
*"Usuario o contraseña incorrectos"*— nunca revela si el usuario existe.

---

## 6. Autenticación y sesión

### Login
```
1. Rate limit por username e IP.
2. Buscar usuario por username (case-insensitive, columna CITEXT).
3. Si no existe → hacer un hash falso igualmente (evita timing attack) → error genérico.
4. Si bloqueado_hasta > now() → error genérico (no revelar el bloqueo).
5. Verificar argon2id.
6. Fallo → intentos_fallidos++, auditar LOGIN_FALLIDO, error genérico.
7. Éxito → intentos_fallidos = 0, bloqueado_hasta = NULL,
           ultimo_acceso_at = now(), crear sesión, auditar LOGIN_OK.
8. Si usuario.debe_cambiar_password → redirigir a /perfil/password (bloqueante).
```

### Cookie
```
nombre:   convenios_sesion
valor:    32 bytes aleatorios en base64url  (la BD guarda solo su sha256)
httpOnly: true
secure:   true       (false solo en localhost)
sameSite: 'lax'
path:     '/'
maxAge:   30 días
```

### Parámetros de argon2id
`memoryCost: 19456` (19 MiB), `timeCost: 2`, `parallelism: 1`, `outputLen: 32`.
Son los mínimos recomendados por OWASP y funcionan dentro de los límites de una función de Vercel.

### Política de contraseña
Mínimo 8 caracteres, al menos una letra y un número. Sin exigencias de símbolos ni de
caducidad — reglas que en la práctica producen contraseñas peores.
Se rechazan las 100 contraseñas más comunes mediante una lista embebida.

### Reseteo (sin email — D13)
1. El admin abre la ficha del usuario y pulsa *"Restablecer contraseña"*.
2. El sistema genera una contraseña temporal legible (ej. `verde-42-lima`, tres bloques).
3. Se muestra **una sola vez** en pantalla, con botón de copiar. No se guarda en claro.
4. Se marca `debe_cambiar_password = true` y se **revocan todas las sesiones** del usuario.
5. Se audita `PASSWORD_RESETEADA`.

---

## 7. Consentimiento de datos personales

Texto exacto que aparece en el formulario de creación de empleado, con checkbox obligatorio:

> **Autorización de tratamiento de datos**
> Declaro que el titular de los datos ha sido informado y autoriza el registro de sus nombres,
> apellidos, documento de identidad, teléfono, la imagen de su documento de identidad y, cuando
> corresponda, su fotografía, con la finalidad exclusiva de administrar y controlar el beneficio
> de convenio institucional. Los datos se conservarán mientras dure el vínculo con la empresa y
> podrán ser consultados por los administradores de las empresas participantes.

El checkbox se registra en auditoría junto con el evento `EMPLEADO_CREADO`.

---

## 8. Manejo de archivos

### Flujo de subida
```
1. Cliente comprime la imagen (browser-image-compression):
     maxWidthOrHeight: 1600, maxSizeMB: 1, useWebWorker: true, fileType: 'image/jpeg'
     Los PDF no se comprimen.
2. Cliente calcula sha256 del archivo final (Web Crypto).
3. Cliente pide token de subida a POST /api/blob/upload (handleUpload de Vercel Blob).
   El servidor valida: sesión, rate limit, mime permitido, tamaño <= 10 MB.
4. Cliente sube directo a Vercel Blob con access: 'private'.
5. La ruta del blob queda en el estado del formulario. El registro en `adjuntos` se crea
   recién al guardar la venta o el empleado.
```

### Convención de rutas
```
empleados/{empleadoId}/dni/{uuid}.jpg
ventas/{ventaId}/documento/{uuid}.{ext}
ventas/{ventaId}/evidencia/{orden}-{uuid}.jpg
```

### Blobs huérfanos
Un blob subido cuya venta nunca se guardó queda huérfano. Job manual en v1, `cron` diario en
fase 2: eliminar blobs con más de 24 h sin fila en `adjuntos`.

### Lectura
```
GET /api/adjuntos/[id]
  1. requireSession()
  2. Cargar adjunto + su venta o empleado
  3. Autorizar según §3 (adjuntos de venta: solo empresa vendedora)
  4. Rate limit
  5. Auditar ADJUNTO_VISTO
  6. Generar URL firmada de Vercel Blob con TTL 600 s
  7. 302 redirect
```
Nunca se devuelve una URL pública ni se cachea la respuesta
(`Cache-Control: private, no-store`).

### Validación server-side del tipo real
Leer los primeros bytes y comparar con la firma esperada. No confiar en la extensión ni en el
`Content-Type` declarado.

| Tipo | Firma (hex) |
|---|---|
| JPEG | `FF D8 FF` |
| PNG | `89 50 4E 47 0D 0A 1A 0A` |
| WebP | `52 49 46 46 …… 57 45 42 50` |
| PDF | `25 50 44 46 2D` |

---

## 9. Anulación de ventas (D20)

```
PUEDE ANULAR:
  - VENDEDOR: su propia venta, si fecha (Lima) de created_at = hoy
  - ADMIN_EMPRESA: cualquier venta donde su empresa sea la VENDEDORA, sin límite de tiempo
  - SUPERADMIN: cualquiera

REQUIERE: motivo de 5 a 300 caracteres.

EFECTO (una transacción):
  UPDATE ventas SET estado='ANULADA', anulada_at=now(),
                    anulada_por_usuario_id=:actor, motivo_anulacion=:motivo
   WHERE id=:id AND estado='REGISTRADA'
  INSERT auditoria (VENTA_ANULADA, datos_antes=snapshot, datos_despues={motivo})

Una venta ANULADA no se puede reactivar. Si fue un error, se registra una venta nueva.
Los adjuntos NO se borran.
```

---

## 10. Verificación de empleados (D23)

**Bandeja**: `empleados WHERE empresa_id = mi empresa AND estado = 'PENDIENTE_VERIFICACION'`,
ordenados por `created_at` ascendente. Badge con el conteo en la navegación del admin.

**Verificar** → `estado = 'ACTIVO'`, `verificado_por`, `verificado_at`. Auditar.

**Rechazar** → requiere motivo (5..300). En la misma transacción:
```sql
UPDATE empleados SET estado='RECHAZADO', motivo_rechazo=:motivo, ...;
UPDATE ventas SET requiere_revision = true
 WHERE empleado_comprador_id = :id AND estado = 'REGISTRADA';
```
Las ventas **no se anulan automáticamente** — anular es una decisión humana. Quedan marcadas y
aparecen destacadas en la lista de la empresa vendedora con un aviso.

El admin también puede **corregir los datos** del empleado pendiente y verificarlo en un paso.

---

## 11. Métricas (D26)

Todas las consultas parten de `fecha_venta` y **excluyen** `estado = 'ANULADA'` de los totales.
Las anuladas se muestran aparte, como su propio indicador.

Zona horaria `America/Lima` para todos los agrupamientos:
`date_trunc('day', fecha_venta)` — `fecha_venta` ya es `DATE` en hora local, así que no hay
conversión que hacer. Este es justamente el motivo de usar `DATE` y no `TIMESTAMPTZ`.

| Bloque | Consulta |
|---|---|
| **Totales del periodo** | `COUNT(*)`, `SUM(monto_bruto_centimos)`, `SUM(monto_descuento_centimos)`, `SUM(monto_final_centimos)` filtrando por rango y empresa. Se calcula también el periodo inmediatamente anterior de la misma duración para mostrar la variación %. |
| **Serie temporal** | `GROUP BY fecha_venta`. Granularidad automática: ≤ 31 días → día; ≤ 180 → semana (`date_trunc('week')`); más → mes. Rellenar los días sin ventas con cero en la capa de aplicación, no en SQL. |
| **Por convenio** | `GROUP BY empresa_compradora_id` (si veo como vendedor) o `empresa_vendedora_id` (como comprador). Devuelve nombre, nº ventas, bruto, descuento. |
| **Rankings** | Top 10 vendedores (`GROUP BY vendedor_usuario_id`), top 10 empleados beneficiarios (`GROUP BY empleado_comprador_id`), desglose por sede (`GROUP BY sede_id`). |
| **Adopción** | `COUNT(DISTINCT empleado_comprador_id)` de mis empleados que compraron en el periodo, sobre `COUNT(*)` de empleados `ACTIVO` de mi empresa. |
| **Anuladas** | `COUNT(*)` y `SUM(monto_bruto_centimos)` de las `ANULADA` del periodo, mostrado como indicador secundario. |

El **ADMIN_EMPRESA** ve dos pestañas: **"Vendí"** (`empresa_vendedora_id = mi empresa`) y
**"Compraron mis empleados"** (`empresa_compradora_id = mi empresa`). Son consultas simétricas
con el mismo componente.

Rango por defecto: **mes actual**. Presets: hoy, últimos 7 días, mes actual, mes anterior,
últimos 90 días, rango personalizado.

---

## 12. Filtros del listado de ventas

Estado en la URL (query string) para que sea compartible y sobreviva al refresco.

| Filtro | Parámetro | Tipo | Disponible para |
|---|---|---|---|
| Rango de fechas | `desde`, `hasta` | `YYYY-MM-DD` | todos |
| Empresa convenio | `empresa` | uuid | todos |
| Estado | `estado` | `REGISTRADA` \| `ANULADA` \| `TODAS` (default `TODAS`) | todos |
| Búsqueda libre | `q` | texto: DNI exacto o nombre/apellido parcial del empleado | todos |
| Vendedor | `vendedor` | uuid | admin |
| Sede | `sede` | uuid | admin |
| Monto mínimo / máximo | `montoMin`, `montoMax` | soles con 2 decimales | todos |
| Solo con revisión pendiente | `revision` | `1` | admin |
| Dirección | `dir` | `vendidas` \| `compradas` (default `vendidas`) | admin |
| Orden | `orden` | `fecha_desc` (default), `fecha_asc`, `monto_desc`, `monto_asc` | todos |

**Paginación por cursor**, no por `OFFSET`: `cursor = (fecha_venta, id)` del último elemento.
25 por página. El total se calcula con un `COUNT` separado, solo en la primera página.

---

## 13. Zona horaria y fechas

`src/lib/fechas.ts`. Constante `ZONA = 'America/Lima'`.

- `hoyLima(): string` → `YYYY-MM-DD` del día actual en Lima. **Usar siempre esta**, nunca
  `new Date().toISOString().slice(0,10)`, que da el día en UTC y falla entre las 19:00 y 00:00.
- Perú no aplica horario de verano, pero se usa `date-fns-tz` igual para no depender de eso.
- Las fechas de negocio (`fecha_venta`, vigencias) son `DATE` y se manipulan como strings
  `YYYY-MM-DD`, nunca como objetos `Date` — así no hay corrimientos por zona.
- Los `TIMESTAMPTZ` se muestran formateados a Lima en la UI.

---

## 14. Errores

Todas las Server Actions devuelven un resultado discriminado, nunca lanzan al cliente:

```ts
type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; codigo: CodigoError; mensaje: string; campo?: string }

type CodigoError =
  | 'NO_AUTENTICADO' | 'SIN_PERMISO' | 'NO_ENCONTRADO' | 'VALIDACION'
  | 'CONFLICTO' | 'LIMITE_EXCEDIDO' | 'REGLA_NEGOCIO' | 'ERROR_INTERNO'
```

- `mensaje` está en español, dirigido al usuario final, y explica **qué hacer**, no solo qué
  falló. Mal: *"Validación fallida"*. Bien: *"El monto no puede superar S/ 50,000. Si la venta es
  mayor, coordina con tu administrador."*
- `campo` permite que el formulario resalte el input correspondiente.
- `ERROR_INTERNO` nunca expone el error real al cliente; se registra en el log del servidor con
  el `requestId` y al usuario se le muestra ese identificador para soporte.
