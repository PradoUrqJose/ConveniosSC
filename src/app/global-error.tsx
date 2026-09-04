"use client";

import "./globals.css";

/**
 * Último recinto: un fallo en el layout raíz — issue #56.
 *
 * Sustituye a `<html>` entero, así que no puede apoyarse en el shell ni en
 * las primitivas cliente (proveedor de tema, toaster, barra inferior): todo
 * lo que use tiene que sobrevivir a que el árbol de arriba sea justamente lo
 * que se rompió. De ahí el marcado mínimo y los estilos en línea sobre los
 * mismos tokens del design system.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          display: "grid",
          minHeight: "100dvh",
          placeItems: "center",
          margin: 0,
          padding: "2rem 1.25rem",
          fontFamily: "system-ui, sans-serif",
          background: "#f5f7ff",
          color: "#0f172a",
        }}
      >
        <main role="alert" style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>
            La aplicación no pudo cargar
          </h1>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.6, marginTop: 8 }}>
            Ocurrió un fallo antes de dibujar la pantalla. Reintenta; si vuelve
            a pasar, cierra la aplicación y ábrela de nuevo.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 20,
              minHeight: 44,
              padding: "0 1.25rem",
              borderRadius: 12,
              border: 0,
              background: "#283c73",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            Reintentar
          </button>
          {error.digest ? (
            <p
              style={{
                marginTop: 16,
                fontSize: 11,
                fontFamily: "ui-monospace, monospace",
                opacity: 0.7,
              }}
            >
              Referencia: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
