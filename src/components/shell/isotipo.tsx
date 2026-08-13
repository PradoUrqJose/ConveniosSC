/**
 * Isotipo de marca: un arco que nunca se cierra, con un nodo donde termina —
 * la lectura visual de la auditoría encadenada (ver docs de identidad).
 * Usa `currentColor`: el color lo decide quien lo envuelve (`text-brand`,
 * `text-brand-on-dark`, o el `text-primary-foreground` que ya esté activo).
 */
export function Isotipo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M 75.53 58.79 A 27 27 0 1 1 75.53 41.21"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="butt"
      />
      <circle cx="77" cy="50" r="8" fill="currentColor" />
    </svg>
  );
}
