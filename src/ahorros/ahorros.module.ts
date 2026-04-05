import { Module } from '@nestjs/common';
import { AhorrosService } from './ahorros.service';
import { AhorrosController } from './ahorros.controller';

@Module({
  controllers: [AhorrosController],
  providers: [AhorrosService],
})
export class AhorrosModule {}
