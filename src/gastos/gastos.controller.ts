import { Controller, Get, Post, Body, Param, Delete, Req, UseGuards, Patch, Query } from '@nestjs/common';
import { GastosService } from './gastos.service';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { UpdateGastoDto } from './dto/update-gasto.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('gastos')
export class GastosController {
  constructor(private readonly gastosService: GastosService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateGastoDto) {
    return this.gastosService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req) {
    return this.gastosService.findAllByUser(req.user.id);
  }

  @Get('proyectados')
  findAllWithProjection(@Req() req, @Query('meses') meses?: string) {
    return this.gastosService.findAllByUserWithProjection(req.user.id, {
      proyectar: true,
      meses: Number(meses) || 6,
    });
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() dto: UpdateGastoDto) {
    return this.gastosService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.gastosService.remove(req.user.id, id);
  }
}
