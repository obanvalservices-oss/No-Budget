import { ModuloType } from '@prisma/client';

export class CreateMovCompDto {
  modulo: ModuloType;
  concepto: string;
  montoTotal: number;
  aporteOwner?: number;   // si no mandas, se calcula 50/50
  aportePartner?: number; // opcional
  fecha: string;          // ISO
}
