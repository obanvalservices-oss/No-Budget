// src/compartido/compartido.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CompartidoService } from './compartido.service';
import { ModuloType, VisibilidadNivel } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('compartido')
export class CompartidoController {
  constructor(private readonly service: CompartidoService) {}

  @Post('invitar')
  invitar(@Req() req, @Body() body: {
    partnerEmail: string;
    partnerDisplayName: string;
    relacion: any;
    aliasParaOwner?: string;
    permisos: { modulo: ModuloType; visibilidad: VisibilidadNivel }[];
  }) {
    return this.service.invitar(req.user.id, body);
  }

  @Post(':id/aceptar')
  aceptar(@Req() req, @Param('id') id: string, @Body() body: { aliasParaPartner?: string }) {
    return this.service.aceptarInvitacion(req.user.id, id, body.aliasParaPartner);
  }

  @Get(':id/permisos')
  obtenerPermissions(@Req() req, @Param('id') id: string) {
    return this.service.obtenerPermissions(id, req.user.id);
  }

  @Patch(':id/permisos')
  actualizarPermissions(
    @Req() req,
    @Param('id') id: string,
    @Body() body: { permisos: { modulo: ModuloType; visibilidad: VisibilidadNivel }[] }
  ) {
    return this.service.actualizarPermissions(id, req.user.id, body.permisos);
  }

  @Get(':id/ocultos')
  listarOcultos(@Req() req, @Param('id') id: string) {
    return this.service.listarOcultos(id, req.user.id);
  }

  @Patch(':id/ocultos')
  syncOcultos(
    @Req() req,
    @Param('id') id: string,
    @Body() body: {
      add?: { modulo: ModuloType; recordId: string }[];
      remove?: { modulo: ModuloType; recordId: string }[];
    }
  ) {
    return this.service.syncOcultos(id, req.user.id, body.add, body.remove);
  }

  @Get(':id/dashboard')
  dashboard(@Req() req, @Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.dashboard(id, req.user.id, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Post(':id/movimientos')
  crearMovimiento(@Req() req, @Param('id') id: string, @Body() body: {
    modulo: ModuloType; concepto: string; montoTotal: number; aporteOwner?: number; aportePartner?: number; fecha: string;
    categoriaIdGasto?: string; categoriaAhorro?: string; categoriaInversion?: string;
  }) {
    return this.service.crearMovimientoCompartido(id, req.user.id, body);
  }
}
