// src/compartido/compartido.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AsociacionEstado, ModuloTipo, VisibilidadNivel } from '@prisma/client';

@Injectable()
export class CompartidoService {
  constructor(private prisma: PrismaService) {}

  private async assertMiembro(asociacionId: string, userId: number) {
    const asoc = await this.prisma.asociacion.findUnique({ where: { id: asociacionId } });
    if (!asoc) throw new NotFoundException('Asociación no encontrada');
    if (asoc.ownerId !== userId && asoc.partnerUserId !== userId) throw new ForbiddenException('No autorizado');
    return asoc;
  }

  private async ensureCategoria(modulo: 'GASTOS'|'INGRESOS', nombre = 'Compartido') {
    const cat = await this.prisma.categoria.findFirst({ where: { modulo, nombre } });
    if (cat) return cat.id;
    const created = await this.prisma.categoria.create({ data: { nombre, modulo } });
    return created.id;
  }

  private async ensureFondoCompartido(userId: number) {
    const existing = await this.prisma.fondoInversion.findFirst({ where: { userId, nombre: 'Compartido' } });
    if (existing) return existing.id;
    const created = await this.prisma.fondoInversion.create({
      data: { userId, nombre: 'Compartido', monto: 0, descripcion: 'Fondo autogenerado para movimientos compartidos' },
    });
    return created.id;
  }

  // ===== Invitaciones =====
  async invitar(ownerId: number, dto: {
    partnerEmail: string;
    partnerDisplayName: string;
    relacion: any;
    aliasParaOwner?: string;
    permisos: { modulo: ModuloTipo; visibilidad: VisibilidadNivel }[];
  }) {
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) throw new NotFoundException('Usuario no encontrado');

    const dup = await this.prisma.asociacion.findUnique({
      where: { ownerId_partnerEmail: { ownerId, partnerEmail: dto.partnerEmail } }
    });
    if (dup) throw new BadRequestException('Ya existe una invitación a ese correo');

    return this.prisma.asociacion.create({
      data: {
        ownerId,
        partnerEmail: dto.partnerEmail,
        partnerDisplayName: dto.partnerDisplayName,
        relacion: dto.relacion,
        aliasParaOwner: dto.aliasParaOwner ?? null,
        estado: AsociacionEstado.PENDIENTE,
        permisos: { create: dto.permisos.map(p => ({ modulo: p.modulo, visibilidad: p.visibilidad })) }
      },
      include: { permisos: true }
    });
  }

  async aceptarInvitacion(partnerUserId: number, asociacionId: string, aliasParaPartner?: string) {
    const asoc = await this.prisma.asociacion.findUnique({ where: { id: asociacionId } });
    if (!asoc) throw new NotFoundException('Asociación no encontrada');
    if (asoc.estado !== AsociacionEstado.PENDIENTE) throw new BadRequestException('La invitación no está pendiente');
    if (asoc.partnerUserId) throw new BadRequestException('La invitación ya fue aceptada');

    return this.prisma.asociacion.update({
      where: { id: asociacionId },
      data: { partnerUserId, aliasParaPartner: aliasParaPartner ?? null, estado: AsociacionEstado.ACTIVA }
    });
  }

  // ===== Permisos & Ocultos =====
  async obtenerPermisos(asociacionId: string, userId: number) {
    await this.assertMiembro(asociacionId, userId);
    return this.prisma.asociacionPermiso.findMany({ where: { asociacionId }, orderBy: { modulo: 'asc' } });
  }

  async actualizarPermisos(asociacionId: string, userId: number, permisos: { modulo: ModuloTipo; visibilidad: VisibilidadNivel }[]) {
    await this.assertMiembro(asociacionId, userId);
    for (const p of permisos) {
      await this.prisma.asociacionPermiso.upsert({
        where: { asociacionId_modulo: { asociacionId, modulo: p.modulo } },
        create: { asociacionId, modulo: p.modulo, visibilidad: p.visibilidad },
        update: { visibilidad: p.visibilidad }
      });
      if (p.visibilidad !== VisibilidadNivel.PARCIAL) {
        await this.prisma.asociacionOculto.deleteMany({ where: { asociacionId, modulo: p.modulo } });
      }
    }
    return { ok: true };
  }

  async listarOcultos(asociacionId: string, userId: number) {
    await this.assertMiembro(asociacionId, userId);
    return this.prisma.asociacionOculto.findMany({
      where: { asociacionId },
      orderBy: [{ modulo: 'asc' }, { recordId: 'asc' }],
    });
  }

  async syncOcultos(
    asociacionId: string,
    userId: number,
    add?: { modulo: ModuloTipo; recordId: string }[],
    remove?: { modulo: ModuloTipo; recordId: string }[],
  ) {
    await this.assertMiembro(asociacionId, userId);

    if (add?.length) {
      // SQLite: createMany has no skipDuplicates; avoid dupes with per-row create + ignore conflict
      for (const o of add) {
        const exists = await this.prisma.asociacionOculto.findFirst({
          where: { asociacionId, modulo: o.modulo, recordId: o.recordId },
        });
        if (!exists) {
          await this.prisma.asociacionOculto.create({
            data: { asociacionId, modulo: o.modulo, recordId: o.recordId },
          });
        }
      }
    }
    if (remove?.length) {
      for (const o of remove) {
        await this.prisma.asociacionOculto.deleteMany({
          where: { asociacionId, modulo: o.modulo, recordId: o.recordId },
        });
      }
    }
    return { ok: true };
  }

  // ===== Dashboard =====
  async dashboard(asociacionId: string, requesterId: number, range?: { from?: Date; to?: Date }) {
    const asoc = await this.prisma.asociacion.findUnique({
      where: { id: asociacionId },
      include: { permisos: true, ocultos: true }
    });
    if (!asoc) throw new NotFoundException('Asociación no encontrada');
    if (asoc.estado !== AsociacionEstado.ACTIVA) throw new BadRequestException('Asociación no activa');
    if (![asoc.ownerId, asoc.partnerUserId].includes(requesterId)) throw new ForbiddenException('No autorizado');

    const userIds = [asoc.ownerId, asoc.partnerUserId!].filter(Boolean) as number[];
    const fechaFilter: any = {};
    if (range?.from) fechaFilter.gte = range.from;
    if (range?.to) fechaFilter.lte = range.to;

    const byModulo = async <T>(mod: ModuloTipo, q: () => Promise<T[]>) => {
      const perm = asoc.permisos.find(p => p.modulo === mod);
      if (!perm || perm.visibilidad === VisibilidadNivel.NADA) return [] as any[];
      const rows = await q();
      if (perm.visibilidad === VisibilidadNivel.PARCIAL) {
        const ocultos = asoc.ocultos.filter(o => o.modulo === mod).map(o => o.recordId);
        return (rows as any[]).filter((r: any) => !ocultos.includes(String(r.id)));
      }
      return rows as any[];
    };

    const ingresos = await byModulo(ModuloTipo.INGRESOS, () =>
      this.prisma.ingreso.findMany({
        where: { userId: { in: userIds }, ...(Object.keys(fechaFilter).length ? { fecha: fechaFilter } : {}) },
        orderBy: { fecha: 'desc' }
      })
    );

    const gastos = await byModulo(ModuloTipo.GASTOS, () =>
      this.prisma.gasto.findMany({
        where: { userId: { in: userIds }, ...(Object.keys(fechaFilter).length ? { fecha: fechaFilter } : {}) },
        orderBy: { fecha: 'desc' },
        include: { categoria: true }
      })
    );

    const ahorros = await byModulo(ModuloTipo.AHORROS, () =>
      this.prisma.ahorro.findMany({
        where: { userId: { in: userIds }, ...(Object.keys(fechaFilter).length ? { fecha: fechaFilter } : {}) },
        orderBy: { fecha: 'desc' }
      })
    );

    const inversiones = await byModulo(ModuloTipo.INVERSIONES, () =>
      this.prisma.inversion.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: 'desc' },
        include: { fondo: true }
      })
    );

    const items = [
      ...ingresos.map(r => ({ modulo: 'INGRESOS', ...r })),
      ...gastos.map(r => ({ modulo: 'GASTOS', ...r })),
      ...ahorros.map(r => ({ modulo: 'AHORROS', ...r })),
      ...inversiones.map(r => ({ modulo: 'INVERSIONES', ...r })),
    ].sort((a: any, b: any) => new Date(b.fecha ?? b.createdAt).getTime() - new Date(a.fecha ?? a.createdAt).getTime());

    const total = {
      ingresos: ingresos.reduce((acc: number, r: any) => acc + (r.monto || 0), 0),
      gastos: gastos.reduce((acc: number, r: any) => acc + (r.monto || 0), 0),
      ahorros: ahorros.reduce((acc: number, r: any) => acc + (r.monto || 0), 0),
      inversiones: inversiones.reduce((acc: number, r: any) => acc + ((r.cantidad || 0) * (r.precioActual || 0)), 0),
    };

    return { asociacion: { id: asoc.id, ownerId: asoc.ownerId, partnerUserId: asoc.partnerUserId }, total, items };
  }

  // ===== Movimientos compartidos =====
  async crearMovimientoCompartido(asociacionId: string, requesterId: number, dto: {
    modulo: ModuloTipo; concepto: string; montoTotal: number; aporteOwner?: number; aportePartner?: number; fecha: string;
    categoriaIdGasto?: string; categoriaAhorro?: string; categoriaInversion?: string;
  }) {
    const asoc = await this.assertMiembro(asociacionId, requesterId);
    if (asoc.estado !== AsociacionEstado.ACTIVA) throw new BadRequestException('Asociación no activa');

    const ownerId = asoc.ownerId;
    const partnerId = asoc.partnerUserId!;
    if (!partnerId) throw new BadRequestException('Asociación sin partner aceptado');

    const total = Number(dto.montoTotal);
    const aporteOwner = dto.aporteOwner ?? Number((total / 2).toFixed(2));
    const aportePartner = dto.aportePartner ?? Number((total - aporteOwner).toFixed(2));
    if (Number((aporteOwner + aportePartner).toFixed(2)) !== Number(total.toFixed(2))) {
      throw new BadRequestException('Los aportes no suman el total');
    }

    const color = '#6f42c1';
    const fecha = new Date(dto.fecha);

    return this.prisma.$transaction(async tx => {
      const mov = await tx.movimientoCompartido.create({
        data: {
          asociacionId,
          modulo: dto.modulo,
          concepto: dto.concepto,
          montoTotal: total,
          aporteOwner,
          aportePartner,
          fecha,
          createdByUserId: requesterId
        }
      });

      if (dto.modulo === ModuloTipo.INGRESOS) {
        await tx.ingreso.createMany({
          data: [
            { userId: ownerId,   fuente: dto.concepto, monto: aporteOwner,  frecuencia: 'único', fecha, fijo: false, categoria: 'Compartido', isShared: true, sharedId: mov.id, colorTag: color },
            { userId: partnerId, fuente: dto.concepto, monto: aportePartner, frecuencia: 'único', fecha, fijo: false, categoria: 'Compartido', isShared: true, sharedId: mov.id, colorTag: color },
          ]
        });
      }

      if (dto.modulo === ModuloTipo.GASTOS) {
        const categoriaId = dto.categoriaIdGasto || await this.ensureCategoria('GASTOS');
        await tx.gasto.createMany({
          data: [
            { userId: ownerId,   descripcion: dto.concepto, monto: aporteOwner,  origen: 'Compartido', fecha, fijo: false, frecuencia: 'único', categoriaId, isShared: true, sharedId: mov.id, colorTag: color },
            { userId: partnerId, descripcion: dto.concepto, monto: aportePartner, origen: 'Compartido', fecha, fijo: false, frecuencia: 'único', categoriaId, isShared: true, sharedId: mov.id, colorTag: color },
          ]
        });
      }

      if (dto.modulo === ModuloTipo.AHORROS) {
        const categoria = dto.categoriaAhorro || 'Compartido';
        await tx.ahorro.createMany({
          data: [
            { userId: ownerId,   objetivo: dto.concepto, monto: aporteOwner,  categoria, fecha, recurrente: false, isShared: true, sharedId: mov.id, colorTag: color },
            { userId: partnerId, objetivo: dto.concepto, monto: aportePartner, categoria, fecha, recurrente: false, isShared: true, sharedId: mov.id, colorTag: color },
          ]
        });
      }

      if (dto.modulo === ModuloTipo.INVERSIONES) {
        const categoria = dto.categoriaInversion || 'Compartido';
        const fondoOwner = await this.ensureFondoCompartido(ownerId);
        const fondoPartner = await this.ensureFondoCompartido(partnerId);

        await tx.inversion.createMany({
          data: [
            { userId: ownerId,   tipo: 'Compartido', activo: dto.concepto, categoria, cantidad: 1, precioCompra: aporteOwner,  precioActual: aporteOwner,  descripcion: 'Mov compartido', fondoId: fondoOwner,  isShared: true, sharedId: mov.id, colorTag: color },
            { userId: partnerId, tipo: 'Compartido', activo: dto.concepto, categoria, cantidad: 1, precioCompra: aportePartner, precioActual: aportePartner, descripcion: 'Mov compartido', fondoId: fondoPartner, isShared: true, sharedId: mov.id, colorTag: color },
          ]
        });
      }

      return mov;
    });
  }
}
