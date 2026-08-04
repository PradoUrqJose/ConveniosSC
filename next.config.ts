import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { spawnSync } from "node:child_process";

// `git rev-parse HEAD` sirve como número de revisión: cambia con cada commit,
// suficiente para invalidar el precache de estos assets sin revisionarlos uno a uno.
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf-8",
  }).stdout.trim() || crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [
    { url: "/~offline", revision },
    { url: "/icons/192.png", revision },
    { url: "/icons/512.png", revision },
    { url: "/icons/maskable-512.png", revision },
    { url: "/icons/apple-touch-icon.png", revision },
  ],
});

const nextConfig: NextConfig = {/* config options here */};

export default withSerwist(nextConfig);
