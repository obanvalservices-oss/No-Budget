import { ModuloTipo, VisibilidadNivel, RelacionTipo } from '@prisma/client';

export class CreateInvitacionDto {
  partnerEmail: string;
  partnerDisplayName: string;
  relacion: RelacionTipo;
  aliasParaOwner?: string;
  permisos: { modulo: ModuloTipo; visibilidad: VisibilidadNivel }[];
}
