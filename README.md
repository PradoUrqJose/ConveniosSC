# Convenios

Aplicación privada para registrar y controlar ventas con descuento entre
empresas que mantienen un convenio. Un vendedor identifica al empleado por su
documento, el sistema resuelve el convenio y descuento vigentes, y registra la
venta con sus adjuntos y una traza de auditoría.

No es un POS ni un sistema de facturación: no cobra, no emite comprobantes y no
administra inventario.

## Características principales

- **Descuento histórico:** cada venta conserva el porcentaje aplicado; un
  cambio posterior del convenio no modifica ventas anteriores.
- **Auditoría encadenada:** las mutaciones y accesos sensibles generan eventos
  con hashes encadenados. La tabla de auditoría tiene protecciones adicionales
  en PostgreSQL contra actualización y borrado.
- **Aislamiento por empresa:** las consultas y acciones aplican permisos según
  usuario, rol y empresa.
- **Adjuntos controlados:** documentos de venta y evidencias se almacenan en
  Vercel Blob y se leen mediante URLs firmadas de corta duración.
- **PWA:** la aplicación es instalable y ofrece una pantalla de contingencia sin
  conexión. Las páginas, APIs y Server Actions no se cachean.

## Stack actual

Next.js 16.3 (App Router) · React 19.2 · TypeScript estricto · Tailwind CSS 4 ·
shadcn/ui · Drizzle ORM · Neon PostgreSQL · Vercel Blob · Argon2id · Serwist ·
Vitest · Playwright.

Las versiones exactas están fijadas en [`package.json`](./package.json).

## Entornos y base de datos

El proyecto de Neon es `crimson-hill-06288408` y tiene dos ramas conocidas:

| Uso        | Rama Neon                     |
| ---------- | ----------------------------- |
| Producción | `br-lingering-scene-ackig4fp` |
| Desarrollo | `br-patient-credit-aczqnjkk`  |

Vercel separa sus variables por alcance:

| Alcance Vercel | Se utiliza en                                      |
| -------------- | -------------------------------------------------- |
| `Development`  | Desarrollo local mediante Vercel CLI               |
| `Preview`      | Despliegues de ramas y pull requests               |
| `Production`   | Despliegue de producción, normalmente desde `main` |

> **Advertencia:** `npm run dev`, las migraciones, el seed y las pruebas de BD
> leen el archivo local `.env.local`. Vercel no lo cambia automáticamente. Antes
> de ejecutar cualquier comando que escriba en PostgreSQL hay que verificar que
> ese archivo apunta a la rama de desarrollo.

Descarga las variables `Development` del proyecto Vercel vinculado:

```bash
npx vercel env pull .env.local --environment=development
```

Comprueba la rama sin mostrar la URL ni las credenciales:

```bash
node --env-file=.env.local --input-type=module - <<'NODE'
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const [entorno] = await sql`
  select current_database() as database,
         current_setting('neon.project_id', true) as project_id,
         current_setting('neon.branch_id', true) as branch_id
`;
console.table(entorno);
NODE
```

Para trabajar localmente, `branch_id` debe ser
`br-patient-credit-aczqnjkk`. No continúes si aparece la rama de producción.

## Puesta en marcha

Requisitos: Node.js compatible con Next.js 16, npm y acceso al proyecto de
Vercel.

```bash
npm install
npx vercel link
npx vercel env pull .env.local --environment=development
# verificar la rama con el comando anterior
npm run db:migrate
npm run db:seed
npm run dev
```

El seed es idempotente: si encuentra el usuario `admin`, no vuelve a cargar
datos. Debe usarse exclusivamente en una base de desarrollo o demostración.

## Variables de entorno

| Variable                | Obligatoria | Uso                                                     |
| ----------------------- | ----------- | ------------------------------------------------------- |
| `DATABASE_URL`          | Sí          | Conexión pooled de Neon para lecturas habituales        |
| `DATABASE_URL_UNPOOLED` | Sí          | Conexión directa para transacciones, migraciones y seed |
| `BLOB_READ_WRITE_TOKEN` | Producción  | Subida y lectura de adjuntos en Vercel Blob             |
| `SESSION_COOKIE_NAME`   | No          | Nombre de cookie; por defecto `convenios_sesion`        |
| `CRON_SECRET`           | Producción  | Autoriza el cron diario de limpieza                     |
| `SEED_PASSWORD`         | Solo seed   | Contraseña deliberada para usuarios sembrados           |
| `SEED_PERMITIR_HOST`    | Excepcional | Confirmación explícita del host aceptado por el seed    |

Los archivos `.env*` están ignorados por Git. Nunca pegues URLs de conexión,
contraseñas o tokens en el código, documentación, commits, incidencias o chat.

## Comandos

| Comando                   | Qué hace                                                  |
| ------------------------- | --------------------------------------------------------- |
| `npm run dev`             | Inicia Next.js en desarrollo                              |
| `npm run build`           | Genera el build de producción                             |
| `npm run start`           | Sirve un build ya generado                                |
| `npm run lint`            | Ejecuta ESLint                                            |
| `npm run typecheck`       | Genera tipos de Next.js y ejecuta TypeScript              |
| `npm run format`          | Formatea el repositorio con Prettier                      |
| `npm run format:check`    | Comprueba formato sin modificar archivos                  |
| `npm test`                | Ejecuta tests unitarios; los tests de BD se omiten        |
| `RUN_DB_TESTS=1 npm test` | Incluye pruebas de aceptación contra la BD configurada    |
| `npm run test:e2e`        | Ejecuta Playwright y modifica los datos del entorno usado |
| `npm run db:generate`     | Genera una migración Drizzle desde el esquema             |
| `npm run db:migrate`      | Aplica migraciones Drizzle y `drizzle/manual.sql`         |
| `npm run db:seed`         | Carga datos de demostración                               |
| `npm run check`           | Typecheck, lint, formato y tests unitarios                |

Los tests de aceptación de BD se ejecutan dentro de transacciones que se
revierten. Los tests E2E sí crean datos persistentes y nunca deben ejecutarse
contra producción.

## Documentación

- [`docs/07-GUIA-MANTENIMIENTO.md`](./docs/07-GUIA-MANTENIMIENTO.md): guía
  operativa y mapa actualizado del programa; empieza aquí para retomar el
  mantenimiento.
- [`docs/01-MODELO-DATOS.md`](./docs/01-MODELO-DATOS.md): especificación del
  modelo de datos.
- [`docs/02-LOGICA-NEGOCIO.md`](./docs/02-LOGICA-NEGOCIO.md): reglas de negocio y
  permisos diseñados.
- [`docs/03-API.md`](./docs/03-API.md): contratos de Server Actions y rutas.
- [`docs/04-UI.md`](./docs/04-UI.md): comportamiento esperado de las pantallas.
- [`docs/05-DESIGN-SYSTEM.md`](./docs/05-DESIGN-SYSTEM.md): sistema visual.
- [`docs/06-BACKLOG.md`](./docs/06-BACKLOG.md): historial de implementación y
  criterios de aceptación.
- [`docs/PLAN.md`](./docs/PLAN.md): plan maestro original.

Los documentos `PLAN.md` y `01` a `06` conservan decisiones y criterios del
diseño original; ante una diferencia, el código y la guía de mantenimiento
describen el comportamiento actualmente implementado.
