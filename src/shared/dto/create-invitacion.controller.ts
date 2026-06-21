import { IsEmail, IsEnum, IsString, IsArray, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RelacionType, ModuloType, VisibilidadNivel } from '@prisma/client';

class PermisoDto {
  @IsEnum(ModuloType) modulo!: ModuloType;
  @IsEnum(VisibilidadNivel) visibilidad!: VisibilidadNivel;
}

export class CreateInvitacionDto {
  @IsEmail() partnerEmail!: string;
  @IsString() partnerDisplayName!: string;
  @IsEnum(RelacionType) relacion!: RelacionType;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PermisoDto)
  permisos!: PermisoDto[];
}
