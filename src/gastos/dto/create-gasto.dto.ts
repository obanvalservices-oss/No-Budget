import {
  IsString,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateGastoDto {
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsNumber()
  monto: number;

  @IsString()
  @IsNotEmpty()
  categoriaId: string;

  @IsDateString()
  fecha: string;

  @IsBoolean()
  fijo: boolean;

  @IsString()
  @IsOptional()
  frecuencia?: string;

  @IsString()
  @IsNotEmpty()
  origen: string;
}
