import { ModuloTipo, VisibilidadNivel } from '@prisma/client';

export class UpdatePermisosDto {
  permisos: { modulo: ModuloTipo; visibilidad: VisibilidadNivel }[];
}
