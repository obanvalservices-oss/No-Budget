import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { esMovimientoAporteInicial, MOTIVO_APORTE_INICIAL } from './aporte-flujo.util';

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

@Injectable()
export class AhorrosService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeFrequency(v: unknown): string | null {
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  }

  /** null = sin tasa configurada (no estimar). */
  private parseTasaAnnualPctCreate(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    return n;
  }

  /** undefined = no tocar en update. */
  private parseTasaAnnualPctUpdate(v: unknown): number | null | undefined {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    return n;
  }

  private assertFijoTieneFrequency(fijo: boolean, frecuencia: string | null) {
    if (fijo && !frecuencia) {
      throw new BadRequestException(
        'A fund with fixed contributions requires frequency (weekly, biweekly, or monthly).',
      );
    }
  }

  /** Interés simple anualizado sobre el saldo nominal desde fecha de inicio del fondo. */
  private estimarRendimiento(
    saldoNominal: number,
    fechaHome: Date,
    tasaAnnualPct: number | null,
  ): { rendimientoEstimado: number; saldoConRendimiento: number } {
    if (tasaAnnualPct == null || !Number.isFinite(saldoNominal) || saldoNominal === 0) {
      return { rendimientoEstimado: 0, saldoConRendimiento: saldoNominal };
    }
    const rate = Number(tasaAnnualPct);
    const years = Math.max(0, (Date.now() - fechaHome.getTime()) / MS_PER_YEAR);
    const rendimientoEstimado = saldoNominal * (rate / 100) * years;
    return {
      rendimientoEstimado,
      saldoConRendimiento: saldoNominal + rendimientoEstimado,
    };
  }

  async create(userId: number, dto: any) {
    try {
      const frecuencia = this.normalizeFrequency(dto.frecuencia);
      const fijo = !!(dto.fijo ?? dto.recurrente);
      this.assertFijoTieneFrequency(fijo, frecuencia);
      const tasaAnnualPct = this.parseTasaAnnualPctCreate(dto.tasaAnnualPct);
      const created = await this.prisma.ahorro.create({
        data: {
          objetivo: dto.nombre ?? dto.objetivo ?? '',
          monto: dto.meta ?? dto.monto ?? 0,                 // meta
          categoria: 'FONDO',
          fecha: new Date(dto.fechaHome ?? dto.fecha),     // fechaHome real
          recurrente: fijo,
          colorTag: frecuencia,
          // guardamos aporte fijo en un campo libre (sharedId) si no tienes columna dedicada
          sharedId: dto.aporteFijo != null ? String(dto.aporteFijo) : null,
          // descripción opcional
          descripcion: dto.descripcion ?? dto.nombre ?? null,
          tasaAnnualPct,
          user: { connect: { id: userId } },
          isShared: false,
        },
      });

      // primer movimiento (si llega "aporte")
      if (typeof dto.aporte === 'number' && dto.aporte > 0) {
        await this.prisma.movimientoAhorro.create({
          data: {
            ahorro: { connect: { id: created.id } },
            fecha: new Date(dto.fechaHome ?? dto.fecha),
            motivo: MOTIVO_APORTE_INICIAL,
            monto: dto.aporte,
          },
        });
      }

      return created;
    } catch (e) {
      throw new InternalServerErrorException('Error creating savings fund.');
    }
  }

  async findAllByUser(userId: number) {
    return this.prisma.ahorro.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Devuelve fondos con saldo + datos necesarios para proyección
  async findAllByUserWithSaldo(userId: number) {
    const fondos = await this.prisma.ahorro.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { movimientos: true },
    });

    return fondos.map((f: any) => {
      const movs = f.movimientos || [];
      let saldoBaseInicial = 0;
      let saldoOtrosAportes = 0;
      for (const m of movs) {
        const amt = Number(m.monto) || 0;
        if (esMovimientoAporteInicial(m.motivo)) saldoBaseInicial += amt;
        else saldoOtrosAportes += amt;
      }
      const saldo = saldoBaseInicial + saldoOtrosAportes;
      const aporteFijo = f.sharedId != null && !isNaN(Number(f.sharedId)) ? Number(f.sharedId) : 0;
      const tasaRaw = f.tasaAnnualPct;
      const tasaAnnualPct = tasaRaw != null && Number.isFinite(Number(tasaRaw)) ? Number(tasaRaw) : null;
      const { rendimientoEstimado, saldoConRendimiento } = this.estimarRendimiento(
        saldo,
        new Date(f.fecha),
        tasaAnnualPct,
      );

      return {
        id: f.id,
        nombre: f.objetivo,
        descripcion: f.descripcion ?? null,
        meta: Number(f.monto) || 0,
        fechaHome: f.fecha,            // clave para proyección
        fechaCreacion: f.createdAt,
        fijo: !!f.recurrente,
        frecuencia: f.colorTag ?? '',    // semanal | bisemanal | mensual
        aporteFijo,                      // monto a proyectar
        saldo,
        saldoBaseInicial,
        saldoOtrosAportes,
        tasaAnnualPct,
        rendimientoEstimado,
        saldoConRendimiento,
        movimientos: (f.movimientos || []).map((m: any) => ({
          id: m.id,
          fecha: m.fecha,
          motivo: m.motivo,
          monto: Number(m.monto) || 0,
        })),
      };
    });
  }

  async update(userId: number, id: string, dto: any) {
    const existing = await this.prisma.ahorro.findFirst({
      where: { id: Number(id), userId },
    });
    if (!existing) throw new NotFoundException('Fund not found');

    const nextFijo =
      dto.fijo !== undefined || dto.recurrente !== undefined
        ? !!(dto.fijo ?? dto.recurrente)
        : !!existing.recurrente;
    const nextFreq =
      dto.frecuencia !== undefined
        ? this.normalizeFrequency(dto.frecuencia)
        : this.normalizeFrequency(existing.colorTag);
    this.assertFijoTieneFrequency(nextFijo, nextFreq);

    const tasaPatch = this.parseTasaAnnualPctUpdate(dto.tasaAnnualPct);

    return this.prisma.ahorro.update({
      where: { id: existing.id },
      data: {
        objetivo: dto.nombre ?? dto.objetivo,
        descripcion: dto.descripcion,
        monto: dto.meta ?? dto.monto,
        fecha: dto.fechaHome ? new Date(dto.fechaHome) : dto.fecha ? new Date(dto.fecha) : undefined,
        recurrente: dto.fijo ?? dto.recurrente,
        colorTag:
          dto.frecuencia === undefined
            ? undefined
            : this.normalizeFrequency(dto.frecuencia),
        sharedId: dto.aporteFijo === undefined ? undefined : String(dto.aporteFijo),
        ...(tasaPatch !== undefined ? { tasaAnnualPct: tasaPatch } : {}),
      },
    });
  }

  async remove(userId: number, id: string) {
    const fondo = await this.prisma.ahorro.findFirst({ where: { id: Number(id), userId } });
    if (!fondo) throw new NotFoundException('Fund not found');

    await this.prisma.$transaction([
      this.prisma.movimientoAhorro.deleteMany({ where: { ahorroId: fondo.id } }),
      this.prisma.ahorro.delete({ where: { id: fondo.id } }),
    ]);

    return { ok: true };
  }

  // Transactions
  async addMovimiento(
    userId: number,
    ahorroId: number,
    data: { fecha: Date; monto: number; motivo: string },
  ) {
    const f = await this.prisma.ahorro.findFirst({ where: { id: ahorroId, userId } });
    if (!f) throw new NotFoundException('Fund not found');

    return this.prisma.movimientoAhorro.create({
      data: {
        ahorro: { connect: { id: ahorroId } },
        fecha: data.fecha,
        motivo: data.motivo,
        monto: data.monto,
      },
    });
  }

  async updateMovimiento(
    userId: number,
    ahorroId: number,
    movId: number,
    patch: { fecha?: Date; monto?: number; motivo?: string },
  ) {
    const f = await this.prisma.ahorro.findFirst({ where: { id: ahorroId, userId } });
    if (!f) throw new NotFoundException('Fund not found');

    const mov = await this.prisma.movimientoAhorro.findUnique({ where: { id: movId } });
    if (!mov || mov.ahorroId !== ahorroId) throw new NotFoundException('Transaction not found');

    return this.prisma.movimientoAhorro.update({
      where: { id: movId },
      data: {
        fecha: patch.fecha,
        monto: patch.monto as any,
        motivo: patch.motivo,
      },
    });
  }

  async deleteMovimiento(userId: number, ahorroId: number, movId: number) {
    const f = await this.prisma.ahorro.findFirst({ where: { id: ahorroId, userId } });
    if (!f) throw new NotFoundException('Fund not found');

    const mov = await this.prisma.movimientoAhorro.findUnique({ where: { id: movId } });
    if (!mov || mov.ahorroId !== ahorroId) throw new NotFoundException('Transaction not found');

    await this.prisma.movimientoAhorro.delete({ where: { id: movId } });
    return { ok: true };
  }
}
