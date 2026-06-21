import { ModuloTipo, VisibilidadNivel } from '@prisma/client';

export class UpdatePermissionsDto {
  permisos: { modulo: ModuloTipo; visibilidad: VisibilidadNivel }[];
}
