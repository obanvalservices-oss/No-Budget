// src/dashboard/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { esMovimientoAporteInicial } from '../ahorros/aporte-flujo.util';
import { PrismaService } from '../prisma/prisma.service';

type WeeklyParams = {
  period?: 'SEMANA' | 'COMPARAR' | '1M' | '3M' | '6M' | string | undefined;
  from?: string;
  to?: string;
};

type WeekSpan = { start: Date; end: Date; label: string };

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ========= Fechas (respetando settings del usuario) =========
  private startOfWeek(d: Date, weekStartDay: number): Date {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = x.getDay(); // 0..6 (0=Dom)
    const offset = (7 + dow - weekStartDay) % 7;
    x.setDate(x.getDate() - offset);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private endOfWeek(d: Date, weekEndDay: number, weekStartDay: number): Date {
    const s = this.startOfWeek(d, weekStartDay);
    // Diferencia entre start y end considerando día de fin custom
    const span = (7 + weekEndDay - weekStartDay) % 7; // 0..6
    const e = new Date(s);
    e.setDate(s.getDate() + span);
    e.setHours(23, 59, 59, 999);
    return e;
  }

  private addWeeks(d: Date, n: number) {
    const r = new Date(d);
    r.setDate(r.getDate() + n * 7);
    return r;
    }

  private addMonths(d: Date, n: number) {
    const r = new Date(d);
    r.setMonth(r.getMonth() + n);
    return r;
  }

  private fmtLabel(start: Date, end: Date, idx: number, period: string) {
    const s = start.toLocaleDateString();
    const e = end.toLocaleDateString();
    if (period === 'COMPARAR') {
      return idx === 0 ? `Semana (actual) ${s} - ${e}` : `Semana (anterior) ${s} - ${e}`;
    }
    return `Semana ${s} - ${e}`;
  }

  private buildWeeksByPeriod(
    now: Date,
    period: string,
    weekStartDay: number,
    weekEndDay: number,
  ): WeekSpan[] {
    const curS = this.startOfWeek(now, weekStartDay);
    const curE = this.endOfWeek(now, weekEndDay, weekStartDay);

    if (period === 'SEMANA' || !period) {
      return [{ start: curS, end: curE, label: this.fmtLabel(curS, curE, 0, 'SEMANA') }];
    }

    if (period === 'COMPARAR') {
      const prevS = this.addWeeks(curS, -1);
      const prevE = this.endOfWeek(prevS, weekEndDay, weekStartDay);
      return [
        { start: curS, end: curE, label: this.fmtLabel(curS, curE, 0, 'COMPARAR') },
        { start: prevS, end: prevE, label: this.fmtLabel(prevS, prevE, 1, 'COMPARAR') },
      ];
    }

    const monthsMap: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6 };
    const m = monthsMap[period] ?? 1;
    const endTarget = this.endOfWeek(this.addMonths(now, m), weekEndDay, weekStartDay);

    const arr: WeekSpan[] = [];
    let cursor = new Date(curS);
    let idx = 0;
    while (cursor <= endTarget) {
      const s = new Date(cursor);
      const e = this.endOfWeek(s, weekEndDay, weekStartDay);
      arr.push({ start: s, end: e, label: this.fmtLabel(s, e, idx++, period) });
      cursor = this.addWeeks(cursor, 1);
    }
    return arr;
  }

  private buildWeeksByRange(
    from: Date,
    to: Date,
    weekStartDay: number,
    weekEndDay: number,
  ): WeekSpan[] {
    const first = this.startOfWeek(from, weekStartDay);
    const last = this.endOfWeek(to, weekEndDay, weekStartDay);

    const out: WeekSpan[] = [];
    let cursor = new Date(first);
    let idx = 0;
    while (cursor <= last) {
      const s = new Date(cursor);
      const e = this.endOfWeek(s, weekEndDay, weekStartDay);
      out.push({ start: s, end: e, label: this.fmtLabel(s, e, idx++, 'RANGO') });
      cursor = this.addWeeks(cursor, 1);
    }
    return out;
  }

  // ========= Proyección de fijos (semanal/mensual) =========
  private placeInWeek(date: Date, weeks: WeekSpan[]): number {
    const t = +date;
    for (let i = 0; i < weeks.length; i++) {
      if (t >= +weeks[i].start && t <= +weeks[i].end) return i;
    }
    return -1;
  }

  private projectWeeklyDates(
    baseDate: Date,
    weeks: WeekSpan[],
    weekStartDay: number,
  ): Date[] {
    // Repite mismo día de la semana (dow) del baseDate en cada semana
    const targetDow = baseDate.getDay();
    const out: Date[] = [];
    for (const w of weeks) {
      // día dentro de la semana = (targetDow - weekStartDay + 7) % 7
      const delta = (7 + targetDow - weekStartDay) % 7;
      const d = new Date(w.start);
      d.setDate(d.getDate() + delta);
      out.push(d);
    }
    return out;
  }

  private daysInMonth(y: number, mZeroBased: number) {
    return new Date(y, mZeroBased + 1, 0).getDate();
  }

  private projectMonthlyDates(baseDate: Date, weeks: WeekSpan[]): Date[] {
    const day = baseDate.getDate(); // 1..31
    const out: Date[] = [];
    // Recorremos meses cubiertos por el rango de weeks
    const first = weeks[0].start;
    const last = weeks[weeks.length - 1].end;

    let y = first.getFullYear();
    let m = first.getMonth();

    while (new Date(y, m, 1) <= last) {
      const dim = this.daysInMonth(y, m);
      const d = new Date(y, m, Math.min(day, dim), 12, 0, 0, 0); // 12:00 para evitar TZ edge
      if (d >= first && d <= last) out.push(d);
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
    return out;
  }

  private normalizeDateOnly(d: Date): Date {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private addWeeksSafe(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n * 7);
    return r;
  }

  private addMonthsSameDaySafe(d: Date, n: number): Date {
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();
    const tm = m + n;
    const ty = y + Math.floor(tm / 12);
    const tMon = ((tm % 12) + 12) % 12;
    const last = new Date(ty, tMon + 1, 0).getDate();
    const r = new Date(d);
    r.setFullYear(ty, tMon, Math.max(1, Math.min(day, last)));
    r.setHours(0, 0, 0, 0);
    return r;
  }

  private firstOccurrenceOnOrAfter(
    baseDate: Date,
    rangeStart: Date,
    freq: 'semanal' | 'mensual',
  ): Date {
    let current = this.normalizeDateOnly(baseDate);
    const s = this.normalizeDateOnly(rangeStart);
    if (freq === 'semanal') {
      while (current < s) current = this.addWeeksSafe(current, 1);
    } else {
      while (current < s) current = this.addMonthsSameDaySafe(current, 1);
    }
    return current;
  }

  /**
   * Solo aportes del plan (proyectados). El capital inicial no cuenta como salida del banco:
   * representa fondos que ya estaban en la cartera.
   */
  private inversionCashItemsForWeek(
    inversiones: Array<{
      id: number;
      activo: string;
      tipo: string;
      cantidad: number | null;
      precioCompra: number | null;
      createdAt: Date;
      planAporteMonto: number | null;
      planAporteFrecuencia: string | null;
      planAporteInicio: Date | null;
    }>,
    weekStart: Date,
    weekEnd: Date,
  ): any[] {
    const out: any[] = [];
    const s = this.normalizeDateOnly(weekStart);
    const e = this.normalizeDateOnly(weekEnd);

    for (const inv of inversiones) {
      const activo = inv.activo || inv.tipo;

      const planM = Number(inv.planAporteMonto);
      if (!planM || planM <= 0) continue;
      const freq = String(inv.planAporteFrecuencia || '').toLowerCase();
      if (freq !== 'semanal' && freq !== 'mensual') continue;
      const baseInicio = inv.planAporteInicio ?? inv.createdAt;
      if (!baseInicio) continue;
      const inicio = this.normalizeDateOnly(new Date(baseInicio));

      if (freq === 'semanal') {
        let occ = this.firstOccurrenceOnOrAfter(inicio, s, 'semanal');
        while (occ <= e) {
          const nd = this.normalizeDateOnly(occ);
          if (nd >= inicio) {
            out.push({
              id: `planinv_${inv.id}_${nd.toISOString().slice(0, 10)}`,
              monto: planM,
              activo,
              tipo: 'plan',
              fecha: occ,
              __projection: true,
            });
          }
          occ = this.addWeeksSafe(occ, 1);
        }
      } else {
        let occ = this.normalizeDateOnly(new Date(baseInicio));
        while (occ < s) occ = this.addMonthsSameDaySafe(occ, 1);
        while (occ <= e) {
          if (occ >= inicio) {
            out.push({
              id: `planinv_${inv.id}_${occ.toISOString().slice(0, 10)}`,
              monto: planM,
              activo,
              tipo: 'plan',
              fecha: occ,
              __projection: true,
            });
          }
          occ = this.addMonthsSameDaySafe(occ, 1);
        }
      }
    }

    return out;
  }

  // ========= Carga y armado =========
  async getWeekly(userId: number, params: WeeklyParams) {
    // 1) Settings del usuario
    const settings =
      (await this.prisma.userSettings.findUnique({ where: { userId } })) ??
      ({
        userId,
        weekStartDay: 1, // Lunes
        weekEndDay: 0, // Domingo
        currency: 'USD',
        timezone: 'UTC',
        notifications: true,
      } as any);

    const weekStartDay = Number(settings.weekStartDay ?? 1);
    const weekEndDay = Number(settings.weekEndDay ?? 0);

    // 2) Definir weeks
    let weeks: WeekSpan[];
    if (params.from && params.to) {
      const fromD = new Date(params.from);
      const toD = new Date(params.to);
      weeks = this.buildWeeksByRange(fromD, toD, weekStartDay, weekEndDay);
    } else {
      const now = new Date();
      const p = (params.period || 'SEMANA').toUpperCase();
      weeks = this.buildWeeksByPeriod(now, p, weekStartDay, weekEndDay);
    }

    if (!weeks.length) return { weeks: [], totals: { ingresos: 0, gastos: 0, ahorros: 0, inversiones: 0 } };

    const rangeStart = weeks[0].start;
    const rangeEnd = weeks[weeks.length - 1].end;

    // 3) Traer datos reales en el rango (para no fijos y para referencia de fijos)
    const [ingresos, gastos, allInversiones, fondos] = await Promise.all([
      this.prisma.ingreso.findMany({
        where: { userId, OR: [{ fecha: { gte: rangeStart, lte: rangeEnd } }, { fijo: true }] },
        orderBy: { fecha: 'asc' },
      }),
      this.prisma.gasto.findMany({
        where: { userId, OR: [{ fecha: { gte: rangeStart, lte: rangeEnd } }, { fijo: true }] },
        orderBy: { fecha: 'asc' },
        include: { categoria: true },
      }),
      this.prisma.inversion.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.ahorro.findMany({
        where: { userId },
        include: { movimientos: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // 4) Inicializar buckets
    const buckets = weeks.map((w) => ({
      title: w.label,
      start: w.start,
      end: w.end,
      ingresos: [] as any[],
      gastos: [] as any[],
      inversiones: [] as any[],
      aportes: [] as any[],
    }));

    // 5) Inversiones: solo plan de aportes (capital inicial = ya en fondo, no flujo de caja)
    for (let wi = 0; wi < buckets.length; wi++) {
      buckets[wi].inversiones = this.inversionCashItemsForWeek(
        allInversiones,
        weeks[wi].start,
        weeks[wi].end,
      );
    }

    // 6) Aportes reales (movimientos de ahorro; aporte inicial = base del fondo, no flujo semanal)
    for (const f of fondos) {
      for (const m of f.movimientos) {
        if (esMovimientoAporteInicial(m.motivo)) continue;
        const idx = this.placeInWeek(new Date(m.fecha), weeks);
        if (idx >= 0) {
          buckets[idx].aportes.push({
            id: `mov_${f.id}_${m.id}`,
            fondoId: f.id,
            monto: Number(m.monto) || 0,
            motivo: m.motivo || 'APORTE',
            fecha: m.fecha,
            fondoNombre: f.objetivo,
          });
        }
      }
    }

    // 7) Ingresos — reales + proyección de fijos
    for (const inc of ingresos) {
      const fecha = new Date(inc.fecha);
      if (!inc.fijo) {
        const idx = this.placeInWeek(fecha, weeks);
        if (idx >= 0) buckets[idx].ingresos.push(inc);
        continue;
      }

      const freq = (inc.frecuencia || '').toLowerCase();
      if (freq === 'semanal') {
        const dates = this.projectWeeklyDates(fecha, weeks, weekStartDay);
        for (const d of dates) {
          const idx = this.placeInWeek(d, weeks);
          if (idx >= 0) {
            buckets[idx].ingresos.push({
              ...inc,
              id: `proj_ing_${inc.id}_${d.toISOString().slice(0, 10)}`,
              fecha: d,
              __projection: true,
            });
          }
        }
      } else if (freq === 'mensual') {
        const dates = this.projectMonthlyDates(fecha, weeks);
        for (const d of dates) {
          const idx = this.placeInWeek(d, weeks);
          if (idx >= 0) {
            buckets[idx].ingresos.push({
              ...inc,
              id: `proj_ing_${inc.id}_${d.toISOString().slice(0, 10)}`,
              fecha: d,
              __projection: true,
            });
          }
        }
      } else {
        // fijo sin frecuencia conocida: solo su fecha real si entra en rango
        const idx = this.placeInWeek(fecha, weeks);
        if (idx >= 0) buckets[idx].ingresos.push(inc);
      }
    }

    // 8) Gastos — reales + proyección de fijos
    for (const g of gastos) {
      const fecha = new Date(g.fecha);
      if (!g.fijo) {
        const idx = this.placeInWeek(fecha, weeks);
        if (idx >= 0) buckets[idx].gastos.push(g);
        continue;
      }

      const freq = (g.frecuencia || '').toLowerCase();
      if (freq === 'semanal') {
        const dates = this.projectWeeklyDates(fecha, weeks, weekStartDay);
        for (const d of dates) {
          const idx = this.placeInWeek(d, weeks);
          if (idx >= 0) {
            buckets[idx].gastos.push({
              ...g,
              id: `proj_gto_${g.id}_${d.toISOString().slice(0, 10)}`,
              fecha: d,
              __projection: true,
            });
          }
        }
      } else if (freq === 'mensual') {
        const dates = this.projectMonthlyDates(fecha, weeks);
        for (const d of dates) {
          const idx = this.placeInWeek(d, weeks);
          if (idx >= 0) {
            buckets[idx].gastos.push({
              ...g,
              id: `proj_gto_${g.id}_${d.toISOString().slice(0, 10)}`,
              fecha: d,
              __projection: true,
            });
          }
        }
      } else {
        const idx = this.placeInWeek(fecha, weeks);
        if (idx >= 0) buckets[idx].gastos.push(g);
      }
    }

    // 9) Totales
    const sum = (arr: any[], field = 'monto') =>
      arr.reduce((a, x) => a + (Number((x as any)[field]) || 0), 0);

    const result = buckets.map((b) => ({
      title: b.title,
      start: b.start,
      end: b.end,
      ingresos: b.ingresos,
      gastos: b.gastos,
      aportes: b.aportes,
      inversiones: b.inversiones,
      totals: {
        ingresos: sum(b.ingresos, 'monto'),
        gastos: sum(b.gastos, 'monto'),
        ahorros: sum(b.aportes, 'monto'),
        inversiones: sum(b.inversiones, 'monto') || 0,
        balance:
          sum(b.ingresos, 'monto') -
          sum(b.gastos, 'monto') -
          sum(b.aportes, 'monto') -
          (sum(b.inversiones, 'monto') || 0),
      },
    }));

    const totalsAll = result.reduce(
      (acc, r) => {
        acc.ingresos += r.totals.ingresos;
        acc.gastos += r.totals.gastos;
        acc.ahorros += r.totals.ahorros;
        acc.inversiones += r.totals.inversiones;
        return acc;
      },
      { ingresos: 0, gastos: 0, ahorros: 0, inversiones: 0 },
    );

    return { weeks: result, totals: totalsAll, settings: { weekStartDay, weekEndDay } };
  }
}
