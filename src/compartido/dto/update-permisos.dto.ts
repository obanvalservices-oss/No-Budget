import { ModuloType, VisibilidadNivel } from '@prisma/client';

export class UpdatePermissionsDto {
  permisos: { modulo: ModuloType; visibilidad: VisibilidadNivel }[];
}
