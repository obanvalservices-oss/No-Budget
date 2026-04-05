import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateInversionDto } from './create-inversione.dto';

/** capitalInvertido solo en alta; las compras extra serían otro flujo (aportes ejecutados). */
export class UpdateInversionDto extends PartialType(
  OmitType(CreateInversionDto, ['capitalInvertido'] as const),
) {}
