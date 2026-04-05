import { Module } from '@nestjs/common';
import { InversionesService } from './inversiones.service';
import { InversionesController } from './inversiones.controller';
import { MarketQuotesService } from './market-quotes.service';

@Module({
  controllers: [InversionesController],
  providers: [InversionesService, MarketQuotesService],
})
export class InversionesModule {}
