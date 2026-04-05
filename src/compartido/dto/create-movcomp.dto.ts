import { ModuloTipo } from '@prisma/client';

export class CreateMovCompDto {
  modulo: ModuloTipo;
  concepto: string;
  montoTotal: number;
  aporteOwner?: number;   // si no mandas, se calcula 50/50
  aportePartner?: number; // opcional
  fecha: string;          // ISO
}
