# 01 — Modelo de datos

Postgres 16+. Todas las tablas en el esquema `public`. Todos los `id` son `UUID v4` salvo
`auditoria` (`BIGSERIAL`, necesita orden estricto).

## Convenciones obligatorias

| Regla | Detalle |
|---|---|
| **Dinero** | Siempre `BIGINT` en **céntimos**. Nombre de columna termina en `_centimos`. Prohibido `NUMERIC`, `REAL`, `DOUBLE` o `float` de JS para importes. |
| **Porcentajes** | Siempre `INTEGER` en **puntos básicos** (bps). `15%` → `1500`. Nombre termina en `_bps`. Rango `0..10000`. |
| **Fechas de negocio** | `DATE` (ej. `fecha_venta`). Los cortes se hacen en `America/Lima`. |
| **Marcas de tiempo** | `TIMESTAMPTZ` con default `now()`. Nombre termina en `_at`. |
| **Booleanos** | `NOT NULL` con default explícito. Nunca nulables. |
| **Borrado** | No existe. Todo se desactiva (`activo = false`) o cambia de estado. |
| **Textos** | `TEXT` con `CHECK` de longitud, no `VARCHAR(n)` arbitrarios. |
| **Nombres** | `snake_case`, tablas en plural, español. |

### Extensiones requeridas
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- constraint EXCLUDE de vigencias
CREATE EXTENSION IF NOT EXISTS citext;      -- username case-insensitive
```

---

## 1. Tipos enumerados

```sql
CREATE TYPE rol_usuario     AS ENUM ('SUPERADMIN', 'ADMIN_EMPRESA', 'VENDEDOR');
CREATE TYPE estado_empleado AS ENUM ('PENDIENTE_VERIFICACION', 'ACTIVO', 'RECHAZADO', 'INACTIVO');
CREATE TYPE estado_convenio AS ENUM ('BORRADOR', 'VIGENTE', 'SUSPENDIDO', 'TERMINADO');
CREATE TYPE estado_venta    AS ENUM ('REGISTRADA', 'ANULADA');
CREATE TYPE tipo_adjunto    AS ENUM ('FOTO_DNI', 'DOCUMENTO_VENTA', 'EVIDENCIA');

CREATE TYPE accion_auditoria AS ENUM (
  'LOGIN_OK', 'LOGIN_FALLIDO', 'LOGOUT', 'PASSWORD_CAMBIADA', 'PASSWORD_RESETEADA',
  'EMPRESA_CREADA', 'EMPRESA_ACTUALIZADA',
  'SEDE_CREADA', 'SEDE_ACTUALIZADA',
  'CONVENIO_CREADO', 'CONVENIO_ACTUALIZADO', 'TERMINO_CREADO', 'TERMINO_CERRADO',
  'USUARIO_CREADO', 'USUARIO_ACTUALIZADO', 'USUARIO_DESACTIVADO',
  'EMPLEADO_CREADO', 'EMPLEADO_ACTUALIZADO', 'EMPLEADO_VERIFICADO', 'EMPLEADO_RECHAZADO',
  'BUSQUEDA_DNI',
  'VENTA_CREADA', 'VENTA_ANULADA',
  'ADJUNTO_SUBIDO', 'ADJUNTO_VISTO',
  'EXPORTACION'
);
```

---

## 2. `empresas`

| Columna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | `UUID` | no | `gen_random_uuid()` | PK |
| `ruc` | `TEXT` | no | — | `UNIQUE`. `CHECK (ruc ~ '^[0-9]{11}$')` |
| `razon_social` | `TEXT` | no | — | `CHECK (length between 3 and 200)` |
| `nombre_comercial` | `TEXT` | no | — | `CHECK (length between 2 and 100)`. Es el que se muestra en la UI |
| `logo_blob_path` | `TEXT` | sí | `NULL` | Opcional, se muestra en listados |
| `tope_monto_venta_centimos` | `BIGINT` | no | `5000000` | S/ 50 000. Anti error de tipeo. `CHECK (> 0)` |
| `requiere_evidencia_en_venta` | `BOOLEAN` | no | `false` | Si `true`, el formulario exige ≥1 adjunto `EVIDENCIA` |
| `dias_retroactivos_venta` | `SMALLINT` | no | `7` | `CHECK (between 0 and 30)` |
| `activo` | `BOOLEAN` | no | `true` | |
| `created_at` | `TIMESTAMPTZ` | no | `now()` | |
| `updated_at` | `TIMESTAMPTZ` | no | `now()` | Actualizado por trigger |

Índices: `UNIQUE (ruc)`, `INDEX (activo) WHERE activo`.

---

## 3. `sedes`

| Columna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | `UUID` | no | `gen_random_uuid()` | PK |
| `empresa_id` | `UUID` | no | — | FK → `empresas(id)` `ON DELETE RESTRICT` |
| `nombre` | `TEXT` | no | — | `CHECK (length between 2 and 80)` |
| `direccion` | `TEXT` | sí | `NULL` | `CHECK (length <= 200)` |
| `activo` | `BOOLEAN` | no | `true` | |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | no | `now()` | |

```sql
CREATE UNIQUE INDEX sedes_empresa_nombre_uk ON sedes (empresa_id, lower(nombre));
CREATE INDEX sedes_empresa_idx ON sedes (empresa_id) WHERE activo;
```

> **Regla**: cada empresa debe tener al menos una sede antes de poder registrar ventas. Al crear
> una empresa, el superadmin crea automáticamente una sede llamada `"Principal"`.

---

## 4. `convenios`

El par de empresas. **Orden canónico**: `empresa_a_id < empresa_b_id` comparando UUID. La
aplicación debe ordenar los dos IDs antes de insertar.

| Columna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | `UUID` | no | `gen_random_uuid()` | PK |
| `empresa_a_id` | `UUID` | no | — | FK → `empresas(id)` |
| `empresa_b_id` | `UUID` | no | — | FK → `empresas(id)` |
| `estado` | `estado_convenio` | no | `'BORRADOR'` | |
| `vigencia_desde` | `DATE` | no | — | |
| `vigencia_hasta` | `DATE` | sí | `NULL` | `NULL` = indefinido |
| `notas` | `TEXT` | sí | `NULL` | `CHECK (length <= 1000)` |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | no | `now()` | |
| `creado_por_usuario_id` | `UUID` | sí | — | FK → `usuarios(id)` |

```sql
CHECK (empresa_a_id < empresa_b_id)                     -- impide A=B y pares invertidos
CHECK (vigencia_hasta IS NULL OR vigencia_hasta >= vigencia_desde)
UNIQUE (empresa_a_id, empresa_b_id)                     -- un solo convenio por par
CREATE INDEX convenios_empresa_a_idx ON convenios (empresa_a_id);
CREATE INDEX convenios_empresa_b_idx ON convenios (empresa_b_id);
```

**Convenio vigente** significa: `estado = 'VIGENTE'` **y** `CURRENT_DATE` (en Lima) dentro de
`[vigencia_desde, vigencia_hasta]`.

---

## 5. `convenio_terminos`

El descuento **direccional** e historizado. `empresa_otorgante_id` es quien **da** el descuento,
es decir la **empresa vendedora**.

| Columna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | `UUID` | no | `gen_random_uuid()` | PK |
| `convenio_id` | `UUID` | no | — | FK → `convenios(id)` `ON DELETE CASCADE` |
| `empresa_otorgante_id` | `UUID` | no | — | FK → `empresas(id)`. Debe ser `empresa_a_id` o `empresa_b_id` del convenio |
| `descuento_bps` | `INTEGER` | no | — | `CHECK (between 0 and 10000)` |
| `tope_mensual_centimos` | `BIGINT` | sí | `NULL` | **Reservado. Sin lógica en v1 (D21)** |
| `tope_mensual_cantidad` | `SMALLINT` | sí | `NULL` | **Reservado. Sin lógica en v1 (D21)** |
| `vigencia_desde` | `DATE` | no | — | |
| `vigencia_hasta` | `DATE` | sí | `NULL` | |
| `created_at` | `TIMESTAMPTZ` | no | `now()` | |
| `creado_por_usuario_id` | `UUID` | sí | — | FK → `usuarios(id)` |

```sql
-- No puede haber dos términos solapados para la misma dirección del mismo convenio.
-- Esto garantiza que "el término vigente" nunca sea ambiguo.
ALTER TABLE convenio_terminos ADD CONSTRAINT convenio_terminos_sin_solape
  EXCLUDE USING gist (
    convenio_id           WITH =,
    empresa_otorgante_id  WITH =,
    daterange(vigencia_desde, COALESCE(vigencia_hasta, 'infinity'::date), '[]') WITH &&
  );

CREATE INDEX convenio_terminos_lookup_idx
  ON convenio_terminos (convenio_id, empresa_otorgante_id, vigencia_desde DESC);
```

**Trigger `trg_termino_otorgante_valido`** (`BEFORE INSERT OR UPDATE`): lanza excepción si
`empresa_otorgante_id` no coincide con `empresa_a_id` ni `empresa_b_id` del convenio. No se puede
expresar como `CHECK` porque requiere consultar otra tabla.

**Cambiar un porcentaje** nunca es un `UPDATE`. Es: cerrar el término vigente
(`vigencia_hasta = ayer`) e insertar uno nuevo desde hoy. Ambas operaciones en la misma
transacción, con auditoría `TERMINO_CERRADO` + `TERMINO_CREADO`.

---

## 6. `empleados`

| Columna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | `UUID` | no | `gen_random_uuid()` | PK |
| `empresa_id` | `UUID` | no | — | FK → `empresas(id)` `ON DELETE RESTRICT` |
| `dni` | `TEXT` | no | — | **`UNIQUE` global (D15)**. `CHECK (dni ~ '^[0-9]{8}$')` |
| `nombres` | `TEXT` | no | — | `CHECK (length between 2 and 80)` |
| `apellidos` | `TEXT` | no | — | `CHECK (length between 2 and 80)` |
| `telefono` | `TEXT` | sí | `NULL` | `CHECK (telefono ~ '^[0-9]{6,15}$')` |
| `estado` | `estado_empleado` | no | `'ACTIVO'` | Ver máquina de estados abajo |
| `creado_por_usuario_id` | `UUID` | sí | — | FK → `usuarios(id)` |
| `verificado_por_usuario_id` | `UUID` | sí | `NULL` | FK → `usuarios(id)` |
| `verificado_at` | `TIMESTAMPTZ` | sí | `NULL` | |
| `motivo_rechazo` | `TEXT` | sí | `NULL` | `CHECK (length <= 300)` |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | no | `now()` | |

```sql
UNIQUE (dni)
CREATE INDEX empleados_empresa_idx ON empleados (empresa_id);
CREATE INDEX empleados_estado_idx  ON empleados (empresa_id, estado);
-- Búsqueda por nombre en el panel de admin
CREATE INDEX empleados_nombre_trgm_idx ON empleados
  USING gin ((nombres || ' ' || apellidos) gin_trgm_ops);   -- requiere pg_trgm
```

### Máquina de estados

```
Creado por ADMIN de su propia empresa        → ACTIVO
Creado por VENDEDOR de la empresa convenio   → PENDIENTE_VERIFICACION
                                                  │
                    ADMIN de la empresa dueña ────┼──→ ACTIVO    (verificar)
                                                  └──→ RECHAZADO (con motivo)
ACTIVO   ──desactivar (admin)──→ INACTIVO
INACTIVO ──reactivar  (admin)──→ ACTIVO
RECHAZADO ──corregir datos + verificar──→ ACTIVO
```

- Se puede **registrar ventas** contra empleados `ACTIVO` y `PENDIENTE_VERIFICACION`.
- **No** se puede contra `RECHAZADO` ni `INACTIVO`.
- Al pasar a `RECHAZADO`, todas sus ventas `REGISTRADA` reciben `requiere_revision = true`.

La foto del DNI no es una columna: vive en `adjuntos` con `tipo = 'FOTO_DNI'` y `empleado_id`.

---

## 7. `usuarios`

| Columna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | `UUID` | no | `gen_random_uuid()` | PK |
| `empresa_id` | `UUID` | sí | — | FK → `empresas(id)`. `NULL` **solo** para `SUPERADMIN` |
| `username` | `CITEXT` | no | — | `UNIQUE` global. `CHECK (username ~ '^[a-z0-9._-]{3,32}$')` |
| `password_hash` | `TEXT` | no | — | argon2id |
| `debe_cambiar_password` | `BOOLEAN` | no | `true` | Fuerza cambio en el primer ingreso |
| `nombres` | `TEXT` | no | — | `CHECK (length between 2 and 80)` |
| `apellidos` | `TEXT` | no | — | `CHECK (length between 2 and 80)` |
| `email` | `TEXT` | sí | `NULL` | **Reservado. Sin uso en v1 (D12)** |
| `rol` | `rol_usuario` | no | — | |
| `empleado_id` | `UUID` | sí | `NULL` | FK → `empleados(id)`. `UNIQUE`. Enlaza a su ficha de empleado (D14) |
| `sede_por_defecto_id` | `UUID` | sí | `NULL` | FK → `sedes(id)`. Preselecciona la sede en el formulario |
| `activo` | `BOOLEAN` | no | `true` | |
| `intentos_fallidos` | `SMALLINT` | no | `0` | |
| `bloqueado_hasta` | `TIMESTAMPTZ` | sí | `NULL` | Bloqueo temporal tras 5 intentos |
| `ultimo_acceso_at` | `TIMESTAMPTZ` | sí | `NULL` | |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | no | `now()` | |
| `creado_por_usuario_id` | `UUID` | sí | — | FK → `usuarios(id)` |

```sql
CHECK (
     (rol =  'SUPERADMIN' AND empresa_id IS NULL)
  OR (rol <> 'SUPERADMIN' AND empresa_id IS NOT NULL)
)
UNIQUE (username)
UNIQUE (empleado_id)
CREATE INDEX usuarios_empresa_idx ON usuarios (empresa_id) WHERE activo;
```

**Trigger `trg_usuario_empleado_misma_empresa`**: si `empleado_id IS NOT NULL`, verifica que
`empleados.empresa_id = usuarios.empresa_id`. Igual para `sede_por_defecto_id`.

---

## 8. `sesiones`

Sesión opaca en BD para poder revocarla. La cookie guarda un token aleatorio de 32 bytes en
base64url; la BD guarda solo su SHA-256.

| Columna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | `UUID` | no | `gen_random_uuid()` | PK |
| `token_hash` | `TEXT` | no | — | `UNIQUE`. `sha256(token)` en hex |
| `usuario_id` | `UUID` | no | — | FK → `usuarios(id)` `ON DELETE CASCADE` |
| `created_at` | `TIMESTAMPTZ` | no | `now()` | |
| `expires_at` | `TIMESTAMPTZ` | no | — | `created_at + 30 días` |
| `ultimo_uso_at` | `TIMESTAMPTZ` | no | `now()` | Se refresca como máximo cada 15 min |
| `ip` | `INET` | sí | `NULL` | |
| `user_agent` | `TEXT` | sí | `NULL` | |
| `revocada_at` | `TIMESTAMPTZ` | sí | `NULL` | |

```sql
CREATE INDEX sesiones_usuario_idx  ON sesiones (usuario_id);
CREATE INDEX sesiones_expires_idx  ON sesiones (expires_at);
```

Sesión válida ⇔ `revocada_at IS NULL AND expires_at > now() AND usuario.activo`.
Desactivar un usuario revoca todas sus sesiones en la misma transacción.

---

## 9. `ventas`

El `id` lo **genera el cliente** (UUID v4) al abrir el formulario. Es la clave de idempotencia:
reenviar el mismo `id` devuelve la venta existente en lugar de crear un duplicado.

| Columna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | `UUID` | no | — | PK, **provisto por el cliente** |
| `empresa_vendedora_id` | `UUID` | no | — | FK → `empresas(id)`. Igual a la empresa del vendedor |
| `empresa_compradora_id` | `UUID` | no | — | FK → `empresas(id)`. Empresa del empleado |
| `convenio_id` | `UUID` | no | — | FK → `convenios(id)` |
| `termino_id` | `UUID` | no | — | FK → `convenio_terminos(id)`. Traza exacta del término aplicado |
| `sede_id` | `UUID` | no | — | FK → `sedes(id)`. Sede de la empresa vendedora |
| `vendedor_usuario_id` | `UUID` | no | — | FK → `usuarios(id)` |
| `empleado_comprador_id` | `UUID` | no | — | FK → `empleados(id)` |
| `monto_bruto_centimos` | `BIGINT` | no | — | `CHECK (> 0)`. Total con IGV, antes del descuento (D16) |
| `descuento_bps` | `INTEGER` | no | — | Snapshot. `CHECK (between 0 and 10000)` |
| `monto_descuento_centimos` | `BIGINT` | no | — | `CHECK (>= 0)` |
| `monto_final_centimos` | `BIGINT` | no | — | `CHECK (>= 0)` |
| `moneda` | `TEXT` | no | `'PEN'` | `CHECK (moneda = 'PEN')` en v1 |
| `fecha_venta` | `DATE` | no | — | Fecha de negocio, en Lima |
| `estado` | `estado_venta` | no | `'REGISTRADA'` | |
| `observacion` | `TEXT` | sí | `NULL` | `CHECK (length <= 500)` |
| `requiere_revision` | `BOOLEAN` | no | `false` | `true` si el empleado fue rechazado después |
| `anulada_por_usuario_id` | `UUID` | sí | `NULL` | FK → `usuarios(id)` |
| `anulada_at` | `TIMESTAMPTZ` | sí | `NULL` | |
| `motivo_anulacion` | `TEXT` | sí | `NULL` | `CHECK (length between 5 and 300)` |
| `created_at` | `TIMESTAMPTZ` | no | `now()` | Instante real del registro |

```sql
CHECK (empresa_vendedora_id <> empresa_compradora_id)
CHECK (monto_final_centimos = monto_bruto_centimos - monto_descuento_centimos)
CHECK ((estado = 'ANULADA') = (anulada_at IS NOT NULL))
CHECK ((anulada_at IS NULL) OR (motivo_anulacion IS NOT NULL AND anulada_por_usuario_id IS NOT NULL))

CREATE INDEX ventas_vendedora_fecha_idx  ON ventas (empresa_vendedora_id, fecha_venta DESC);
CREATE INDEX ventas_compradora_fecha_idx ON ventas (empresa_compradora_id, fecha_venta DESC);
CREATE INDEX ventas_vendedor_fecha_idx   ON ventas (vendedor_usuario_id, fecha_venta DESC);
CREATE INDEX ventas_empleado_fecha_idx   ON ventas (empleado_comprador_id, fecha_venta DESC);
CREATE INDEX ventas_sede_fecha_idx       ON ventas (sede_id, fecha_venta DESC);
CREATE INDEX ventas_revision_idx         ON ventas (empresa_vendedora_id) WHERE requiere_revision;
```

**Las ventas nunca se editan.** No hay `updated_at`. Las únicas columnas mutables son las cuatro
de anulación y `requiere_revision`.

---

## 10. `adjuntos`

| Columna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | `UUID` | no | `gen_random_uuid()` | PK |
| `venta_id` | `UUID` | sí | `NULL` | FK → `ventas(id)` `ON DELETE RESTRICT` |
| `empleado_id` | `UUID` | sí | `NULL` | FK → `empleados(id)` `ON DELETE RESTRICT` |
| `tipo` | `tipo_adjunto` | no | — | |
| `orden` | `SMALLINT` | no | `0` | Orden de las evidencias dentro de una venta |
| `descripcion` | `TEXT` | sí | `NULL` | `CHECK (length <= 120)` |
| `blob_path` | `TEXT` | no | — | `UNIQUE`. Ruta en Vercel Blob |
| `mime` | `TEXT` | no | — | `CHECK (mime IN ('image/jpeg','image/png','image/webp','application/pdf'))` |
| `size_bytes` | `INTEGER` | no | — | `CHECK (between 1 and 10485760)` — 10 MB |
| `sha256` | `TEXT` | no | — | `CHECK (sha256 ~ '^[a-f0-9]{64}$')` |
| `subido_por_usuario_id` | `UUID` | no | — | FK → `usuarios(id)` |
| `created_at` | `TIMESTAMPTZ` | no | `now()` | |

```sql
-- Coherencia entre tipo y dueño
CHECK (
     (tipo = 'FOTO_DNI' AND empleado_id IS NOT NULL AND venta_id IS NULL)
  OR (tipo IN ('DOCUMENTO_VENTA','EVIDENCIA') AND venta_id IS NOT NULL AND empleado_id IS NULL)
)
-- Una sola foto de DNI por empleado
CREATE UNIQUE INDEX adjuntos_foto_dni_uk ON adjuntos (empleado_id) WHERE tipo = 'FOTO_DNI';
-- Un solo documento de venta por venta
CREATE UNIQUE INDEX adjuntos_documento_uk ON adjuntos (venta_id) WHERE tipo = 'DOCUMENTO_VENTA';

CREATE INDEX adjuntos_venta_idx    ON adjuntos (venta_id);
CREATE INDEX adjuntos_empleado_idx ON adjuntos (empleado_id);
CREATE INDEX adjuntos_sha256_idx   ON adjuntos (sha256);   -- detectar documentos reutilizados
```

**PDF solo para `DOCUMENTO_VENTA`**. `FOTO_DNI` y `EVIDENCIA` aceptan solo imágenes; validar en
la capa de aplicación además del `CHECK`.

---

## 11. `auditoria` — append only

| Columna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | no | — | PK. Orden estricto de inserción |
| `ts` | `TIMESTAMPTZ` | no | `now()` | |
| `actor_usuario_id` | `UUID` | sí | `NULL` | `NULL` para acciones del sistema |
| `actor_empresa_id` | `UUID` | sí | `NULL` | Desnormalizado para filtrar rápido |
| `actor_rol` | `rol_usuario` | sí | `NULL` | Desnormalizado: el rol pudo cambiar después |
| `accion` | `accion_auditoria` | no | — | |
| `entidad` | `TEXT` | no | — | `'venta'`, `'empleado'`, `'usuario'`, … |
| `entidad_id` | `TEXT` | no | — | `TEXT` porque no todas las PK son UUID |
| `datos_antes` | `JSONB` | sí | `NULL` | Estado previo, con campos sensibles redactados |
| `datos_despues` | `JSONB` | sí | `NULL` | |
| `ip` | `INET` | sí | `NULL` | |
| `user_agent` | `TEXT` | sí | `NULL` | |
| `request_id` | `TEXT` | sí | `NULL` | Correlaciona varias filas de una misma petición |
| `prev_hash` | `TEXT` | sí | `NULL` | `NULL` solo en la primera fila |
| `hash` | `TEXT` | no | — | Ver cálculo abajo |

```sql
CREATE INDEX auditoria_ts_idx        ON auditoria (ts DESC);
CREATE INDEX auditoria_entidad_idx   ON auditoria (entidad, entidad_id, ts DESC);
CREATE INDEX auditoria_actor_idx     ON auditoria (actor_usuario_id, ts DESC);
CREATE INDEX auditoria_empresa_idx   ON auditoria (actor_empresa_id, ts DESC);
```

### Capa 1 — permisos
```sql
REVOKE UPDATE, DELETE, TRUNCATE ON auditoria FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON auditoria FROM app_user;
GRANT  INSERT, SELECT             ON auditoria TO app_user;
```

### Capa 2 — trigger
```sql
CREATE FUNCTION auditoria_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'auditoria es append-only: % no permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_inmutable
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_inmutable();
```

### Capa 3 — cadena de hash
```
hash = sha256( prev_hash_o_cadena_vacia || '|' || json_canonico )

json_canonico = JSON con las claves ordenadas alfabéticamente de:
  { accion, actor_empresa_id, actor_rol, actor_usuario_id,
    datos_antes, datos_despues, entidad, entidad_id, ip, request_id, ts, user_agent }
```

Para evitar carreras entre transacciones concurrentes, **toda inserción en `auditoria` debe**:

```sql
SELECT pg_advisory_xact_lock(hashtext('auditoria_cadena'));
SELECT hash FROM auditoria ORDER BY id DESC LIMIT 1;   -- prev_hash
INSERT INTO auditoria (...) VALUES (...);
```

El lock es a nivel de transacción y se libera solo. Con < 2 000 ventas/mes el costo es
despreciable.

**Verificación**: un script recorre la tabla en orden de `id` y recalcula la cadena. Manual en
v1, programado en fase 2.

### Qué se audita

| Acción | Cuándo |
|---|---|
| `LOGIN_OK` / `LOGIN_FALLIDO` / `LOGOUT` | Cada intento. En `LOGIN_FALLIDO`, `entidad_id` es el username intentado, nunca la contraseña |
| `BUSQUEDA_DNI` | Cada búsqueda, con el DNI consultado y si hubo resultado |
| `ADJUNTO_VISTO` | Cada vez que se emite una URL firmada |
| `VENTA_CREADA` / `VENTA_ANULADA` | Siempre, con el snapshot completo |
| Resto de CREATE/UPDATE | Con `datos_antes` y `datos_despues` |

**Nunca** se escribe en `datos_*`: `password_hash`, tokens de sesión, ni el contenido de archivos.
El campo `dni` **sí** se registra (es el objeto de la auditoría) pero solo en acciones de empleado
y búsqueda.

La escritura en `auditoria` va **en la misma transacción** que el cambio auditado. Si falla la
auditoría, falla la operación.

---

## 12. `rate_limits`

Ventana fija simple. Suficiente para la escala de v1 (D10); si crece, se migra a Upstash Redis.

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| `clave` | `TEXT` | no | PK. Ej. `login:jperez`, `dni:<usuario_id>`, `venta:<usuario_id>` |
| `ventana_inicio` | `TIMESTAMPTZ` | no | |
| `contador` | `INTEGER` | no | |

Límites definidos en [`02-LOGICA-NEGOCIO.md §5`](./02-LOGICA-NEGOCIO.md).

---

## 13. Aislamiento entre empresas

**v1**: una única capa de acceso a datos. Toda función de `queries.ts` recibe obligatoriamente
un `SessionContext` como primer parámetro y aplica el filtro por empresa. No hay consultas a
Drizzle fuera de `queries.ts` / `actions.ts`.

```ts
type SessionContext = {
  usuarioId: string
  empresaId: string | null      // null solo para SUPERADMIN
  rol: 'SUPERADMIN' | 'ADMIN_EMPRESA' | 'VENDEDOR'
  requestId: string
  ip: string | null
  userAgent: string | null
}
```

Test obligatorio: por cada consulta de listado, un caso que verifique que un usuario de la
empresa A no ve datos de la empresa B.

**Fase 2**: Row Level Security de Postgres como red de seguridad, con GUCs de sesión
(`SET LOCAL app.empresa_id`) fijados al abrir cada transacción. Se deja fuera de v1
deliberadamente: media implementación de RLS es peor que ninguna.

---

## 14. Triggers de `updated_at`

```sql
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
```
Aplicar a: `empresas`, `sedes`, `convenios`, `empleados`, `usuarios`.
**No** a `ventas` (inmutables) ni a `adjuntos` ni a `auditoria`.

---

## 15. Seed de desarrollo (`src/db/seed.ts`)

Idempotente: se puede correr varias veces.

```
SUPERADMIN
  username: admin        password: Admin1234       debe_cambiar_password: false

EMPRESA 1  "SC Deportes"        RUC 20100000001
  sedes: Principal, Mall del Sur
  usuarios:
    sc.admin   / Admin1234   ADMIN_EMPRESA
    sc.vende1  / Vende1234   VENDEDOR   (sede por defecto: Principal)
    sc.vende2  / Vende1234   VENDEDOR   (sede por defecto: Mall del Sur)
  empleados: 12 con DNI 40000001..40000012, todos ACTIVO

EMPRESA 2  "FastFood SA"        RUC 20100000002
  sedes: Principal
  usuarios:
    ff.admin   / Admin1234   ADMIN_EMPRESA
    ff.vende1  / Vende1234   VENDEDOR
  empleados: 8 con DNI 50000001..50000008
             (50000008 en estado PENDIENTE_VERIFICACION, para probar la bandeja)

EMPRESA 3  "Gimnasio Fit"       RUC 20100000003   activo = true, SIN convenio
  → sirve para probar el error "DNI de empresa sin convenio"

CONVENIO  SC Deportes ↔ FastFood SA   estado VIGENTE, desde hace 90 días, sin fin
  término  SC otorga        → 1500 bps (15%)
  término  FastFood otorga  → 1000 bps (10%)

VENTAS: 60 ventas distribuidas en los últimos 90 días entre ambas direcciones,
        montos entre S/ 20 y S/ 800, 3 de ellas ANULADA.
        Sin adjuntos reales (los blobs se omiten en el seed).
```

> Las contraseñas del seed son solo para desarrollo. El script debe **negarse a ejecutarse** si
> `NODE_ENV === 'production'`.

---

## 16. Notas de Drizzle

- `bigint({ mode: 'number' })` para los `_centimos`. El máximo seguro en JS es 9 007 199 254 740 991
  céntimos ≈ 90 billones de soles: sobra.
- Los enums de Postgres se declaran con `pgEnum` y se exportan para reutilizar los tipos en Zod.
- `citext` no tiene tipo nativo en Drizzle: declarar con `customType`.
- Constraints `EXCLUDE`, triggers, funciones y `REVOKE` no los genera `drizzle-kit`. Van en
  migraciones SQL escritas a mano dentro de `drizzle/`, numeradas después de la migración
  generada correspondiente.
- Cada migración manual debe ser idempotente (`IF NOT EXISTS` / `CREATE OR REPLACE`).
