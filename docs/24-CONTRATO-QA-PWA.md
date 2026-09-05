# Contrato QA móvil y no regresión desktop

El issue #62 convierte la revisión responsive en un gate repetible. El job
`Contrato móvil, PWA y no regresión desktop` crea una base PostgreSQL efímera,
ejecuta el seed determinista y recorre las rutas críticas como vendedor, admin
y superadmin. La matriz es 320×568, 390×844 y 430×932 en móvil; 1024×768,
1280×800 y 1440×900 en escritorio.

La evidencia se publica como el artefacto `playwright-qa`: cada captura lleva
la ruta y viewport en su nombre; ante fallar, Playwright añade además
captura, vídeo y trace. El test también cubre detalle de ventas, teclado
virtual (foco), tema oscuro, movimiento reducido, landscape, Axe, contraste
(regla `color-contrast` de Axe), nombres accesibles y foco. Los objetivos de
44 px y el contraste de la matriz completa están protegidos por
`e2e/primitivas-tactiles-movil.spec.ts`; se ejecutan antes de release con la
misma semilla y en CI.

## Baseline visual de escritorio

Antes de una modificación compartida, capturar el baseline de producción en
una base aislada:

```sh
E2E_BASELINE=1 BASELINE_ETAPA=antes npm run test:baseline
```

Tras el cambio se repite con `BASELINE_ETAPA=despues`. No se aprueba una PR si
las capturas 1024/1280/1440 o el reporte de `artifacts/baseline` cambian sin
una revisión explícita que explique ruta, viewport y motivo. El umbral es
estricto: cualquier píxel inesperado se trata como regresión hasta que la
persona revisora lo aprueba; no se incrementa un porcentaje global para
ocultarlo. `e2e/baseline-desktop.spec.ts` conserva ambas tandas y Axe.

## Checklist físico de release

Esta lista se firma en el PR/release, después del gate automático, con un
Android físico y un iPhone físico (incluido al menos uno con notch):

- [ ] Instalar desde el navegador y abrir en modo standalone.
- [ ] Confirmar safe areas en portrait y landscape, incluida barra inferior.
- [ ] Abrir teclado en Nueva venta y Perfil; los campos y acciones siguen
      alcanzables.
- [ ] Alternar claro/oscuro y “reducir movimiento”.
- [ ] Cortar y restaurar red: aparece el fallback y no se muestran datos
      privados previamente vistos.
- [ ] Actualizar una versión instalada: el aviso permite actualizar sin
      perder un borrador.
- [ ] Registrar modelo, SO, navegador, fecha, persona y enlace al artefacto
      `playwright-qa`.

El worker, installability, actualización y política de caché se comprueban en
`e2e/pwa-core.spec.ts`. Ninguna ruta autenticada, RSC, API, venta, DNI ni
adjunto puede quedar en Cache Storage.
