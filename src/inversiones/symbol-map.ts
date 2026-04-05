/**
 * Resuelve el símbolo Twelve Data (acciones US / pares cripto / tickers tipeados ej. FXAIX).
 * El usuario puede forzar con `simbolo` en el DTO (ej. MSFT, SOL/USD).
 */
function looksLikeQuotedTicker(activo: string): boolean {
  const x = activo.trim();
  if (x.length < 2 || x.length > 20) return false;
  if (/\s/.test(x)) return false;
  return /^[A-Za-z0-9][A-Za-z0-9./-]*$/.test(x);
}

export function resolveQuoteSymbol(
  tipo: string,
  activo: string,
  simbolo?: string | null,
): string | null {
  const manual = simbolo?.trim();
  if (manual) return manual.toUpperCase();

  const t = (tipo || '').toLowerCase().trim();
  const a = (activo || '').trim();

  const PRESETS: Record<string, Record<string, string>> = {
    acciones: {
      Apple: 'AAPL',
      Amazon: 'AMZN',
      Meta: 'META',
    },
    criptomonedas: {
      Bitcoin: 'BTC/USD',
      Ethereum: 'ETH/USD',
    },
  };

  const table = PRESETS[t];
  if (table) {
    if (table[a]) return table[a];
    const hit = Object.entries(table).find(([k]) => k.toLowerCase() === a.toLowerCase());
    if (hit) return hit[1];
  }

  // Fondos, bonos, otros: si el activo parece ticker (FXAIX, BRK.B, BTC/USD), cotizarlo tal cual.
  if (looksLikeQuotedTicker(a)) return a.toUpperCase();

  return null;
}
