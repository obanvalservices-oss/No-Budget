/** Motivo del movimiento creado al registrar aporte inicial (no cuenta en proyección semanal de caja). */
export const MOTIVO_APORTE_INICIAL = 'APORTE_INICIAL';

export function esMovimientoAporteInicial(motivo: string | null | undefined): boolean {
  return String(motivo ?? '').trim().toUpperCase() === MOTIVO_APORTE_INICIAL;
}
