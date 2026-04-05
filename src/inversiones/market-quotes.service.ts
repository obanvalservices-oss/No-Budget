import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type QuoteResult = {
  close: number;
  previousClose: number | null;
  quoteDate: string;
  source: 'cache_today' | 'twelvedata' | 'stale_cache';
};

function utcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class MarketQuotesService {
  private readonly log = new Logger(MarketQuotesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Una cotización por símbolo y día (UTC): usa fila del día; si no existe y hay API key, llama Twelve Data una vez y persiste.
   * Si falla la API, usa la última fila guardada para ese símbolo.
   */
  async getQuote(symbol: string): Promise<QuoteResult | null> {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return null;

    const today = utcYmd();
    const cached = await this.prisma.marketQuoteDaily.findUnique({
      where: { symbol_quoteDate: { symbol: sym, quoteDate: today } },
    });
    if (cached) {
      return {
        close: cached.close,
        previousClose: cached.previousClose ?? null,
        quoteDate: cached.quoteDate,
        source: 'cache_today',
      };
    }

    const apiKey = process.env.TWELVE_DATA_API_KEY?.trim();
    if (apiKey) {
      try {
        const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(sym)}&apikey=${apiKey}`;
        const res = await fetch(url);
        const j = (await res.json()) as Record<string, unknown>;
        const codeErr =
          j.status === 'error' ||
          (typeof j.code === 'number' && j.code >= 400) ||
          (typeof j.code === 'string' && j.code.length > 0 && j.code !== '200');
        if (!res.ok || codeErr) {
          this.log.warn(`Twelve Data error ${sym}: ${String(j.message ?? j.code ?? res.status)}`);
        } else {
          const close = parseFloat(String(j.close ?? ''));
          if (!Number.isFinite(close)) {
            throw new Error('invalid close');
          }
          const pcRaw = j.previous_close ?? j.prev_close;
          let previousClose: number | null = null;
          if (pcRaw != null && pcRaw !== '') {
            const p = parseFloat(String(pcRaw));
            if (Number.isFinite(p)) previousClose = p;
          }
          const row = await this.prisma.marketQuoteDaily.upsert({
            where: { symbol_quoteDate: { symbol: sym, quoteDate: today } },
            create: {
              symbol: sym,
              quoteDate: today,
              close,
              previousClose,
            },
            update: {
              close,
              previousClose,
            },
          });
          return {
            close: row.close,
            previousClose: row.previousClose ?? null,
            quoteDate: row.quoteDate,
            source: 'twelvedata',
          };
        }
      } catch (e) {
        this.log.warn(`Twelve Data fetch failed ${sym}: ${e}`);
      }
    }

    const stale = await this.prisma.marketQuoteDaily.findFirst({
      where: { symbol: sym },
      orderBy: { quoteDate: 'desc' },
    });
    if (stale) {
      return {
        close: stale.close,
        previousClose: stale.previousClose ?? null,
        quoteDate: stale.quoteDate,
        source: 'stale_cache',
      };
    }

    return null;
  }
}
