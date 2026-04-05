import { IsEmail, IsEnum, IsString, IsArray, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RelacionTipo, ModuloTipo, VisibilidadNivel } from '@prisma/client';

class PermisoDto {
  @IsEnum(ModuloTipo) modulo!: ModuloTipo;
  @IsEnum(VisibilidadNivel) visibilidad!: VisibilidadNivel;
}

export class CreateInvitacionDto {
  @IsEmail() partnerEmail!: string;
  @IsString() partnerDisplayName!: string;
  @IsEnum(RelacionTipo) relacion!: RelacionTipo;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PermisoDto)
  permisos!: PermisoDto[];
}
