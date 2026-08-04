/**
 * Seed de desarrollo (01-MODELO-DATOS.md §15).
 * Idempotente: si el usuario `admin` ya existe, no hace nada.
 * Se niega a correr en producción.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { hash } from "@node-rs/argon2";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import { calcularDescuento } from "../lib/dinero";
import { hoyLima, sumarDias } from "../lib/fechas";
import { pngMarcador } from "./seed-imagen";

const ARGON2 = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

if (process.env.NODE_ENV === "production") {
  console.error("El seed no se ejecuta en producción.");
  process.exit(1);
}

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.error("Falta DATABASE_URL_UNPOOLED en .env.local");
  process.exit(1);
}

/**
 * El guard de `NODE_ENV` no basta: al correr `npm run db:seed` desde una
 * máquina de desarrollo apuntando a la base de datos de producción,
 * `NODE_ENV` sigue siendo `development` y el seed se ejecutaría igual.
 * `SEED_PERMITIR_HOST` es un escape explícito para casos legítimos (por
 * ejemplo, sembrar el entorno de demostración a propósito).
 */
const hostBd = (() => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
})();
if (
  process.env.SEED_PERMITIR_HOST !== hostBd &&
  /prod|produccion|production/i.test(url)
) {
  console.error(
    `La URL de la base de datos parece de producción (${hostBd}).\n` +
      `Si es intencional, ejecuta con SEED_PERMITIR_HOST=${hostBd}`,
  );
  process.exit(1);
}

/**
 * Contraseñas del seed. Sin `SEED_PASSWORD` se usa una obviamente inservible
 * y todos los usuarios nacen con `debe_cambiar_password = true`, así que una
 * base sembrada nunca queda con credenciales adivinables y usables.
 */
const PASSWORD_SEED = process.env.SEED_PASSWORD ?? "Cambiar.Esta.Clave.1";
/**
 * Definir `SEED_PASSWORD` es una decisión deliberada de quien siembra: ya
 * eligió una contraseña propia y no necesita rotarla al entrar. Sin ella, la
 * contraseña es pública (está en este archivo), así que el cambio forzado es
 * lo único que evita dejar una base con credenciales adivinables y usables.
 */
const DEBE_CAMBIAR = !process.env.SEED_PASSWORD;
if (DEBE_CAMBIAR) {
  console.warn(
    `⚠ SEED_PASSWORD no definida: todos los usuarios entran con «${PASSWORD_SEED}»\n` +
      "  y deberán cambiarla en el primer ingreso. Define SEED_PASSWORD para evitarlo.",
  );
}

const HOY = hoyLima();
const HACE_90 = sumarDias(HOY, -90);

/** PRNG determinista para que el seed sea reproducible. */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260701);
const randInt = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;

const NOMBRES = [
  "Carlos",
  "María",
  "José",
  "Ana",
  "Luis",
  "Lucía",
  "Pedro",
  "Elena",
  "Jorge",
  "Rosa",
  "Miguel",
  "Carmen",
];
const APELLIDOS = [
  "García",
  "Rodríguez",
  "Martínez",
  "López",
  "González",
  "Pérez",
  "Sánchez",
  "Ramírez",
  "Torres",
  "Flores",
  "Rivera",
  "Castillo",
];

/**
 * Sube un marcador a Vercel Blob y devuelve los datos de la fila `adjuntos`.
 * Sin `BLOB_READ_WRITE_TOKEN` devuelve `null` y el seed omite los adjuntos: es
 * preferible una venta sin documento a una fila que apunte a un blob que no
 * existe y produzca un 404 al abrirla.
 */
async function subirMarcador(
  nombre: string,
  banda: [number, number, number],
): Promise<{
  blobPath: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
} | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return null;
  }
  const { put } = await import("@vercel/blob");
  const bytes = pngMarcador(600, 800, [241, 245, 249], banda);
  const blob = await put(`seed/${nombre}.png`, bytes, {
    access: "public",
    addRandomSuffix: true,
    contentType: "image/png",
  });
  return {
    blobPath: blob.pathname,
    mime: "image/png",
    sizeBytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function main() {
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  // Un único hash para todos los usuarios sembrados: distinguirlos no aportaba
  // nada y multiplicaba las credenciales que hay que rotar.
  const passwordAdmin = await hash(PASSWORD_SEED, ARGON2);
  const passwordVende = passwordAdmin;

  try {
    await client.query("BEGIN");

    const existente = await client.query(
      "SELECT 1 FROM usuarios WHERE username = 'admin'",
    );
    if (existente.rowCount && existente.rowCount > 0) {
      await client.query("ROLLBACK");
      console.log("Seed ya aplicado. No se hizo nada.");
      return;
    }

    const inserta = async (
      texto: string,
      valores: unknown[],
    ): Promise<string> => {
      const res = await client.query(texto, valores);
      return res.rows[0].id as string;
    };

    // Superadmin
    const adminId = await inserta(
      `INSERT INTO usuarios
         (id, empresa_id, username, password_hash, debe_cambiar_password,
          nombres, apellidos, rol)
       VALUES ($1, NULL, $2, $3, ${DEBE_CAMBIAR}, $4, $5, 'SUPERADMIN')
       RETURNING id`,
      [randomUUID(), "admin", passwordAdmin, "Administrador", "Sistema"],
    );

    // --- Empresa 1: SC Deportes ---
    const scId = await inserta(
      `INSERT INTO empresas (id, ruc, razon_social, nombre_comercial)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [randomUUID(), "20100000001", "SC Deportes S.A.C.", "SC Deportes"],
    );
    const scPrincipal = await inserta(
      `INSERT INTO sedes (id, empresa_id, nombre) VALUES ($1, $2, $3) RETURNING id`,
      [randomUUID(), scId, "Principal"],
    );
    const scMallSur = await inserta(
      `INSERT INTO sedes (id, empresa_id, nombre) VALUES ($1, $2, $3) RETURNING id`,
      [randomUUID(), scId, "Mall del Sur"],
    );
    const scAdmin = await inserta(
      `INSERT INTO usuarios
         (id, empresa_id, username, password_hash, debe_cambiar_password,
          nombres, apellidos, rol)
       VALUES ($1, $2, $3, $4, ${DEBE_CAMBIAR}, $5, $6, 'ADMIN_EMPRESA')
       RETURNING id`,
      [randomUUID(), scId, "sc.admin", passwordAdmin, "Sofía", "Torres"],
    );
    const scVende1 = await inserta(
      `INSERT INTO usuarios
         (id, empresa_id, username, password_hash, debe_cambiar_password,
          nombres, apellidos, rol, sede_por_defecto_id)
       VALUES ($1, $2, $3, $4, ${DEBE_CAMBIAR}, $5, $6, 'VENDEDOR', $7)
       RETURNING id`,
      [
        randomUUID(),
        scId,
        "sc.vende1",
        passwordVende,
        "Luis",
        "Mendoza",
        scPrincipal,
      ],
    );
    const scVende2 = await inserta(
      `INSERT INTO usuarios
         (id, empresa_id, username, password_hash, debe_cambiar_password,
          nombres, apellidos, rol, sede_por_defecto_id)
       VALUES ($1, $2, $3, $4, ${DEBE_CAMBIAR}, $5, $6, 'VENDEDOR', $7)
       RETURNING id`,
      [
        randomUUID(),
        scId,
        "sc.vende2",
        passwordVende,
        "Carmen",
        "Vega",
        scMallSur,
      ],
    );

    // Empleados de SC: DNI 40000001..40000012, ACTIVO
    const scEmpleados: string[] = [];
    for (let i = 1; i <= 12; i++) {
      const dni = `400000${String(i).padStart(2, "0")}`;
      const id = await inserta(
        `INSERT INTO empleados (id, empresa_id, dni, nombres, apellidos, telefono)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          randomUUID(),
          scId,
          dni,
          NOMBRES[(i - 1) % NOMBRES.length],
          APELLIDOS[(i - 1) % APELLIDOS.length],
          `9${dni}`,
        ],
      );
      scEmpleados.push(id);
    }

    // --- Empresa 2: FastFood SA ---
    const ffId = await inserta(
      `INSERT INTO empresas (id, ruc, razon_social, nombre_comercial)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [randomUUID(), "20100000002", "FastFood S.A.C.", "FastFood SA"],
    );
    const ffPrincipal = await inserta(
      `INSERT INTO sedes (id, empresa_id, nombre) VALUES ($1, $2, $3) RETURNING id`,
      [randomUUID(), ffId, "Principal"],
    );
    const ffAdmin = await inserta(
      `INSERT INTO usuarios
         (id, empresa_id, username, password_hash, debe_cambiar_password,
          nombres, apellidos, rol)
       VALUES ($1, $2, $3, $4, ${DEBE_CAMBIAR}, $5, $6, 'ADMIN_EMPRESA')
       RETURNING id`,
      [randomUUID(), ffId, "ff.admin", passwordAdmin, "Raúl", "Castillo"],
    );
    const ffVende1 = await inserta(
      `INSERT INTO usuarios
         (id, empresa_id, username, password_hash, debe_cambiar_password,
          nombres, apellidos, rol, sede_por_defecto_id)
       VALUES ($1, $2, $3, $4, ${DEBE_CAMBIAR}, $5, $6, 'VENDEDOR', $7)
       RETURNING id`,
      [
        randomUUID(),
        ffId,
        "ff.vende1",
        passwordVende,
        "Paula",
        "Flores",
        ffPrincipal,
      ],
    );

    // Empleados de FF: DNI 50000001..50000008, el 50000008 PENDIENTE
    const ffEmpleados: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const dni = `500000${String(i).padStart(2, "0")}`;
      const estado = i === 8 ? "PENDIENTE_VERIFICACION" : "ACTIVO";
      const id = await inserta(
        `INSERT INTO empleados (id, empresa_id, dni, nombres, apellidos, telefono, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          randomUUID(),
          ffId,
          dni,
          NOMBRES[(i + 3) % NOMBRES.length],
          APELLIDOS[(i + 3) % APELLIDOS.length],
          `9${dni}`,
          estado,
        ],
      );
      ffEmpleados.push(id);
    }

    // --- Empresa 3: Gimnasio Fit (sin convenio) ---
    const gimnasioId = await inserta(
      `INSERT INTO empresas (id, ruc, razon_social, nombre_comercial)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [randomUUID(), "20100000003", "Gimnasio Fit S.A.C.", "Gimnasio Fit"],
    );
    await inserta(
      `INSERT INTO sedes (id, empresa_id, nombre) VALUES ($1, $2, $3) RETURNING id`,
      [randomUUID(), gimnasioId, "Principal"],
    );

    // --- Convenio SC ↔ FastFood, vigente desde hace 90 días ---
    const [convenioA, convenioB] = scId < ffId ? [scId, ffId] : [ffId, scId];
    const convenioId = await inserta(
      `INSERT INTO convenios (id, empresa_a_id, empresa_b_id, estado, vigencia_desde)
       VALUES ($1, $2, $3, 'VIGENTE', $4) RETURNING id`,
      [randomUUID(), convenioA, convenioB, HACE_90],
    );
    const terminoSc = await inserta(
      `INSERT INTO convenio_terminos
         (id, convenio_id, empresa_otorgante_id, descuento_bps, vigencia_desde)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [randomUUID(), convenioId, scId, 1500, HACE_90],
    );
    const terminoFf = await inserta(
      `INSERT INTO convenio_terminos
         (id, convenio_id, empresa_otorgante_id, descuento_bps, vigencia_desde)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [randomUUID(), convenioId, ffId, 1000, HACE_90],
    );

    // --- 60 ventas en los últimos 90 días, 3 anuladas ---
    const anuladas = new Set([7, 29, 47]);
    const ventasRegistradas: {
      id: string;
      vendedorId: string;
      fecha: string;
    }[] = [];
    const scVendedores = [scVende1, scVende2];
    const scSedes = [scPrincipal, scMallSur];

    for (let i = 1; i <= 60; i++) {
      const scVende = i <= 30;
      const vendedorId = scVende
        ? scVendedores[randInt(0, scVendedores.length - 1)]!
        : ffVende1;
      const sedeId = scVende
        ? scSedes[randInt(0, scSedes.length - 1)]!
        : ffPrincipal;
      const terminoId = scVende ? terminoSc : terminoFf;
      const bps = scVende ? 1500 : 1000;
      const compradorPool = scVende ? ffEmpleados.slice(0, 7) : scEmpleados;
      const empleadoId = compradorPool[randInt(0, compradorPool.length - 1)]!;

      const bruto = randInt(2000, 80000);
      const { descuento, final } = calcularDescuento(bruto, bps);
      const fechaVenta = sumarDias(HOY, -randInt(0, 89));

      const esAnulada = anuladas.has(i);
      const ventaId = randomUUID();
      if (!esAnulada) {
        ventasRegistradas.push({ id: ventaId, vendedorId, fecha: fechaVenta });
      }
      const valores: unknown[] = [
        ventaId,
        scVende ? scId : ffId,
        scVende ? ffId : scId,
        convenioId,
        terminoId,
        sedeId,
        vendedorId,
        empleadoId,
        bruto,
        bps,
        descuento,
        final,
        fechaVenta,
        esAnulada ? "ANULADA" : "REGISTRADA",
        esAnulada ? (scVende ? scAdmin : ffAdmin) : null,
        esAnulada ? new Date().toISOString() : null,
        esAnulada ? "Venta registrada por error" : null,
      ];
      await client.query(
        `INSERT INTO ventas
           (id, empresa_vendedora_id, empresa_compradora_id, convenio_id,
            termino_id, sede_id, vendedor_usuario_id, empleado_comprador_id,
            monto_bruto_centimos, descuento_bps, monto_descuento_centimos,
            monto_final_centimos, fecha_venta, estado, anulada_por_usuario_id,
            anulada_at, motivo_anulacion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        valores,
      );
    }

    // --- Documentos de las ventas más recientes ---
    // Solo las 10 últimas: suficiente para que el detalle de venta y el visor
    // de adjuntos tengan algo real que mostrar, sin encarecer el seed con 60
    // subidas.
    const recientes = [...ventasRegistradas]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 10);

    let adjuntosCreados = 0;
    for (const venta of recientes) {
      const archivo = await subirMarcador(
        `documento-venta-${venta.id}`,
        [37, 99, 235],
      );
      if (!archivo) {
        break;
      }
      await client.query(
        `INSERT INTO adjuntos
           (id, venta_id, tipo, orden, descripcion, blob_path, mime,
            size_bytes, sha256, subido_por_usuario_id)
         VALUES ($1,$2,'DOCUMENTO_VENTA',0,$3,$4,$5,$6,$7,$8)`,
        [
          randomUUID(),
          venta.id,
          "Comprobante de venta (marcador de demostración)",
          archivo.blobPath,
          archivo.mime,
          archivo.sizeBytes,
          archivo.sha256,
          venta.vendedorId,
        ],
      );
      adjuntosCreados++;
    }

    if (adjuntosCreados === 0) {
      console.warn(
        "⚠ Sin BLOB_READ_WRITE_TOKEN: las ventas se sembraron sin documento adjunto.",
      );
    }

    await client.query("COMMIT");
    console.log(
      `✓ Seed aplicado (id admin: ${adminId}, adjuntos: ${adjuntosCreados})`,
    );
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("✗ Falló el seed:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
