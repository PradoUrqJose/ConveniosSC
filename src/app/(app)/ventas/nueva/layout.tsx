import { CabeceraPuntoVenta } from "@/components/shell/cabecera-punto-venta";

/**
 * Chrome del punto de venta (`/ventas/nueva`).
 *
 * Vive acá y no en el layout de `(app)` porque un layout compartido no se
 * vuelve a renderizar en una navegación de cliente: al entrar desde otra
 * pantalla (por ejemplo con la pestaña "Vender"), la rama por ruta seguía
 * evaluada con la ruta de la primera carga, así que no aparecía la cabecera
 * de vuelta y la barra de pestañas quedaba encima del CTA fijo — con la
 * barra en un z-index mayor, el botón no se podía tocar. Este layout sí se
 * monta al entrar al segmento; ocultar la barra y reservar el hueco del CTA
 * lo resuelve `globals.css` con `:has(.mob-cta-fijo)`.
 *
 * El ancho del flujo concentrado (columna angosta en móvil y tablet, lienzo
 * ancho en escritorio) lo aplica `globals.css` sobre el propio <main>, con
 * la misma marca.
 */
export default function PuntoVentaLayout({
  children,
}: LayoutProps<"/ventas/nueva">) {
  return (
    <>
      <CabeceraPuntoVenta />
      {children}
    </>
  );
}
