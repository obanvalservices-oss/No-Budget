// src/settings/settings.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SettingsService } from './settings.service';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // GET /settings → devuelve config o la crea con defaults
  @Get()
  async getMine(@Req() req) {
    return this.settings.findOrCreate(req.user.id);
  }

  // POST /settings → crear explícitamente (opcional, ya cubierto por findOrCreate)
  @Post()
  async createBase(@Req() req, @Body() dto: any) {
    return this.settings.createIfNotExists(req.user.id, dto);
  }

  // PATCH /settings → actualizar parcialmente
  @Patch()
  async patch(@Req() req, @Body() dto: any) {
    return this.settings.patch(req.user.id, dto);
  }

  // PATCH /settings/password → cambio de contraseña
  @Patch('password')
  async changePassword(
    @Req() req,
    @Body() dto: { currentPassword: string; newPassword: string },
  ) {
    if (!dto?.currentPassword || !dto?.newPassword) {
      throw new BadRequestException(
        'Campos requeridos: currentPassword, newPassword',
      );
    }
    await this.settings.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return { ok: true };
  }
}
