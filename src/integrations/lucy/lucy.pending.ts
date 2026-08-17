/**
 * PENDIENTE — no implementar ni “arreglar” Lucy como si ya operara.
 *
 * Lucy será un SDK / API externa que se conectará aquí más adelante.
 * El cliente HTTP y las rutas quedan como contrato de conexión.
 * El worker NO debe abrir ni cerrar trades por Lucy hasta que esto pase a false.
 */
export const LUCY_INTEGRATION = {
  pending: true,
  enabled: false,
  reason: 'Lucy SDK/API aún no está implementada. El cliente queda listo para la conexión.',
} as const;
