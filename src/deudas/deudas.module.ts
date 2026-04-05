// src/deudas/deudas.module.ts
import { Module } from '@nestjs/common';
import { DeudasService } from './deudas.service';
import { DeudasController } from './deudas.controller'
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DeudasController],
  providers: [DeudasService],
  exports: [DeudasService],
})
export class DeudasModule {}
