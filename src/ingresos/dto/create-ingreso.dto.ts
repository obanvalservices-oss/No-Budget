// src/ingresos/dto/create-ingreso.dto.ts
import { IsString, IsNumber, IsBoolean, IsDateString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateIngresoDto {
  @IsString()
  @IsNotEmpty()
  fuente: string;

  @IsNumber()
  monto: number;

  @IsString()
  @IsNotEmpty()
  categoria: string;

  @IsDateString()
  fecha: string;

  @IsBoolean()
  fijo: boolean;

  // cuando no aplica, envia '' (string vacío)
  @IsString()
  @IsOptional()
  frecuencia?: string; // 'semanal' | 'mensual' | ''
}
