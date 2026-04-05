// src/deudas/deudas.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeudasService } from './deudas.service';

// importa los tipos solo como tipos (evita TS1272 con emitDecoratorMetadata)
import type { CreateDebtDto, UpdateDebtDto, AddPaymentDto } from './deudas.service';

@UseGuards(JwtAuthGuard)
@Controller('deudas')
export class DeudasController {
  constructor(private readonly deudas: DeudasService) {}

  @Get()
  async listMine(@Req() req) {
    return this.deudas.findAll(req.user.id);
  }

  @Get(':id')
  async getOne(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.deudas.findOne(req.user.id, id);
  }

  @Post()
  async create(@Req() req, @Body() dto: CreateDebtDto) {
    // Normalización mínima (frontend ya valida)
    if (!dto || typeof dto.principal !== 'number') {
      throw new BadRequestException('Payload inválido.');
    }
    return this.deudas.create(req.user.id, dto);
  }

  @Patch(':id')
  async patchOne(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDebtDto,
  ) {
    return this.deudas.patch(req.user.id, id, dto);
  }

  @Delete(':id')
  async removeOne(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.deudas.remove(req.user.id, id);
  }

  // ------- Pagos -------
  @Post(':id/pagos')
  async addPayment(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddPaymentDto,
  ) {
    // el front envía { amount, fecha?, source?, ahorroId? }
    if (!dto || typeof dto.amount !== 'number') {
      throw new BadRequestException('Monto de pago inválido.');
    }
    return this.deudas.addPayment(req.user.id, id, dto);
  }

  @Delete(':id/pagos/:paymentId')
  async removePayment(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ) {
    return this.deudas.removePayment(req.user.id, id, paymentId);
  }
}
