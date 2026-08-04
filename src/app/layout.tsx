import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { BannerInstalacion } from "@/components/pwa/banner-instalacion";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

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
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          {children}
          <BannerInstalacion />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
