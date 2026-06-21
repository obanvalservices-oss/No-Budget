import { ModuloType } from '@prisma/client';

export class SyncOcultosDto {
  add?: { modulo: ModuloType; recordId: string; sourceUserId: number }[];
  remove?: { modulo: ModuloType; recordId: string; sourceUserId: number }[];
}
