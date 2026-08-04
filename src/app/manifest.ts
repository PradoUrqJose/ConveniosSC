import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Convenios",
    short_name: "Convenios",
    description: "Registro de ventas entre empresas con convenio",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f9fc",
    theme_color: "#163b65",
    lang: "es-PE",
    categories: ["business", "productivity", "finance"],
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Nueva venta",
        short_name: "Nueva venta",
        description: "Registrar una venta con convenio",
        url: "/ventas/nueva",
        icons: [{ src: "/icons/192.png", sizes: "192x192" }],
      },
      {
        name: "Ver ventas",
        short_name: "Ventas",
        description: "Consultar el historial de ventas",
        url: "/ventas",
        icons: [{ src: "/icons/192.png", sizes: "192x192" }],
      },
    ],
  };
}
