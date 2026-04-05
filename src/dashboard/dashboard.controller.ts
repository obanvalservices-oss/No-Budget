import { Controller, Get, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /**
   * GET /dashboard/weekly
   * - period: "SEMANA" | "COMPARAR" | "1M" | "3M" | "6M"
   * - from, to: rango explícito (YYYY-MM-DD); si se envían ambos, se ignora period.
   */
  @Get('weekly')
  async weekly(
    @Req() req: { user: { id: number } },
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if ((from && !to) || (!from && to)) {
      throw new BadRequestException('Debe enviar ambos: from y to, o ninguno.');
    }

    return this.dashboard.getWeekly(req.user.id, { period, from, to });
  }
}
