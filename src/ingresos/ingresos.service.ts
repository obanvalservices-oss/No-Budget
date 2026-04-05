import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIngresoDto } from './dto/create-ingreso.dto';
import { UpdateIngresoDto } from './dto/update-ingreso.dto';

type ProjOpts = { proyectar: boolean; meses: number };

@Injectable()
export class IngresosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateIngresoDto) {
    try {
      const isFixed = !!dto.fijo;
      const frecuencia = (dto.frecuencia ?? '').trim().toLowerCase();

      return await this.prisma.ingreso.create({
        data: {
          fuente: dto.fuente,
          monto: dto.monto,
          categoria: dto.categoria,
          fecha: new Date(dto.fecha),
          fijo: isFixed,
          frecuencia: isFixed ? frecuencia : '',
          user: { connect: { id: userId } },
          isShared: false,
          sharedId: null,
          colorTag: null,
        },
      });
    } catch {
      throw new InternalServerErrorException('Error al crear ingreso.');
    }
  }

  async findAllByUser(userId: number) {
    return this.prisma.ingreso.findMany({
      where: { userId },
      orderBy: { fecha: 'desc' },
    });
  }

  async findAllByUserWithProjection(userId: number, opts: ProjOpts) {
    const base = await this.prisma.ingreso.findMany({
      where: { userId },
      orderBy: { fecha: 'desc' },
    });

    if (!opts.proyectar) return base;

    const horizonEnd = endOfWeek(addMonths(new Date(), Math.max(0, opts.meses || 0)));

    const projected: any[] = [];
    for (const row of base) {
      if (!row.fijo) continue;

      const freq = (row.frecuencia || '').toLowerCase();
      if (freq !== 'semanal' && freq !== 'mensual') continue;

      let cursor = new Date(row.fecha);
      while (true) {
        cursor = nextDate(cursor, freq);
        if (cursor > horizonEnd) break;

        projected.push({
          ...row,
          id: `virt_${row.id}_${cursor.toISOString().slice(0, 10)}`,
          fecha: new Date(cursor),
          __virtual: true,
        });
      }
    }

    const all = [...base, ...projected].sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha));
    return all;
  }

  async findOne(id: string) {
    const found = await this.prisma.ingreso.findUnique({ where: { id: Number(id) } });
    if (!found) throw new NotFoundException('Ingreso no encontrado');
    return found;
  }

  async update(userId: number, id: string, dto: UpdateIngresoDto) {
    const existing = await this.prisma.ingreso.findFirst({
      where: { id: Number(id), userId },
    });
    if (!existing) throw new NotFoundException('Ingreso no encontrado');

    try {
      const isFixed = dto.fijo ?? undefined;
      const frecuencia =
        dto.frecuencia !== undefined ? (dto.frecuencia || '').toLowerCase() : undefined;

      return await this.prisma.ingreso.update({
        where: { id: existing.id },
        data: {
          fuente: dto.fuente,
          monto: dto.monto as any,
          categoria: dto.categoria,
          fecha: dto.fecha ? new Date(dto.fecha) : undefined,
          fijo: isFixed,
          frecuencia,
        },
      });
    } catch {
      throw new InternalServerErrorException('Error al actualizar ingreso.');
    }
  }

  async remove(userId: number, id: string) {
    const existing = await this.prisma.ingreso.findFirst({
      where: { id: Number(id), userId },
    });
    if (!existing) throw new NotFoundException('Ingreso no encontrado');

    try {
      return await this.prisma.ingreso.delete({ where: { id: existing.id } });
    } catch {
      throw new InternalServerErrorException('Error al eliminar ingreso.');
    }
  }
}

/* Helpers de fecha */
function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const offset = day === 0 ? 6 : day - 1;
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
function nextDate(from: Date, freq: 'semanal' | 'mensual') {
  const d = new Date(from);
  if (freq === 'semanal') {
    d.setDate(d.getDate() + 7);
  } else {
    const day = d.getDate();
    const m = d.getMonth();
    const y = d.getFullYear();
    const target = new Date(y, m + 1, day);
    if (target.getMonth() !== (m + 1) % 12) {
      return new Date(y, m + 2, 0);
    }
    return target;
  }
  return d;
}
