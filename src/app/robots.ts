import type { MetadataRoute } from "next";

/**
 * La aplicación es privada: todo cuelga de una sesión y no hay ninguna página
 * pensada para buscadores. Mientras el entorno publicado contenga datos de
 * demostración (DNIs y fotos de documentos de prueba), la indexación es además
 * un riesgo, no solo ruido.
 *
 * Para permitir la indexación de un futuro landing público, cambiar a
 * `allow: ["/"]` con `disallow` explícito del resto.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
