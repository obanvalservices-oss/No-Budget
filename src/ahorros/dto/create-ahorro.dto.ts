import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateAhorroDto {
  @IsString()
  @IsNotEmpty()
  categoria: string;

  @IsNumber()
  monto: number;

  @IsString()
  @IsNotEmpty()
  objetivo: string;

  @IsBoolean()
  recurrente: boolean;

  @IsDateString()
  fecha: string;
}
