// src/auth/auth.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async register(nombre: string, email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email ya registrado');

    const hash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { nombre: nombre || '', email, password: hash },
    });

    const token = this.jwtService.sign({ sub: user.id }, { expiresIn: JWT_EXPIRES });
    return { token, user: { id: user.id, nombre: user.nombre, email: user.email } };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Credenciales incorrectas');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new BadRequestException('Credenciales incorrectas');

    const token = this.jwtService.sign({ sub: user.id }, { expiresIn: JWT_EXPIRES });
    return { token, user: { id: user.id, nombre: user.nombre, email: user.email } };
  }
}
