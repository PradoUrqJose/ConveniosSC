import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const isDevelopment = process.env.NODE_ENV === "development";
// Cache Components es global en Next 16.3. Se habilita solo en E2E para
// validar los shells sin convertirlo todavía en una caché de producción.
const cacheComponentsEnPrueba = process.env.NEXT_TEST_CACHE_COMPONENTS === "1";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' blob: data: https:; media-src 'self' blob:; connect-src 'self' https:; script-src 'self' 'unsafe-inline'" +
      (isDevelopment ? " 'unsafe-eval'" : "") +
      "; style-src 'self' 'unsafe-inline'; font-src 'self' data:; worker-src 'self' blob:",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(), microphone=(), payment=(), usb=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  ...(cacheComponentsEnPrueba
    ? {
        cacheComponents: true,
        experimental: {
          exposeTestingApiInProductionBuild: true,
          instantInsights: { validationLevel: "manual-warning" },
        },
      }
    : {}),
  // Los dev tunnels terminan HTTPS y reenvían el POST a localhost. Next valida
  // Origin frente a X-Forwarded-Host para las Server Actions, así que se
  // autorizan explícitamente ambos orígenes solo durante el desarrollo.
  ...(isDevelopment
    ? {
        allowedDevOrigins: ["127.0.0.1", "localhost", "*.brs.devtunnels.ms"],
        experimental: {
          serverActions: {
            allowedOrigins: ["localhost:3000", "*.brs.devtunnels.ms"],
          },
        },
      }
    : {}),
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // El navegador debe consultar cada despliegue para detectar una nueva
      // versión del worker; el alcance queda explícito incluso si cambia la
      // ruta interna que genera Serwist.
      {
        source: "/serwist/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  devIndicators: false,
};

export default withSerwist(nextConfig);
