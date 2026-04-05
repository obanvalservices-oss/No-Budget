import { IsDateString, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateInversionDto {
  @IsString() tipo: string;
  @IsString() activo: string;
  @IsString() categoria: string;

  /** Capital en moneda de la cotización → acciones = capital / precio mercado al alta (con caché diaria). */
  @IsOptional() @IsNumber() capitalInvertido?: number;

  @IsOptional() @IsNumber() cantidad?: number;
  @IsOptional() @IsNumber() precioCompra?: number;
  @IsOptional() @IsNumber() precioActual?: number;
  @IsOptional() @IsString() descripcion?: string;

  /** Ticker Twelve Data (AAPL, BTC/USD, …). Opcional si el activo está en el mapa del servidor. */
  @IsOptional() @IsString() simbolo?: string;

  /** Solo planificación; no altera la posición hasta aportes ejecutados (registro futuro). */
  @IsOptional() @IsNumber() planAporteMonto?: number;
  @IsOptional() @IsString() planAporteFrecuencia?: string;
  /** Fecha desde la que aplica el plan (YYYY-MM-DD). */
  @IsOptional() @IsDateString() planAporteInicio?: string;

  /** Si no se envía, el servidor asigna o crea "Cartera principal". */
  @IsOptional() @IsInt() fondoId?: number;
}
