import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInversionDto } from './dto/create-inversione.dto';
import { UpdateInversionDto } from './dto/update-inversione.dto';
import { MarketQuotesService } from './market-quotes.service';
import { resolveQuoteSymbol } from './symbol-map';

type InversionRow = Prisma.InversionGetPayload<{ include: { fondo: true } }>;

export type InversionMetricas = {
  simbolo: string | null;
  acciones: number;
  capitalInvertido: number;
  precioMercado: number;
  valorActual: number;
  pnl: number;
  pnlPct: number | null;
  variacionDiariaValor: number;
  variacionDiariaPct: number | null;
  cotizacionAsOf: string | null;
  cotizacionFuente: string;
};

@Injectable()
export class InversionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: MarketQuotesService,
  ) {}

  async previewCotizacion(tipo: string, activo: string, simbolo?: string) {
    const sym = resolveQuoteSymbol(tipo, activo, simbolo);
    if (!sym) {
      return {
        ok: false as const,
        symbol: null as string | null,
        message: 'No hay símbolo para cotizar. Indicá ticker (ej. AAPL) o elegí un activo con mapa.',
      };
    }
    const q = await this.quotes.getQuote(sym);
    if (!q) {
      return {
        ok: false as const,
        symbol: sym,
        message:
          'Sin cotización (configurá TWELVE_DATA_API_KEY o esperá caché). Podés registrar con cantidad y precio manual.',
      };
    }
    return {
      ok: true as const,
      symbol: sym,
      close: q.close,
      previousClose: q.previousClose,
      quoteDate: q.quoteDate,
      source: q.source,
    };
  }

  async create(userId: number, dto: CreateInversionDto) {
    let fondoId = dto.fondoId;
    if (fondoId == null) {
      let f = await this.prisma.fondoInversion.findFirst({
        where: { userId },
        orderBy: { id: 'asc' },
      });
      if (!f) {
        f = await this.prisma.fondoInversion.create({
          data: { nombre: 'Cartera principal', monto: 0, userId },
        });
      }
      fondoId = f.id;
    }

    const fondo = await this.prisma.fondoInversion.findFirst({
      where: { id: fondoId, userId },
    });
    if (!fondo) {
      throw new BadRequestException('Fondo de inversión no válido.');
    }

    const sym = resolveQuoteSymbol(dto.tipo, dto.activo, dto.simbolo);
    const cap =
      dto.capitalInvertido != null && Number(dto.capitalInvertido) > 0
        ? Number(dto.capitalInvertido)
        : null;

    let cantidad = dto.cantidad != null ? Number(dto.cantidad) : null;
    let precioCompra = dto.precioCompra != null ? Number(dto.precioCompra) : null;
    let precioActual = dto.precioActual != null ? Number(dto.precioActual) : null;

    if (cap != null) {
      if (!sym) {
        throw new BadRequestException(
          'Para registrar por capital necesitás un símbolo cotizable (campo simbolo o activo con mapa: Apple, Bitcoin, …).',
        );
      }
      const q = await this.quotes.getQuote(sym);
      if (!q) {
        throw new BadRequestException(
          'No hay precio de mercado disponible. Revisá TWELVE_DATA_API_KEY o registrá con cantidad y precio de compra manual.',
        );
      }
      precioCompra = q.close;
      cantidad = cap / q.close;
      precioActual = q.close;
    } else {
      if (cantidad == null || cantidad <= 0 || precioCompra == null || precioCompra <= 0) {
        throw new BadRequestException(
          'Enviá capitalInvertido (> 0) o bien cantidad y precioCompra (> 0).',
        );
      }
      if (sym && (dto.precioActual == null || Number.isNaN(Number(dto.precioActual)))) {
        const q = await this.quotes.getQuote(sym);
        if (q) precioActual = q.close;
      }
    }

    try {
      const row = await this.prisma.inversion.create({
        data: {
          tipo: dto.tipo,
          activo: dto.activo,
          categoria: dto.categoria,
          cantidad,
          precioCompra,
          precioActual: precioActual ?? null,
          descripcion: dto.descripcion ?? null,
          simbolo: sym ?? undefined,
          planAporteMonto: dto.planAporteMonto ?? undefined,
          planAporteFrecuencia: dto.planAporteFrecuencia ?? undefined,
          planAporteInicio: dto.planAporteInicio ? new Date(dto.planAporteInicio) : undefined,
          fondo: { connect: { id: fondoId } },
          user: { connect: { id: userId } },
        },
        include: { fondo: true },
      });
      return this.attachMetrics(row, await this.quoteMapForRows([row]));
    } catch {
      throw new InternalServerErrorException('Error al crear inversión.');
    }
  }

  async findAllByUser(userId: number) {
    const rows = await this.prisma.inversion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { fondo: true },
    });
    const quoteMap = await this.quoteMapForRows(rows);
    return rows.map((r) => this.attachMetrics(r, quoteMap));
  }

  async findOne(userId: number, id: string) {
    const row = await this.prisma.inversion.findFirst({
      where: { id: Number(id), userId },
      include: { fondo: true },
    });
    if (!row) throw new NotFoundException('Inversión no encontrada');
    const quoteMap = await this.quoteMapForRows([row]);
    return this.attachMetrics(row, quoteMap);
  }

  async update(userId: number, id: string, dto: UpdateInversionDto) {
    const existing = await this.prisma.inversion.findFirst({
      where: { id: Number(id), userId },
    });
    if (!existing) throw new NotFoundException('Inversión no encontrada');

    if (dto.fondoId != null) {
      const f = await this.prisma.fondoInversion.findFirst({
        where: { id: dto.fondoId, userId },
      });
      if (!f) throw new BadRequestException('Fondo de inversión no válido.');
    }

    const data: Prisma.InversionUpdateInput = {};
    if (dto.tipo !== undefined) data.tipo = dto.tipo;
    if (dto.activo !== undefined) data.activo = dto.activo;
    if (dto.categoria !== undefined) data.categoria = dto.categoria;
    if (dto.cantidad !== undefined) data.cantidad = dto.cantidad;
    if (dto.precioCompra !== undefined) data.precioCompra = dto.precioCompra;
    if (dto.precioActual !== undefined) data.precioActual = dto.precioActual;
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;
    if (dto.simbolo !== undefined) data.simbolo = dto.simbolo || null;
    if (dto.planAporteMonto !== undefined) data.planAporteMonto = dto.planAporteMonto;
    if (dto.planAporteFrecuencia !== undefined) {
      data.planAporteFrecuencia = dto.planAporteFrecuencia;
    }
    if (dto.planAporteInicio !== undefined) {
      data.planAporteInicio = dto.planAporteInicio ? new Date(dto.planAporteInicio) : null;
    }
    if (dto.fondoId !== undefined) data.fondo = { connect: { id: dto.fondoId } };

    try {
      const row = await this.prisma.inversion.update({
        where: { id: existing.id },
        data,
        include: { fondo: true },
      });
      const quoteMap = await this.quoteMapForRows([row]);
      return this.attachMetrics(row, quoteMap);
    } catch {
      throw new InternalServerErrorException('Error al actualizar inversión.');
    }
  }

  async remove(userId: number, id: string) {
    const existing = await this.prisma.inversion.findFirst({
      where: { id: Number(id), userId },
    });
    if (!existing) throw new NotFoundException('Inversión no encontrada');

    try {
      return await this.prisma.inversion.delete({ where: { id: existing.id } });
    } catch {
      throw new InternalServerErrorException('Error al eliminar inversión.');
    }
  }

  private async quoteMapForRows(rows: InversionRow[]) {
    const symSet = new Set<string>();
    for (const r of rows) {
      const s = resolveQuoteSymbol(r.tipo, r.activo, r.simbolo);
      if (s) symSet.add(s);
    }
    const quoteBySym = new Map<string, Awaited<ReturnType<MarketQuotesService['getQuote']>>>();
    await Promise.all(
      [...symSet].map(async (s) => {
        quoteBySym.set(s, await this.quotes.getQuote(s));
      }),
    );
    return quoteBySym;
  }

  private attachMetrics(
    inv: InversionRow,
    quoteBySym: Map<string, Awaited<ReturnType<MarketQuotesService['getQuote']>>>,
  ) {
    const sym = resolveQuoteSymbol(inv.tipo, inv.activo, inv.simbolo);
    const q = sym ? quoteBySym.get(sym) ?? null : null;

    const acciones = Number(inv.cantidad ?? 0);
    const precioCompra = Number(inv.precioCompra ?? 0);
    const capitalInvertido = acciones * precioCompra;

    let currentPrice = Number(inv.precioActual ?? inv.precioCompra ?? 0);
    let previousClose = currentPrice;
    let quoteDate: string | null = null;
    let quoteSource = 'posición';

    if (q) {
      currentPrice = q.close;
      previousClose = q.previousClose ?? q.close;
      quoteDate = q.quoteDate;
      quoteSource = q.source;
    }

    const valorActual = acciones * currentPrice;
    const pnl = valorActual - capitalInvertido;
    const pnlPct = capitalInvertido > 0 ? (pnl / capitalInvertido) * 100 : null;
    const deltaPorAccion = currentPrice - previousClose;
    const variacionDiariaValor = acciones * deltaPorAccion;
    const variacionDiariaPct = previousClose > 0 ? (deltaPorAccion / previousClose) * 100 : null;

    const metricas: InversionMetricas = {
      simbolo: sym,
      acciones,
      capitalInvertido,
      precioMercado: currentPrice,
      valorActual,
      pnl,
      pnlPct,
      variacionDiariaValor,
      variacionDiariaPct,
      cotizacionAsOf: quoteDate,
      cotizacionFuente: quoteSource,
    };

    return { ...inv, metricas };
  }
}
