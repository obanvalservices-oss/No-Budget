import { PartialType } from '@nestjs/mapped-types';
import { CreateAhorroDto } from './create-ahorro.dto';

export class UpdateAhorroDto extends PartialType(CreateAhorroDto) {}
