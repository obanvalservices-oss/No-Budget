// src/gastos/gastos.service.ts
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { UpdateGastoDto } from './dto/update-gasto.dto';

type ProjOpts = { proyectar: boolean; meses: number };

@Injectable()
export class GastosService {
  constructor(private readonly prisma: PrismaService) {}

  // ====== CREATE ============================================================
  async create(userId: number, dto: CreateGastoDto) {
    try {
      const isFixed = !!dto.fijo;
      const frecuencia = (dto.frecuencia ?? '').trim().toLowerCase(); // '' | 'semanal' | 'mensual' | 'bisemanal' (si lo usas)

      // Usamos el FK directo `categoriaId` para evitar el error de tipos en nested connect
      return await this.prisma.gasto.create({
        data: {
          descripcion: dto.descripcion,
          monto: dto.monto,
          origen: dto.origen,
          fecha: new Date(dto.fecha),
          fijo: isFixed,
          // en tu schema `frecuencia` es string NOT NULL → usa '' cuando no aplica
          frecuencia: isFixed ? frecuencia : '',
          categoriaId: dto.categoriaId ?? null, // puede venir null si no eligieron categoría
          userId,
          // banderas de compartido, según tu schema
          isShared: false,
          sharedId: null,
          colorTag: null,
        },
        include: { categoria: true },
      });
    } catch (error: any) {
      if (error.code === 'P2003') {
        if (error.meta?.field_name?.includes('categoriaId')) {
          throw new BadRequestException('Categoría no encontrada.');
        }
        if (error.meta?.field_name?.includes('userId')) {
          throw new BadRequestException('Usuario no válido.');
        }
      }
      throw new InternalServerErrorException('Error al crear gasto.');
    }
  }

  // ====== READ (compatibilidad) ============================================
  // (Si tu controlador aún llama a findAll() sin user, lo dejamos)
  async findAll() {
    return this.prisma.gasto.findMany({
      orderBy: { fecha: 'desc' },
      include: { categoria: true },
    });
  }

  // ====== READ por usuario (lista real, sin proyección) ====================
  async findAllByUser(userId: number) {
    return this.prisma.gasto.findMany({
      where: { userId },
      orderBy: { fecha: 'desc' },
      include: { categoria: true },
    });
  }

  // ====== READ con proyección a futuro (para dashboard) ====================
  async findAllByUserWithProjection(userId: number, opts: ProjOpts) {
    const base = await this.prisma.gasto.findMany({
      where: { userId },
      orderBy: { fecha: 'desc' },
      include: { categoria: true },
    });

    if (!opts.proyectar) return base;

    const months = Math.max(0, opts.meses || 0);
    const horizonEnd = endOfWeek(addMonths(new Date(), months));

    const projected: any[] = [];
    for (const row of base) {
      if (!row.fijo) continue;

      const freq = (row.frecuencia || '').toLowerCase(); // 'semanal' | 'mensual' | 'bisemanal'?
      if (!['semanal', 'mensual', 'bisemanal'].includes(freq)) continue;

      let cursor = new Date(row.fecha);
      while (true) {
        cursor = nextDate(cursor, freq as any);
        if (cursor > horizonEnd) break;

        projected.push({
          ...row,
          id: `virt_${row.id}_${cursor.toISOString().slice(0, 10)}`, // id virtual
          fecha: new Date(cursor),
          __virtual: true,
        });
      }
    }

    const all = [...base, ...projected].sort(
      (a, b) => +new Date(b.fecha) - +new Date(a.fecha),
    );
    return all;
  }

  // ====== READ one =========================================================
  async findOne(id: string) {
    const found = await this.prisma.gasto.findUnique({
      where: { id },
      include: { categoria: true },
    });
    if (!found) throw new NotFoundException('Gasto no encontrado');
    return found;
  }

  // ====== UPDATE ===========================================================
  async update(userId: number, id: string, dto: UpdateGastoDto) {
    const existing = await this.prisma.gasto.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Gasto no encontrado');

    try {
      const data: any = {
        descripcion: dto.descripcion,
        monto: dto.monto as any,
        origen: dto.origen,
        fecha: dto.fecha ? new Date(dto.fecha) : undefined,
        fijo: dto.fijo ?? undefined,
        // si envías '' limpia la frecuencia; si no envías nada, no la toca
        frecuencia:
          dto.frecuencia !== undefined
            ? (dto.frecuencia ?? '').toLowerCase()
            : undefined,
      };

      if (dto.categoriaId !== undefined) {
        data.categoriaId = dto.categoriaId || null;
      }

      return await this.prisma.gasto.update({
        where: { id: existing.id },
        data,
        include: { categoria: true },
      });
    } catch (e: any) {
      if (e.code === 'P2003' && e.meta?.field_name?.includes('categoriaId')) {
        throw new BadRequestException('Categoría no encontrada.');
      }
      throw new InternalServerErrorException('Error al actualizar gasto.');
    }
  }

  // ====== DELETE uno =======================================================
  async remove(userId: number, id: string) {
    const existing = await this.prisma.gasto.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Gasto no encontrado');

    try {
      return await this.prisma.gasto.delete({ where: { id: existing.id } });
    } catch {
      throw new InternalServerErrorException('Error al eliminar gasto.');
    }
  }

  // ====== DELETE todos por usuario (para "Borrar todo") ====================
  async removeAllByUser(userId: number) {
    await this.prisma.gasto.deleteMany({ where: { userId } });
    return { ok: true };
  }
}

/* ================= Helpers de fecha ================= */

function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay(); // 0=Dom, 1=Lun
  const offset = day === 0 ? 6 : day - 1; // Lunes como inicio
  x.setDate(x.getDate() - offset);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function nextDate(
  from: Date,
  freq: 'semanal' | 'mensual' | 'bisemanal',
): Date {
  const d = new Date(from);
  if (freq === 'semanal') {
    d.setDate(d.getDate() + 7);
    return d;
  }
  if (freq === 'bisemanal') {
    d.setDate(d.getDate() + 14);
    return d;
  }
  // mensual: mismo día; si no existe (31 → feb), usamos último día del mes destino
  const day = d.getDate();
  const m = d.getMonth();
  const y = d.getFullYear();
  const target = new Date(y, m + 1, day);
  if (target.getMonth() !== (m + 1) % 12) {
    return new Date(y, m + 2, 0);
  }
  return target;
}
