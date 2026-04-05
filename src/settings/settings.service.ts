// src/settings/settings.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: number) {
    return this.prisma.userSettings.findUnique({ where: { userId } });
  }

  async findOrCreate(userId: number) {
    const exists = await this.findByUser(userId);
    if (exists) return exists;
    return this.createIfNotExists(userId, {});
  }

  async createIfNotExists(
    userId: number,
    base: Partial<{
      weekStartDay: number;
      weekEndDay: number;
      currency: string;
      timezone: string;
      notifications: boolean;
    }>,
  ) {
    const exists = await this.findByUser(userId);
    if (exists) return exists;

    return this.prisma.userSettings.create({
      data: {
        user: { connect: { id: userId } },
        weekStartDay: base.weekStartDay ?? 1,
        weekEndDay: base.weekEndDay ?? 7,
        currency: base.currency ?? 'USD',
        timezone: base.timezone ?? 'UTC',
        notifications: base.notifications ?? true,
      },
    });
  }

  async patch(
    userId: number,
    patch: Partial<{
      weekStartDay: number;
      weekEndDay: number;
      currency: string;
      timezone: string;
      notifications: boolean;
    }>,
  ) {
    const current = await this.findByUser(userId);
    if (current) {
      return this.prisma.userSettings.update({
        where: { userId },
        data: {
          weekStartDay:
            typeof patch.weekStartDay === 'number'
              ? patch.weekStartDay
              : undefined,
          weekEndDay:
            typeof patch.weekEndDay === 'number'
              ? patch.weekEndDay
              : undefined,
          currency:
            typeof patch.currency === 'string' ? patch.currency : undefined,
          timezone:
            typeof patch.timezone === 'string' ? patch.timezone : undefined,
          notifications:
            typeof patch.notifications === 'boolean'
              ? patch.notifications
              : undefined,
        },
      });
    } else {
      return this.createIfNotExists(userId, patch);
    }
  }

  // ===== Cambio de contraseña =====
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    if (newPassword.length < 6) {
      throw new BadRequestException(
        'La nueva contraseña debe tener al menos 6 caracteres.',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado');

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw new BadRequestException('La contraseña actual no es válida');

    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hash },
    });
    return { ok: true };
  }
}
