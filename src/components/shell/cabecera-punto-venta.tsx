import { CabeceraMovil } from "@/components/shell/cabecera-movil";

/**
 * Cabecera del flujo concentrado de registro de ventas (PWA).
 *
 * Issue #52. Dos cambios respecto de la versión anterior:
 *
 * 1. Ya no es `sticky`: en móvil no hay chrome fijo, la cabecera vive
 *    dentro del contenido y se va con el scroll, dejando la altura útil
 *    para el formulario (el CTA fijo del pie es el único elemento fijo).
 * 2. Semántica correcta de Base UI. El back era un `<Button>` de Base UI
 *    con `render={<Link/>}`: con `nativeButton` en su valor por defecto
 *    (`true`) el componente espera un `<button>` nativo y avisa por
 *    consola al recibir un `<a>`; poniendo `nativeButton={false}` habría
 *    dejado de avisar, pero añadiendo `role="button"` a un enlace, que es
 *    peor para el lector de pantalla. Un back *es* navegación: ahora es un
 *    `<a>` puro (`BotonAtrasMovil`), sin primitiva de botón encima.
 *
 * El toggle de tema salió de acá: durante un registro de venta no es una
 * decisión relevante y las acciones secundarias viven en `/perfil`.
 */
export function CabeceraPuntoVenta() {
  return (
    <CabeceraMovil
      className="lg:hidden"
      variante="formulario"
      titulo="Nueva venta con convenio"
      atras={{ href: "/ventas", etiqueta: "Volver a ventas" }}
    />
  );
}
