// src/compartido/compartido.module.ts
import { Module } from '@nestjs/common';
import { CompartidoController } from './compartido.controller';
import { CompartidoService } from './compartido.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CompartidoController],
  providers: [CompartidoService, PrismaService],
  exports: [CompartidoService],
})
export class CompartidoModule {}
