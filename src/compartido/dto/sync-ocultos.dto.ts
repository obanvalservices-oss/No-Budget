import { ModuloTipo } from '@prisma/client';

export class SyncOcultosDto {
  add?: { modulo: ModuloTipo; recordId: string; sourceUserId: number }[];
  remove?: { modulo: ModuloTipo; recordId: string; sourceUserId: number }[];
}
