import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { BannerInstalacion } from "@/components/pwa/banner-instalacion";
import { SerwistProvider } from "@/components/pwa/serwist-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Convenios",
  title: {
    default: "Convenios",
    template: "%s · Convenios",
  },
  description: "Registro de ventas entre empresas con convenio",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Convenios",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    shortcut: "/favicon.ico",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#163b65",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <SerwistProvider>
          <ThemeProvider>
            {children}
            <BannerInstalacion />
            <Toaster />
          </ThemeProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
