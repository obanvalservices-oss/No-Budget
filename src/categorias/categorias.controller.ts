import { Controller, Get, Post, Delete, Body, Param, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  // Soporta /categorias?modulo=INGRESOS
  @Get()
  findAllQuery(@Query('modulo') modulo?: string) {
    if (!modulo) {
      throw new BadRequestException('El parámetro "modulo" es requerido (INGRESOS, GASTOS, AHORROS, INVERSIONES).');
    }
    return this.categoriasService.findAll(modulo);
  }

  // Soporta /categorias/INGRESOS  (compat con tu frontend actual)
  @Get(':modulo')
  findAllParam(@Param('modulo') modulo: string) {
    if (!modulo) {
      throw new BadRequestException('El parámetro "modulo" es requerido (INGRESOS, GASTOS, AHORROS, INVERSIONES).');
    }
    return this.categoriasService.findAll(modulo);
  }

  @Post()
  create(@Body() body: { nombre: string; modulo: string }) {
    if (!body?.nombre || !body?.modulo) {
      throw new BadRequestException('Campos requeridos: nombre, modulo.');
    }
    return this.categoriasService.create({ nombre: body.nombre, modulo: body.modulo });
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.categoriasService.delete(id);
  }
}


