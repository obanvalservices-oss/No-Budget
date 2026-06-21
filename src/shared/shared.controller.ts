import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SharedService } from './shared.service';
import { RelacionTipo, ModuloTipo, VisibilidadNivel } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('shared')
export class SharedController {
  constructor(private readonly sharedService: SharedService) {}

  @Post('invite')
  crearInvitacion(
    @Req() req: { user: { id: number } },
    @Body()
    body: {
      partnerEmail: string;
      partnerDisplayName: string;
      relacion: RelacionTipo;
      permisos: { modulo: ModuloTipo; visibilidad: VisibilidadNivel }[];
    },
  ) {
    return this.sharedService.crearInvitacion(
      req.user.id,
      body.partnerEmail,
      body.partnerDisplayName,
      body.relacion,
      body.permisos,
    );
  }
}
