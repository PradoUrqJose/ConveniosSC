import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { BannerInstalacion } from "@/components/pwa/banner-instalacion";
import "./globals.css";

const TEMA_SCRIPT = `
(function () {
  try {
    var guardado = localStorage.getItem('theme');
    var oscuro = guardado ? guardado === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', oscuro);
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  title: "Convenios",
  description: "Registro de ventas entre empresas con convenio",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Convenios",
  },
  icons: {
    shortcut: "/favicon.ico",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <BannerInstalacion />
        <Toaster />
      </body>
    </html>
  );
}
