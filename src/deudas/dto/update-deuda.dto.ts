// src/deudas/dto/update-deuda.dto.ts
export class UpdateDeudaDto {
    nombre?: string;
    montoTotal?: number;
    cuotaMonto?: number;
    cuotaFecha?: string;
    frecuencia?: 'mensual' | 'semanal' | 'libre';
    activa?: boolean;
  }
  