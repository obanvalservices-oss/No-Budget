import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RelacionTipo, ModuloTipo, VisibilidadNivel } from '@prisma/client';

@Injectable()
export class SharedService {
  constructor(private prisma: PrismaService) {}

  async crearInvitacion(
    ownerId: number,
    partnerEmail: string,
    partnerDisplayName: string,
    relacion: RelacionTipo,
    permisos: { modulo: ModuloTipo; visibilidad: VisibilidadNivel }[],
  ) {
    return this.prisma.asociacion.create({
      data: {
        ownerId,
        partnerEmail,
        partnerDisplayName,
        relacion,
        permisos: {
          create: permisos.map((p) => ({
            modulo: p.modulo,
            visibilidad: p.visibilidad,
          })),
        },
      },
      include: {
        permisos: true,
      },
    });
  }
}
