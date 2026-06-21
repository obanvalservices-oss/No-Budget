import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriasService {
  constructor(private prisma: PrismaService) {}

  async findAll(modulo: string) {
    return this.prisma.categoria.findMany({
      where: { modulo },
      orderBy: { nombre: 'asc' },
    });
  }

  async create(data: { nombre: string; modulo: string }) {
    try {
      return await this.prisma.categoria.create({ data });
    } catch {
      throw new InternalServerErrorException('Error creating category.');
    }
  }

  async delete(id: string) {
    try {
      return await this.prisma.categoria.delete({ where: { id } });
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new BadRequestException('Cannot delete: category in use.');
      }
      throw new InternalServerErrorException('Error deleting category.');
    }
  }
}

