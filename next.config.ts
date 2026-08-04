import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const isDevelopment = process.env.NODE_ENV === "development";

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
  // Los dev tunnels terminan HTTPS y reenvían el POST a localhost. Next valida
  // Origin frente a X-Forwarded-Host para las Server Actions, así que se
  // autorizan explícitamente ambos orígenes solo durante el desarrollo.
  ...(isDevelopment
    ? {
        allowedDevOrigins: ["*.brs.devtunnels.ms"],
        experimental: {
          serverActions: {
            allowedOrigins: ["localhost:3000", "*.brs.devtunnels.ms"],
          },
        },
      }
    : {}),
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  devIndicators: false,
};

export default withSerwist(nextConfig);
