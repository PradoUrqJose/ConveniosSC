# Documento de identidad: DNI y Carné de Extranjería

## Alcance y decisión

El empleado se identifica por la pareja `tipoDocumento + numeroDocumento`.
Los tipos admitidos inicialmente son `DNI` y `CARNET_EXTRANJERIA`.

- DNI: exactamente 8 dígitos.
- Carné de Extranjería: entre 1 y 12 caracteres alfanuméricos o guion; se
  elimina espacio exterior y se normaliza a mayúsculas antes de buscar o
  guardar.
- La unicidad es global por `(tipoDocumento, numeroDocumento)`. El mismo valor
  puede existir una vez como DNI y una vez como CE, pero no repetirse dentro
  del mismo tipo.

El límite de CE sigue el formato máximo publicado por SUNAT. Es deliberadamente
más tolerante que el formato moderno de nueve dígitos para no excluir carnés
anteriores que contienen letra o guion.

Referencias oficiales: [parámetro de tipo de documento de SUNAT](https://www2.sunat.gob.pe/pdt/pdtModulos/independientes/p695/TipoDoc.htm)
y [verificación de CE de Migraciones](https://sel.migraciones.gob.pe/servmig-valreg/verificarce).

## Mapa de impacto

| Capa | Uso anterior | Cambio |
| --- | --- | --- |
| PostgreSQL / Drizzle | `empleados.dni`, `UNIQUE(dni)`, `CHECK` de 8 dígitos | enum `tipo_documento_identidad`, columna `tipo_documento`, unicidad compuesta y `CHECK` condicional |
| Validación | `zDni` | `zDocumentoIdentidad`, con normalización por tipo |
| Dominio de empleados | creación y búsqueda por `dni` | creación y búsqueda por tipo + número; adaptadores antiguos quedan marcados como obsoletos |
| Seguridad | rate limit `dni:<usuario>` y auditoría `BUSQUEDA_DNI` | rate limit `documento:<usuario>` y nuevas entradas `BUSQUEDA_DOCUMENTO` |
| Venta | antes disparaba automáticamente al completar el formato | selector DNI/CE y búsqueda explícita mediante botón |
| Gestión | columnas, filtros y exportaciones rotulados DNI | rótulo Documento y presentación explícita `DNI`/`CE` |
| Métricas, ventas y usuarios | proyecciones con solo el número | las proyecciones incluyen el tipo para evitar ambigüedad |
| Borrador local | empleado con `dni` | tipo + número; lectura compatible con borradores DNI antiguos |
| Adjuntos | antes se exigía `FOTO_DNI` | no se solicitan ni crean fotos; una restricción `NOT VALID` bloquea filas nuevas sin borrar las existentes, que quedan inaccesibles hasta definir su eliminación |

## Migraciones y despliegue

### Fase 1: expansión (incluida)

1. Crear los enums y añadir `tipo_documento NOT NULL DEFAULT 'DNI'`.
2. El valor por defecto clasifica todos los registros históricos sin reescribir
   ni perder el número.
3. Sustituir constraint e índice de DNI por sus equivalentes condicional y
   compuesto.
4. Desplegar código que lee y escribe ambos campos.
5. Registrar las búsquedas nuevas como `BUSQUEDA_DOCUMENTO` sin alterar el
   historial `BUSQUEDA_DNI`.

La columna física continúa llamándose `dni` durante esta fase. Es una medida de
compatibilidad de despliegue: una instancia anterior todavía puede leer y
escribir DNI mientras se actualizan todas las instancias. En TypeScript y en el
contrato nuevo se expone como `numeroDocumento`.

### Fase 2: contracción (posterior)

Después de confirmar que no quedan instancias antiguas ni integraciones que
usen `dni`:

1. renombrar físicamente `empleados.dni` a `numero_documento`;
2. retirar los adaptadores obsoletos `buscarPorDni` y `DatosCrearEmpleado.dni`;
3. ejecutar una política aprobada de retención o eliminación para filas y
   blobs históricos `FOTO_DNI`; no deben borrarse automáticamente;
4. retirar el valor histórico `FOTO_DNI` del enum cuando ya no existan filas;
5. actualizar las especificaciones históricas solo si se decide convertirlas
   en documentación vigente.

## Contingencias cubiertas

Las pruebas verifican:

- DNI válido e inválido;
- CE numérico moderno y CE histórico con letra/guion;
- normalización de espacios y minúsculas;
- longitud y caracteres no permitidos;
- mismo número bajo dos tipos distintos;
- duplicado dentro del mismo tipo;
- migración implícita de filas antiguas a `DNI` mediante el valor por defecto;
- defensa duplicada: Zod en aplicación y `CHECK`/`UNIQUE` en PostgreSQL.

La prueba de PostgreSQL se ejecuta con `RUN_DB_TESTS=1` sobre una base migrada;
cada caso usa una transacción con rollback.
