import { ModuloType, VisibilidadNivel, RelacionType } from '@prisma/client';

export class CreateInvitacionDto {
  partnerEmail: string;
  partnerDisplayName: string;
  relacion: RelacionType;
  aliasParaOwner?: string;
  permisos: { modulo: ModuloType; visibilidad: VisibilidadNivel }[];
}
