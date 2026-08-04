# Convenios

Aplicación para registrar y controlar las ventas con descuento entre empresas
que tienen un convenio firmado. Un vendedor busca al cliente por DNI, el sistema
resuelve si tiene convenio vigente y con qué descuento, y la venta queda
guardada con su evidencia fotográfica, el descuento congelado a la fecha y una
fila de auditoría inmutable.

## Qué la distingue

- **Descuento histórico.** Cada venta guarda el porcentaje que estaba vigente
  ese día. Cambiar el convenio después no altera ninguna venta ya registrada.
- **Auditoría encadenada.** Cada mutación escribe en `auditoria` con un hash que
  encadena con la fila anterior, dentro de la misma transacción que el cambio.
  La tabla tiene `REVOKE UPDATE, DELETE, TRUNCATE` y un trigger que lo impide:
  nadie puede alterar el registro, tampoco desde la base de datos.
- **Aislamiento entre empresas.** Cada acción lleva su guarda explícita y hay
  tests de aislamiento para los cruces entre empresas.
- **PWA instalable.** Funciona en móvil como aplicación; ninguna respuesta de
  `/api/*` ni de Server Action se cachea.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind v4 +
shadcn/ui · Drizzle ORM sobre Neon Postgres · Vercel Blob · argon2id ·
Serwist (service worker) · Vitest + Playwright.

## Puesta en marcha

```bash
npm install
# crear .env.local con las variables de abajo
npm run db:migrate                 # esquema + triggers + constraints
npm run db:seed                    # datos de demostración (nunca en producción)
npm run dev
```

### Variables de entorno

| Variable                | Para qué                                                         |
| ----------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`          | Neon, conexión pooled (lecturas)                                 |
| `DATABASE_URL_UNPOOLED` | Neon, conexión directa (transacciones, migraciones, seed)        |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob, adjuntos                                            |
| `SESSION_COOKIE_NAME`   | Nombre de la cookie de sesión (`convenios_sesion`)               |
| `SEED_PASSWORD`         | Solo para el seed. Sin ella se usa una contraseña de un solo uso |

Se gestionan con `vercel env` / `vercel env pull`. `.env.local` nunca se
commitea.

### Primer usuario en una base vacía

El seed no corre en producción y no hay registro público, así que el primer
`SUPERADMIN` se crea a mano:

```bash
node -e "require('@node-rs/argon2').hash(process.argv[1],{memoryCost:19456,timeCost:2,parallelism:1,outputLen:32}).then(console.log)" 'TuClaveFuerte1'
psql "$DATABASE_URL_UNPOOLED" -c "INSERT INTO usuarios (id,empresa_id,username,password_hash,debe_cambiar_password,nombres,apellidos,rol) VALUES (gen_random_uuid(),NULL,'admin','<HASH>',true,'Administrador','Sistema','SUPERADMIN')"
```

A partir de ahí, todo por la interfaz: Empresas → Sedes → Convenios → Usuarios →
Empleados.

## Comandos

| Comando                   | Qué hace                                           |
| ------------------------- | -------------------------------------------------- |
| `npm run dev`             | Servidor de desarrollo                             |
| `npm run build`           | Build de producción                                |
| `npm run check`           | typecheck + lint + formato + tests unitarios       |
| `npm test`                | Tests unitarios (los de base de datos se saltan)   |
| `RUN_DB_TESTS=1 npm test` | Añade los tests de aceptación contra Postgres real |
| `npm run test:e2e`        | Playwright sobre los flujos críticos               |
| `npm run db:migrate`      | Migración generada + `drizzle/manual.sql`          |
| `npm run db:seed`         | Datos de demostración, idempotente                 |

Los tests de aceptación (`src/db/aceptacion-*.test.ts`) cubren los criterios del
backlog y necesitan `DATABASE_URL_UNPOOLED`. Cada caso corre en una transacción
que se revierte, así que no dejan residuos.

## Documentación

El diseño completo está en [`docs/`](./docs): modelo de datos, lógica de
negocio, contrato de las actions, UI, sistema de diseño y backlog.
