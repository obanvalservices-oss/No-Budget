import { Module } from '@nestjs/common';
import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { IngresosModule } from './ingresos/ingresos.module';
import { GastosModule } from './gastos/gastos.module';
import { AhorrosModule } from './ahorros/ahorros.module';
import { InversionesModule } from './inversiones/inversiones.module';
import { CategoriasModule } from './categorias/categorias.module';
import { CompartidoModule } from './compartido/compartido.module';
import { SharedModule } from './shared/shared.module';
import { SettingsModule } from './settings/settings.module';
import { DeudasModule } from './deudas/deudas.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    IngresosModule,
    GastosModule,
    AhorrosModule,
    InversionesModule,
    CategoriasModule,
    SharedModule,
    CompartidoModule,
    SettingsModule,
    DeudasModule,
    DashboardModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'public'),
      serveRoot: '/',
    }),
  ],
})
export class AppModule {}
