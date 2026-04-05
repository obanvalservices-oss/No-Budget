// src/shared/shared.module.ts
import { Module } from '@nestjs/common';
import { SharedService } from './shared.service';
import { SharedController } from './shared.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SharedController],
  providers: [SharedService],
})
export class SharedModule {}
