import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
