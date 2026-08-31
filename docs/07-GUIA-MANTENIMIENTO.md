# Guía de funcionamiento y mantenimiento

Esta es la guía operativa del estado actual de **Convenios**. Está pensada para
retomar el proyecto después de semanas o meses: explica qué hace, dónde vive
cada pieza, cómo circulan los datos y qué verificar antes de cambiar o desplegar
algo.

Última revisión contra el código: **28 de agosto de 2026**.

## 1. Resumen mental en dos minutos

Convenios registra ventas en las que un empleado de una empresa compra a otra
empresa y recibe el descuento acordado entre ambas.

El flujo central es:

```text
Usuario inicia sesión
       ↓
Busca al empleado por DNI
       ↓
El servidor valida empresa, estado y convenio vigente
       ↓
Resuelve el término y descuento aplicables a la fecha de venta
       ↓
Valida sede, fecha, monto y adjuntos
       ↓
Calcula descuento y total en el servidor
       ↓
Guarda venta + adjuntos + auditoría en una transacción
```

Las ideas que no deben romperse al mantener el sistema son:

1. Una venta guarda una fotografía histórica del descuento aplicado.
2. Los importes son enteros en céntimos; los porcentajes son puntos básicos.
3. Las reglas importantes se vuelven a calcular y validar en el servidor.
4. Las mutaciones relacionadas se hacen dentro de una única transacción.
5. Toda mutación y acceso sensible debe quedar auditado.
6. Una empresa no puede leer ni modificar datos ajenos fuera de las reglas del
   convenio.
7. Las ventas y auditorías no se borran: una venta se anula conservando su
   historia.

## 2. Qué puede hacer cada rol hoy

Esta tabla describe la interfaz y las Server Actions implementadas, no solo la
especificación original.

| Función | `VENDEDOR` | `ADMIN_EMPRESA` | `SUPERADMIN` |
| --- | --- | --- | --- |
| Inicio propio | Resumen de sus ventas | Redirige al dashboard | Redirige al dashboard |
| Dashboard | No | Ventas de su empresa | Vista global |
| Registrar venta | Sí | Sí | No |
| Listar ventas | Solo las propias | Vendidas/compradas de su empresa | Vista global |
| Anular venta | Propia, el mismo día de creación | Venta de su empresa vendedora | Cualquier venta |
| Buscar empleado por documento | Sí | Sí | Sí |
| Crear empleado | No | Propio activo; otros según convenio | Queda pendiente |
| Verificar/rechazar empleado | No | Solo de su empresa | Sí |
| Gestionar sedes | No | Las de su empresa | Las actions lo permiten; la UI es de consulta global |
| Gestionar usuarios | No | No | Sí |
| Gestionar empresas/convenios | No | No | Sí |
| Ver auditoría | No | Solo eventos de su empresa | Vista global |
| Verificar integridad de auditoría | No | No | Sí |

### Rutas principales

| Ruta | Propósito |
| --- | --- |
| `/login` | Inicio de sesión |
| `/` | Inicio del vendedor; otros roles van a `/dashboard` |
| `/dashboard` | Métricas para administrador y superadministrador |
| `/ventas` | Historial, filtros y ventas vendidas/compradas |
| `/ventas/nueva` | Registro de venta |
| `/ventas/[id]` | Detalle y, si corresponde, anulación |
| `/empleados` | Gestión y bandeja de verificación |
| `/sedes` | Sedes |
| `/usuarios` | Gestión de usuarios; solo `SUPERADMIN` |
| `/admin/empresas` | Empresas; solo `SUPERADMIN` |
| `/admin/convenios` | Convenios y términos; solo `SUPERADMIN` |
| `/auditoria` | Vista global para `SUPERADMIN` y vista acotada a `actor_empresa_id` para `ADMIN_EMPRESA` |
| `/perfil` | Perfil del usuario actual |
| `/perfil/password` | Cambio obligatorio o voluntario de contraseña |

## 3. Reglas de negocio esenciales

### Convenios y descuentos

Un convenio une exactamente dos empresas, pero tiene **dos descuentos
direccionales**. La empresa A puede otorgar 15 % cuando vende a empleados de B,
y B puede otorgar otro porcentaje cuando vende a empleados de A.

Los porcentajes se guardan en `convenio_terminos.descuento_bps`:

```text
1 %   = 100 bps
15 %  = 1500 bps
100 % = 10000 bps
```

Cambiar un descuento no actualiza el término anterior. El sistema lo cierra el
día previo al cambio y crea un nuevo término. PostgreSQL impide que existan
términos solapados para la misma dirección del convenio.

### Empleados

- La identidad usa tipo y número de documento; se admiten DNI y Carné de
  Extranjería y la pareja es única globalmente.
- Un empleado pertenece a una sola empresa.
- Solo el administrador de la empresa dueña crea directamente un empleado
  `ACTIVO`.
- Los vendedores no pueden crear empleados. Si lo crea un administrador para
  otra empresa con convenio o un superadministrador, nace
  `PENDIENTE_VERIFICACION`.
- Crear un empleado requiere consentimiento; no se carga foto del documento.
- En el punto de venta, escribir el documento no consulta la base: el vendedor
  debe pulsar `Buscar`. Cambiar el tipo o número invalida el resultado anterior.
- Rechazar un empleado marca sus ventas asociadas para revisión; no las borra.

### Ventas

- El cliente genera el UUID de la venta. Repetir el mismo UUID por un reintento
  de red devuelve la venta ya creada en lugar de duplicarla.
- La empresa vendedora es la del usuario autenticado.
- La sede debe estar activa y pertenecer a la empresa vendedora.
- La fecha nunca puede ser futura y respeta
  `empresas.dias_retroactivos_venta`.
- El monto bruto debe ser positivo y no superar
  `empresas.tope_monto_venta_centimos`.
- El documento de venta es obligatorio; admite hasta cinco evidencias
  adicionales.
- Si `requiere_evidencia_en_venta` está activo, se exige al menos una evidencia.
- El servidor ignora totales calculados por el navegador y vuelve a calcular el
  descuento con enteros.
- La moneda actual es únicamente PEN.
- Una anulación exige motivo y conserva venta y adjuntos.

### Dinero y fechas

No uses `float` para dinero. Los helpers oficiales están en:

- `src/lib/dinero.ts`: parseo, cálculo y formato de céntimos.
- `src/lib/fechas.ts`: reglas y formato en `America/Lima`.

`fecha_venta` es una fecha de negocio (`DATE`). `created_at` indica cuándo se
creó realmente el registro (`TIMESTAMPTZ`). Para decidir si un vendedor todavía
puede anular se usa el día de `created_at` en Lima, no `fecha_venta`.

## 4. Arquitectura del código

```text
src/app/                  páginas, layouts y Route Handlers de Next.js
src/components/           componentes compartidos, UI y shell de navegación
src/modules/<dominio>/    consultas, Server Actions y lógica transaccional
src/lib/auth/             login, sesiones, contraseñas y guardas
src/lib/audit/            registro, redacción y verificación de auditoría
src/db/schema.ts          esquema Drizzle, enums e índices declarativos
src/db/index.ts           conexiones pooled y transaccional a Neon
src/db/seed.ts            datos de demostración
drizzle/                  migración generada y SQL manual
scripts/db-migrate.mjs    ejecutor de ambas clases de migración
e2e/                      pruebas Playwright
```

### Patrón de una lectura

1. Una página Server Component llama `requireSession()`.
2. La página arma filtros a partir de `searchParams`.
3. Una función `query.ts` aplica el alcance del rol y de la empresa.
4. La consulta usa `db`, respaldado por `DATABASE_URL` pooled.
5. La página pasa datos serializables al componente cliente.

### Patrón de una escritura

1. El formulario llama una función de `actions.ts` marcada con `"use server"`.
2. La action valida con Zod, carga la sesión y comprueba el rol.
3. La lógica de dominio en `acciones.ts` vuelve a comprobar propiedad y reglas.
4. `dbTx().transaction(...)` usa `DATABASE_URL_UNPOOLED`.
5. Cambio de negocio y auditoría se confirman o revierten juntos.
6. La action ejecuta `revalidatePath` para refrescar las pantallas afectadas.

La separación `actions.ts`/`acciones.ts` es deliberada:

- `actions.ts`: frontera Next.js, `FormData`, Zod, sesión y revalidación.
- `acciones.ts`: algoritmo de negocio comprobable dentro de una transacción.
- `query.ts`: lecturas y aislamiento.

### Conexiones de base de datos

`src/db/index.ts` ofrece dos accesos:

- `db`: Neon HTTP pooled, para lecturas y escrituras independientes.
- `dbTx()`: pool serverless sobre la URL unpooled, solo cuando varias
  sentencias deben ser atómicas o se requiere un advisory lock transaccional.

Los usos actuales de `dbTx()` se limitan a estas categorías: mutaciones de
dominio junto con su auditoría (`acciones` públicas), login/sesiones/contraseña
que cambian varias filas, y los eventos de auditoría diferidos (`BUSQUEDA_*`,
`ADJUNTO_VISTO`, `ADJUNTO_SUBIDO`) que necesitan proteger la cadena de hashes.
Las rutas de lectura, incluido `GET /api/adjuntos/[id]`, usan `db` por HTTP.

No cambies una escritura auditada a `db` porque Neon HTTP no ofrece aquí la
transacción usada por el patrón del proyecto.

## 5. Modelo de datos en una vista

| Tabla | Responsabilidad |
| --- | --- |
| `empresas` | Configuración de cada organización |
| `sedes` | Puntos de venta de una empresa |
| `usuarios` | Credenciales, rol y empresa del operador |
| `sesiones` | Sesiones opacas revocables; solo guarda hash del token |
| `convenios` | Relación y vigencia entre dos empresas |
| `convenio_terminos` | Historial direccional de descuentos |
| `empleados` | Beneficiarios identificados por tipo y número de documento |
| `ventas` | Operaciones y fotografía histórica del cálculo |
| `adjuntos` | Documento de venta y evidencias; puede conservar fotos históricas inaccesibles |
| `auditoria` | Eventos encadenados por hash |
| `rate_limits` | Ventanas persistentes de limitación de solicitudes |

Las restricciones que Drizzle no expresa viven en `drizzle/manual.sql`:
extensiones, exclusión de términos solapados, índices especiales, triggers de
`updated_at`, validaciones cruzadas y protección de auditoría.

Al cambiar el modelo, revisa siempre **ambos** archivos:
`src/db/schema.ts` y `drizzle/manual.sql`.

## 6. Autenticación y seguridad

- Las contraseñas se almacenan con Argon2id.
- La cookie contiene un token aleatorio opaco; PostgreSQL guarda su SHA-256.
- Las sesiones duran 30 días y son revocables.
- Al cambiar o restablecer contraseña se revocan las demás sesiones.
- Tras cinco fallos, el usuario se bloquea durante cinco minutos.
- Existe además un límite por IP de 30 intentos cada 15 minutos.
- El mensaje de login no revela si el usuario existe, está bloqueado o está
  desactivado.
- Un usuario con contraseña temporal es forzado a cambiarla antes de navegar.
- El proxy solo comprueba la presencia de cookie. La validación real de la
  sesión y autorización vive en `requireSession()` y las guardas del servidor.

### Auditoría

`src/lib/audit/registrar.ts` serializa y encadena cada evento. La cadena se puede
verificar desde `/auditoria` o con `src/lib/audit/verificar.ts`.

La auditoría tiene un trigger que rechaza `UPDATE` y `DELETE`, además de
permisos definidos para el rol PostgreSQL `app_user`. Actualmente las URLs de
conexión conocidas usan el propietario `neondb_owner`, no `app_user`. Por eso no
se debe afirmar que la tabla es imposible de alterar por el dueño de la BD: el
control operativo de credenciales y la revisión periódica de la cadena siguen
siendo necesarios.

### Adjuntos

El navegador comprime imágenes, calcula SHA-256 y sube directamente a Vercel
Blob mediante `/api/blob/upload`. Se aceptan JPEG, PNG, WebP y PDF de hasta
10 MB.

La lectura pasa por `/api/adjuntos/[id]`, que:

1. valida la sesión y el permiso;
2. limita la frecuencia;
3. registra `ADJUNTO_VISTO`;
4. redirige a una URL firmada válida durante diez minutos.

En desarrollo, si Blob falla, existe un fallback a `public/uploads`. Está
deshabilitado en producción porque esos archivos serían públicos y el disco de
Vercel no es persistente.

## 7. Entornos Neon y Vercel

### Mapeo conocido

| Entorno | Proyecto Neon | Rama Neon |
| --- | --- | --- |
| Producción | `crimson-hill-06288408` | `br-lingering-scene-ackig4fp` |
| Desarrollo | `crimson-hill-06288408` | `br-patient-credit-aczqnjkk` |

Los nombres del endpoint (`ep-...`) pueden cambiar. La fuente fiable es
`current_setting('neon.branch_id', true)`.

### Alcances de Vercel

- `Development`: variables para trabajo local.
- `Preview`: variables de despliegues no productivos y pull requests.
- `Production`: variables del despliegue principal.

En la última revisión se observaron variables para Development y Production,
pero no para Preview. Antes de usar despliegues Preview, configura al menos
`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `SESSION_COOKIE_NAME` y
`BLOB_READ_WRITE_TOKEN` con recursos no productivos.

`CRON_SECRET` solo es necesario donde se ejecuta el cron, normalmente
Production.

### Descargar Development localmente

```bash
npx vercel link
npx vercel env pull .env.local --environment=development
```

El segundo comando reemplaza el archivo de destino. `.env.local` tiene
precedencia sobre `.env.development` en Next.js y también es cargado
explícitamente por las herramientas de este repositorio.

### Verificación segura de rama

Este comando no imprime la contraseña:

```bash
node --env-file=.env.local --input-type=module - <<'NODE'
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const [entorno] = await sql`
  select current_database() as database,
         current_user as db_user,
         current_setting('neon.project_id', true) as project_id,
         current_setting('neon.branch_id', true) as branch_id
`;
console.table(entorno);
NODE
```

Para desarrollo debe devolver `br-patient-credit-aczqnjkk`.

### Regla antes de escribir

Verifica la rama inmediatamente antes de cualquiera de estos comandos:

```bash
npm run db:migrate
npm run db:seed
RUN_DB_TESTS=1 npm test
npm run test:e2e
```

El seed comprueba `NODE_ENV` y busca palabras como `prod` en la URL, pero los
endpoints opacos de Neon normalmente no contienen esas palabras. Esa heurística
no sustituye la comprobación de `branch_id`.

## 8. Rutina normal de desarrollo

Al retomar el proyecto:

```bash
git status --short
git pull --ff-only
npm install
npx vercel env pull .env.local --environment=development
# comprobar branch_id de Neon
npm run dev
```

Antes de entregar un cambio:

```bash
npm run check
npm run build
git diff --check
git status --short
```

Si el cambio toca consultas, acciones o esquema, añade las pruebas de aceptación
en la rama de desarrollo:

```bash
RUN_DB_TESTS=1 npm test
```

## 9. Cómo hacer cambios comunes

### Cambiar una regla de negocio

1. Localiza el dominio en `src/modules/<dominio>`.
2. Modifica la lógica central en `acciones.ts` o la lectura en `query.ts`.
3. Mantén validación de entrada y permisos en `actions.ts`.
4. Comprueba si la mutación requiere un nuevo evento o datos de auditoría.
5. Añade test unitario o de aceptación que falle sin el cambio.
6. Actualiza esta guía y el documento funcional correspondiente si cambió el
   comportamiento visible.

### Añadir o modificar una pantalla

1. La página en `src/app` debe cargar sesión y datos en el servidor.
2. Conserva los componentes interactivos como clientes pequeños y explícitos.
3. Usa los componentes de `src/components/ui` y patrones de
   `src/components/shell/pagina-ui.tsx`.
4. Revisa escritorio, móvil, tema claro/oscuro, carga y errores.
5. Si cambia navegación o permisos, actualiza `src/lib/navegacion.ts` y prueba
   acceso directo a la URL, no solo la visibilidad del menú.

### Cambiar el esquema de PostgreSQL

1. Modifica `src/db/schema.ts`.
2. Genera la migración:

   ```bash
   npm run db:generate
   ```

3. Revisa el SQL generado; no lo aceptes a ciegas.
4. Si Drizzle no puede expresar la regla, modifica `drizzle/manual.sql` de
   forma idempotente.
5. Confirma que `.env.local` apunta a Development.
6. Aplica la migración:

   ```bash
   npm run db:migrate
   ```

7. Ejecuta tests unitarios y de BD.
8. Prueba la aplicación con datos existentes, no solo con una base vacía.
9. Despliega primero en un entorno no productivo.
10. Aplica en producción con respaldo y ventana de reversión definidos.

No edites manualmente una migración que ya fue aplicada en otros entornos para
darle un significado nuevo; crea una migración adicional.

### Añadir una mutación auditada

1. Define el evento en `accion_auditoria` si no existe.
2. Genera la migración del enum.
3. Ejecuta cambio y `registrar(...)` en la misma transacción.
4. No incluyas contraseñas, tokens, DNI completo ni contenido de archivos en
   `datosAntes`/`datosDespues`; revisa la redacción canónica.
5. Añade una prueba de éxito y otra de aislamiento/permisos.

### Cambiar el descuento de un convenio

Hazlo desde `/admin/convenios`. Nunca actualices directamente
`descuento_bps` del término vigente: el flujo correcto cierra el término
anterior y crea uno nuevo para preservar historia.

## 10. Pruebas

### Unitarias

```bash
npm test
```

Cubren dinero, fechas, archivos, autenticación y helpers de auditoría. Los
archivos que requieren PostgreSQL se saltan si `RUN_DB_TESTS` no vale `1`.

### Aceptación con PostgreSQL

```bash
RUN_DB_TESTS=1 npm test
```

Usan `DATABASE_URL_UNPOOLED`, se ejecutan en serie y revierten cada caso. Aun
así, deben apuntar a Development: prueban permisos, restricciones y lógica real
contra el esquema migrado.

### E2E con Playwright

```bash
npm run test:e2e
```

Si `PLAYWRIGHT_BASE_URL` no está definido, Playwright levanta `npm run dev`.
Estos tests crean ventas y empleados persistentes.

Variables disponibles:

| Variable | Uso |
| --- | --- |
| `PLAYWRIGHT_BASE_URL` | URL de una aplicación de prueba ya desplegada |
| `E2E_VENDEDOR` | Usuario vendedor |
| `E2E_PASSWORD` | Contraseña del vendedor |
| `E2E_ADMIN_USER` | Usuario administrador; habilita el caso de convenio |
| `E2E_ADMIN_PASSWORD` | Contraseña del administrador |
| `E2E_DNI_EXISTENTE` | DNI fixture que ya participa en un convenio |
| `E2E_DNI_NUEVO` | DNI libre para crear un empleado |

Los valores por defecto del archivo E2E no coinciden actualmente con los
usuarios generados por `src/db/seed.ts`; define las variables explícitamente o
actualiza los fixtures como parte de una futura corrección.

## 11. Despliegue y operación

### Antes de desplegar

- `npm run check` y `npm run build` deben pasar.
- Las migraciones deben estar probadas en Development/Preview.
- Las variables deben existir en el alcance Vercel correcto.
- Production debe apuntar a `br-lingering-scene-ackig4fp`.
- Preview y Development no deben apuntar a producción.
- No debe haber secretos en el diff o el historial.

### Variables mínimas de Production

```text
DATABASE_URL
DATABASE_URL_UNPOOLED
BLOB_READ_WRITE_TOKEN
SESSION_COOKIE_NAME
CRON_SECRET
```

Cambiar una variable en Vercel no modifica despliegues ya construidos. Genera
un nuevo despliegue para que el cambio entre en vigor.

### Cron diario

`vercel.json` llama `GET /api/cron/limpieza` todos los días a las 08:00 UTC. El
endpoint valida `Authorization: Bearer <CRON_SECRET>` y elimina:

- sesiones caducadas o revocadas desde hace más de siete días;
- ventanas de rate limit con más de un día.

Nunca elimina auditoría.

### Rotación de secretos

Rota inmediatamente una credencial si aparece en un chat, captura, log, commit
o terminal compartida:

1. genera una credencial nueva en Neon o Vercel;
2. actualiza cada alcance afectado: Development, Preview y/o Production;
3. vuelve a descargar `.env.local` para Development;
4. crea nuevos despliegues donde corresponda;
5. verifica conectividad y rama;
6. revoca la credencial anterior;
7. comprueba que no quedó en Git con `git log -p` o una herramienta de escaneo
   de secretos.

No copies el valor nuevo en esta documentación.

## 12. PWA y comportamiento sin conexión

Serwist genera el service worker desde `src/app/sw.ts`.

- Navegaciones: solo red, con fallback a `/~offline`.
- Server Actions: solo red.
- `/api/*`: solo red.
- Fuentes e iconos: caché primero.
- No existe cola offline de ventas.
- El formulario mantiene un borrador local por usuario, pero guardar una venta
  sigue requiriendo conexión.

Al cambiar el service worker, prueba instalación limpia, actualización desde
una versión previa y modo offline. Los archivos generados `public/sw*` están
ignorados por Git.

## 13. Diagnóstico rápido

### La aplicación local muestra o cambia datos de producción

Detén el servidor y cualquier prueba. Ejecuta la comprobación de `branch_id`,
vuelve a descargar Development con `vercel env pull` y reinicia Next.js. Si hubo
escrituras, registra qué comandos se ejecutaron y revisa auditoría antes de
intentar corregir datos.

### Falta `DATABASE_URL`

El proyecto no tiene `.env.local`, está vacío o no se descargó desde Vercel.
Ejecuta `npx vercel env pull .env.local --environment=development` y verifica la
rama.

### Una escritura falla pero las lecturas funcionan

Comprueba `DATABASE_URL_UNPOOLED`, conectividad al endpoint directo y que las
migraciones estén aplicadas. Las lecturas y transacciones usan URLs distintas.

### Los adjuntos fallan localmente

Revisa `BLOB_READ_WRITE_TOKEN`, `/api/blob/upload`, tipo real del archivo y el
límite de 10 MB. Sin Blob, desarrollo puede usar `public/uploads`; producción
no.

### Un usuario no puede iniciar sesión

Comprueba usuario y empresa activos, `bloqueado_hasta`, contraseña temporal y
`debe_cambiar_password`. El login oculta deliberadamente el motivo exacto. Un
superadministrador puede desbloquear o restablecer desde `/usuarios`.

### El build funciona localmente pero Preview falla

Revisa si las variables existen en el alcance `Preview`. Las variables de
`Development` no se aplican automáticamente a despliegues Preview.

### La cadena de auditoría no verifica

No reescribas filas para “arreglarla”. Conserva evidencia, identifica la primera
fila inválida, revisa despliegues y accesos a Neon y trata el caso como incidente
de integridad.

## 14. Diferencias y riesgos conocidos

Estos puntos deben recordarse al planificar refactorizaciones:

1. El rol PostgreSQL `app_user` recibe permisos limitados, pero la aplicación se
   conecta actualmente como `neondb_owner`; esa capa de mínimo privilegio no
   está activa en runtime.
2. La protección del seed basada en palabras como `prod` no reconoce de forma
   fiable los IDs opacos de endpoints Neon.
3. Los valores por defecto de Playwright y los usuarios del seed no están
   alineados.
4. Preview necesita su propio juego de variables antes de utilizarse como
   entorno seguro de pruebas.
5. Los documentos `PLAN.md` y `01` a `06` son especificaciones históricas y
   pueden contener estructura o dependencias que cambiaron durante la
   implementación.

Resolver estos puntos debe hacerse mediante cambios de código y pruebas
separados; esta guía solo documenta el estado observado.

## 15. Checklist de mantenimiento

### Antes de empezar

- [ ] Leer `git status` y conservar cambios ajenos.
- [ ] Descargar variables Development.
- [ ] Confirmar `br-patient-credit-aczqnjkk`.
- [ ] Ejecutar la suite base.
- [ ] Identificar regla, módulo, permisos y auditoría afectados.

### Antes de integrar

- [ ] `npm run check` pasa.
- [ ] `npm run build` pasa.
- [ ] Tests de BD pasan si se tocó persistencia o negocio.
- [ ] E2E relevante pasa en un entorno desechable.
- [ ] No hay secretos ni datos personales en el diff.
- [ ] Migración revisada y probada si cambió el esquema.
- [ ] Documentación actualizada si cambió comportamiento u operación.

### Antes de producción

- [ ] Respaldo/punto de restauración disponible.
- [ ] Variables Production verificadas sin imprimir secretos.
- [ ] Rama Neon Production confirmada.
- [ ] Migración ensayada y orden de despliegue definido.
- [ ] Plan de reversión definido.
- [ ] Smoke test de login, venta, adjunto y auditoría preparado.

## 16. Fuentes de verdad

Cuando dos documentos discrepen, usa este orden:

1. restricciones y datos reales de PostgreSQL;
2. código y tests automatizados;
3. esta guía de mantenimiento;
4. especificaciones `01` a `06` y `PLAN.md`;
5. recuerdos o notas externas.

Si el comportamiento real contradice una regla de negocio aprobada, no adaptes
la documentación silenciosamente: registra la discrepancia, corrige el código
con pruebas y después actualiza la guía.
