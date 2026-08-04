# Convenios — Plan maestro v1.0

Sistema de registro de ventas entre empresas con convenio.

> **Estado**: especificación cerrada, lista para implementar.
> **Regla de oro para quien implemente**: si algo no está definido aquí, **no lo inventes**:
> búscalo en los documentos hermanos y, si tampoco está, pregunta. Este plan está escrito para
> que la implementación sea transcripción, no diseño.

## Índice de documentos

| Doc | Contenido |
|---|---|
| `PLAN.md` (este) | Visión, alcance, decisiones cerradas, stack, roadmap, riesgos |
| [`01-MODELO-DATOS.md`](./01-MODELO-DATOS.md) | Esquema completo: tablas, columnas, tipos, constraints, índices, seed |
| [`02-LOGICA-NEGOCIO.md`](./02-LOGICA-NEGOCIO.md) | Cálculos, permisos, validaciones, auditoría, seguridad |
| [`03-API.md`](./03-API.md) | Contratos de cada Server Action y Route Handler |
| [`04-UI.md`](./04-UI.md) | Cada pantalla, campo por campo, con estados y errores |
| [`05-DESIGN-SYSTEM.md`](./05-DESIGN-SYSTEM.md) | Tokens, tipografía, componentes, patrones móviles |
| [`06-BACKLOG.md`](./06-BACKLOG.md) | Tareas ordenadas por dependencia, con criterio de aceptación |

---

## 1. Qué es

Dos o más empresas tienen convenios comerciales: los empleados de una obtienen descuento
comprando en la otra. Este sistema registra esas ventas, con evidencia documental y trazabilidad
completa de quién registró qué y cuándo.

**Ejemplo**: SC (ropa deportiva) tiene convenio con FastFood SA. Un empleado de FastFood compra en
SC con 15% de descuento. El vendedor de SC lo registra aquí. Si un empleado de SC come en
FastFood con 10% de descuento, un usuario de FastFood lo registra en el mismo sistema.

**No es** un POS, ni un ERP, ni facturación electrónica. No cobra, no emite comprobantes, no
maneja inventario. Es un **registro auditado de transacciones de convenio**.

### Criterios de éxito
- Registrar una venta desde el celular toma **menos de 60 segundos**.
- Cada empresa responde sin ayuda: *"¿cuánto vendí a cada convenio este mes y cuánto descuento
  otorgué?"*
- **Cero** registros modificados sin rastro de quién y cuándo.

---

## 2. Decisiones cerradas

Todas las decisiones estructurales están tomadas. No re-abrir durante la implementación.

| # | Tema | Decisión |
|---|---|---|
| D01 | **Descuento** | Por **convenio y direccional**. SC→FastFood puede ser 15% y FastFood→SC 10%. Términos historizados con vigencia. |
| D02 | **Snapshot** | Cada venta guarda el % aplicado. Cambiar un convenio **nunca** altera ventas pasadas. |
| D03 | **Cálculo** | Siempre en el servidor. El campo read-only del cliente es solo previsualización. |
| D04 | **Foto DNI** | Una sola vez, atada al **empleado**. No se pide en cada venta. |
| D05 | **Evidencia** | Cada venta: documento de venta **obligatorio** + evidencia adicional `0..N` **opcional** (foto del empleado con la compra, voucher, etc.). Flag `requiere_evidencia_en_venta` por empresa para hacerla obligatoria. |
| D06 | **Comprobante** | Solo el archivo en v1. Sin tipo/serie/número estructurados. |
| D07 | **Visibilidad cruzada** | La empresa del empleado comprador **ve las ventas de su personal con montos**. **No** abre los adjuntos (son de la empresa vendedora). |
| D08 | **PWA v1** | Instalable + responsive + **borrador local** del formulario. Sin cola offline. |
| D09 | **Offline real** | Pospuesto a fase 3. El UUID de idempotencia se implementa desde el día 1 para no rediseñar después. |
| D10 | **Escala v1** | < 10 empresas, < 100 usuarios, < 2 000 ventas/mes. Sin agregados precalculados; métricas al vuelo. |
| D11 | **Auth** | Credenciales propias. Sin proveedor externo. |
| D12 | **Login** | `username` asignado por el admin, **único global**. `email` existe en la tabla pero es **nulable y no se usa en v1**. |
| D13 | **Sin email** | No hay servicio de correo. Reseteo de contraseña = el admin genera una temporal y el sistema fuerza el cambio al ingresar. |
| D14 | **Usuario vs empleado** | Tablas separadas. `usuarios.empleado_id` enlaza opcionalmente a la ficha de empleado de la misma persona. |
| D15 | **DNI** | `UNIQUE` global en `empleados`. Un empleado pertenece a **una** empresa. |
| D16 | **Monto** | El vendedor ingresa el **total con IGV, antes del descuento**. El sistema aplica el descuento sobre ese valor. |
| D17 | **Dinero** | Almacenado y calculado en **céntimos enteros** (`BIGINT`). Nunca `float`, nunca `NUMERIC` para aritmética de aplicación. |
| D18 | **Porcentaje** | Almacenado en **puntos básicos enteros** (`descuento_bps`): 15% = `1500`. Cálculo 100% entero. |
| D19 | **Fecha de venta** | Por defecto hoy; editable hasta **7 días atrás** (configurable por empresa). Nunca futura. `fecha_venta` y `created_at` son campos distintos. |
| D20 | **Anulación** | El vendedor puede anular **su propia venta el mismo día**. El ADMIN de la empresa vendedora, **siempre**. Motivo obligatorio. Nunca se borra. |
| D21 | **Topes** | **Sin topes** en v1. Las columnas quedan en el esquema, sin lógica que las use. |
| D22 | **Sedes** | **Sí**, tabla `sedes`. Campo obligatorio en la venta. Reportes desglosados por sede. |
| D23 | **Verificación de empleados** | Un vendedor puede crear empleados de la empresa convenio; quedan `PENDIENTE_VERIFICACION`. Bandeja para el admin de la empresa dueña. Rechazar marca las ventas asociadas para revisión. |
| D24 | **Diseño** | Neutro y sobrio, base shadcn/ui, tema claro y oscuro. Sin marca de empresa. |
| D25 | **Nombre** | La aplicación se llama **Convenios**. |
| D26 | **Dashboard** | Totales del periodo + serie temporal + desglose por convenio + rankings y adopción. |
| D27 | **Moneda** | Solo **PEN** (S/). Columna `moneda` existe con default `'PEN'`, sin selector en la UI. |
| D28 | **Localización** | Español de Perú. Zona horaria `America/Lima` para todos los cortes de fecha. |
| D29 | **Auditoría** | Append-only reforzado en tres capas: permisos de BD, trigger, y cadena de hash. Audita modificaciones **y accesos** a datos sensibles. |
| D30 | **Multi-tenancy** | v1: filtro por empresa en una **única capa de acceso a datos** (`queries.ts`), con test obligatorio de aislamiento por cada listado. RLS de Postgres se pospone a fase 2 — media implementación de RLS es peor que ninguna. |

---

## 3. Roles

| Rol | Alcance |
|---|---|
| `SUPERADMIN` | Todo el sistema. Empresas, convenios y sus %, usuarios de cualquier empresa, auditoría global. `empresa_id` nulo. |
| `ADMIN_EMPRESA` | Su empresa. Empleados, usuarios, sedes, todas las ventas de su empresa (vendidas y compradas), métricas, anulaciones, bandeja de verificación, auditoría de su empresa. **No** crea convenios ni cambia %. |
| `VENDEDOR` | Registrar ventas, buscar empleados de convenios vigentes, crear empleados (pendientes), ver y filtrar **solo sus** ventas, anular las suyas el mismo día. |

La matriz de permisos exacta, por acción, está en [`02-LOGICA-NEGOCIO.md §3`](./02-LOGICA-NEGOCIO.md).

---

## 4. Stack técnico — versiones y librerías fijadas

No sustituir ninguna sin consultar.

| Capa | Elección |
|---|---|
| Framework | **Next.js 16**, App Router, TypeScript `strict: true` |
| React | **React 19**, Server Components por defecto |
| Hosting | **Vercel**, runtime Node.js (Fluid Compute). Sin `runtime = 'edge'`. |
| Base de datos | **Postgres** — Neon vía Vercel Marketplace |
| ORM | **Drizzle ORM** + `drizzle-kit` para migraciones versionadas |
| Estilos | **Tailwind CSS v4** |
| Componentes | **shadcn/ui** (copiados al repo, no como dependencia) |
| Validación | **Zod**, esquemas compartidos cliente/servidor |
| Formularios | `react-hook-form` + `@hookform/resolvers/zod` |
| Hash de contraseñas | **`@node-rs/argon2`** (argon2id) |
| Sesiones | Tabla `sesiones` en BD + cookie opaca `httpOnly`. Revocables. |
| Archivos | **Vercel Blob**, acceso `private`, subida directa desde el cliente |
| Compresión de imagen | `browser-image-compression` en el cliente |
| PWA | **Serwist** (`@serwist/next`) |
| Fechas | `date-fns` + `date-fns-tz`, zona `America/Lima` |
| Gráficos | **Recharts** (vía shadcn/ui charts) |
| Tablas | `@tanstack/react-table` para las listas con filtros |
| Testing | **Vitest** (unitario) + **Playwright** (e2e de los 3 flujos críticos) |

### Estructura de carpetas

```
/
├── docs/                       ← esta especificación
├── drizzle/                    ← migraciones generadas
├── public/                     ← iconos PWA, manifest
└── src/
    ├── app/
    │   ├── (auth)/login/
    │   ├── (app)/              ← layout con sesión requerida
    │   │   ├── ventas/
    │   │   ├── empleados/
    │   │   ├── usuarios/
    │   │   ├── sedes/
    │   │   ├── dashboard/
    │   │   ├── auditoria/
    │   │   └── perfil/
    │   ├── (superadmin)/admin/
    │   │   ├── empresas/
    │   │   ├── convenios/
    │   │   └── usuarios/
    │   └── api/
    │       ├── blob/upload/
    │       └── adjuntos/[id]/
    ├── db/
    │   ├── schema.ts           ← Drizzle: todas las tablas
    │   ├── index.ts            ← cliente
    │   └── seed.ts
    ├── lib/
    │   ├── auth/               ← sesión, hash, guardas
    │   ├── audit/              ← escritura y cadena de hash
    │   ├── dinero.ts           ← aritmética en céntimos
    │   ├── fechas.ts           ← helpers America/Lima
    │   └── blob.ts             ← tokens de subida y URLs firmadas
    ├── modules/                ← una carpeta por dominio
    │   ├── ventas/             ← actions.ts, queries.ts, schemas.ts, components/
    │   ├── empleados/
    │   ├── empresas/
    │   ├── convenios/
    │   ├── usuarios/
    │   └── metricas/
    └── components/ui/          ← shadcn
```

**Convención por módulo**: `schemas.ts` (Zod) → `queries.ts` (lecturas, reciben contexto de
sesión) → `actions.ts` (Server Actions, validan + autorizan + auditan) → `components/`.

---

## 5. Roadmap

### Fase 1 — Núcleo (v1)
Ver desglose con criterios de aceptación en [`06-BACKLOG.md`](./06-BACKLOG.md).

1. Proyecto, BD, esquema, migraciones, seed
2. Auth (login, sesión, guardas) + auditoría transversal
3. Superadmin: empresas, convenios y términos, usuarios
4. Admin: sedes, empleados, usuarios de su empresa
5. Búsqueda por DNI + creación de empleado pendiente
6. Registro de venta completo
7. Listado de ventas con filtros + detalle + anulación
8. Bandeja de verificación de empleados
9. PWA nivel 1 + borrador local
10. Dashboard con las cuatro secciones de métricas
11. Visor de auditoría

### Fase 2
Exportación CSV, importación masiva de empleados por CSV, gestión de contraseñas más fina,
2FA para admins, verificación programada de la cadena de hash, política de retención y purga.

### Fase 3
Offline con cola (IndexedDB + Background Sync), topes de beneficio, alertas de uso anómalo,
notificaciones al empleado, cierre de periodo y conciliación entre empresas.

---

## 6. Riesgos y mitigación

| Riesgo | Impacto | Mitigación (implementada en v1 salvo indicación) |
|---|---|---|
| Vendedor inventa empleados o infla montos | Alto | Bandeja de verificación (D23), hash SHA-256 de adjuntos para detectar documentos reutilizados, tope de monto por empresa contra errores de tipeo, auditoría completa |
| Enumeración de DNIs por el buscador | Medio-alto | Rate limit 20/min por usuario, cada búsqueda auditada, solo devuelve empleados de convenios vigentes, respuesta genérica cuando no corresponde |
| Fuga de fotos de DNI o de personas | Alto (legal) | Blob privado, URL firmada de 10 min, acceso restringido a admin de la empresa vendedora, cada apertura auditada |
| Ventas duplicadas por reintento en móvil | Alto | UUID de idempotencia generado en el cliente, `PRIMARY KEY` de `ventas` |
| Cambio de convenio contamina el histórico | Medio | Snapshot del % en la venta (D02) + términos historizados |
| Errores de redondeo en dinero | Medio | Todo en céntimos enteros y bps enteros (D17, D18). Prohibido `float` |
| Baja adopción por lentitud del formulario | Alto | Un solo scroll, convenio autoseleccionado si hay uno, sede por defecto del usuario, teclado numérico, foto de DNI no repetida |
| Manipulación directa de la BD | Medio | Cadena de hash en auditoría, verificable |

---

## 7. Fuera de alcance

- Emisión de comprobantes o integración con SUNAT
- Inventario, catálogo de productos, precios
- Procesamiento de pagos
- Sincronización con sistemas de RR.HH. (los empleados se cargan a mano; CSV en fase 2)
- Liquidaciones o transferencias de dinero entre empresas

---

## 8. Cumplimiento de datos personales

Se almacenan **DNI, nombres, teléfono, fotografía del documento de identidad y fotografías de
personas**. En Perú esto está sujeto a la Ley 29733.

Implementado en v1: minimización de campos, cifrado en tránsito y reposo, acceso restringido por
rol, URLs firmadas de corta duración, auditoría de cada acceso, y texto de consentimiento en el
formulario de creación de empleado que cubre **explícitamente la captura de imagen de la
persona**, no solo del DNI.

Pendiente de fase 2/3: política de retención y purga automática, y procedimiento de acceso,
rectificación y supresión a solicitud del titular.

> Alguien de la organización debe validar el punto legal antes de producción. No es un bloqueo
> para construir, sí para lanzar.
