import { Controller, Get, Post, Body, Param, Delete, Req, UseGuards, Patch, Query } from '@nestjs/common';
import { InversionesService } from './inversiones.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateInversionDto } from './dto/create-inversione.dto';
import { UpdateInversionDto } from './dto/update-inversione.dto';

@UseGuards(JwtAuthGuard)
@Controller('inversiones')
export class InversionesController {
  constructor(private readonly inversionesService: InversionesService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateInversionDto) {
    return this.inversionesService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req) {
    return this.inversionesService.findAllByUser(req.user.id);
  }

  /** Cotización para el formulario (caché diaria; no spamea Twelve Data). */
  @Get('cotizacion')
  cotizacion(
    @Query('tipo') tipo?: string,
    @Query('activo') activo?: string,
    @Query('simbolo') simbolo?: string,
  ) {
    return this.inversionesService.previewCotizacion(tipo ?? '', activo ?? '', simbolo);
  }

  @Get('proyectados')
  findAllWithProjection(@Req() req, @Query('meses') _meses?: string) {
    return this.inversionesService.findAllByUser(req.user.id);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.inversionesService.findOne(req.user.id, id);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() dto: UpdateInversionDto) {
    return this.inversionesService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.inversionesService.remove(req.user.id, id);
  }
}
