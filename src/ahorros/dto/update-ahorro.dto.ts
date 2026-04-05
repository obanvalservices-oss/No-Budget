import { PartialType } from '@nestjs/mapped-types';
import { CrearAhorroDto } from './create-ahorro.dto';

export class UpdateAhorroDto extends PartialType(CrearAhorroDto) {}
