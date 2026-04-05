// src/deudas/deudas.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * DTOs (exportados para que el controller pueda tipar con `import type`)
 */
export type Frequency = 'semanal' | 'bisemanal' | 'quincenal' | 'mensual' | null;

export interface CreateDebtDto {
  title: string;
  description?: string | null;
  principal: number;
  startDate: string;           // ISO date
  hasInstallments?: boolean;   // UI only (no se guarda)
  installmentsCount?: number;  // UI only — se usa solo para calcular installmentAmount
  frequency?: Frequency;
  firstDueDate?: string | null;
  interestRate?: number | null;
  installmentAmount?: number | null;

  // fuentes de pago
  downPayment?: number;        // pago inicial
  downSource?: 'NONE' | 'INGRESO' | 'SAVINGS';
  downSavings?: number;        // ahorroId si downSource === 'SAVINGS'

  installmentsSource?: 'INGRESO' | 'SAVINGS'; // (hoy: informativo; no se guarda)
  instSavings?: number;        // ahorroId para cuotas (hoy: informativo; no se guarda)
}

export interface UpdateDebtDto {
  title?: string;
  description?: string | null;
  principal?: number;
  interestRate?: number | null;
  startDate?: string;
  dueDay?: number | null;
  frequency?: Frequency;
  installmentAmount?: number | null; // puedes setear manualmente
  status?: 'ACTIVA' | 'INACTIVA';
}

export interface AddPaymentDto {
  amount: number;                     // monto del pago
  fecha?: string;                     // ISO date (default: today)
  source?: 'MANUAL' | 'INGRESO' | 'SAVINGS';
  ahorroId?: number;                  // si source === 'SAVINGS'
}

@Injectable()
export class DeudasService {
  constructor(private readonly prisma: PrismaService) {}

  // ------- Helpers -------
  private async calcPaidAndBalance(debtId: number, principal: number) {
    const agg = await this.prisma.debtPayment.aggregate({
      where: { debtId },
      _sum: { monto: true }, // en tu schema el campo es "monto"
    });
    const paid = agg._sum.monto ?? 0;
    const saldoPend = Math.max(0, principal - paid);
    return { paid, saldoPend };
  }

  private ensureUser(row: { userId: number } | null, userId: number) {
    if (!row || row.userId !== userId) throw new NotFoundException('No encontrado');
  }

  // ------- Listados -------
  async findAll(userId: number) {
    const rows = await this.prisma.debt.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], // ACTIVA primero
      include: { payments: { orderBy: { fecha: 'desc' } } },
    });

    // Decorar con "pagado" y "saldoPend" para el front
    return Promise.all(
      rows.map(async (d) => {
        const { paid, saldoPend } = await this.calcPaidAndBalance(d.id, d.principal);
        return {
          ...d,
          pagado: paid,
          saldoPend,
          pagos: d.payments, // alias conveniente para el front (antes usabas "pagos")
        };
      }),
    );
  }

  async findOne(userId: number, id: number) {
    const d = await this.prisma.debt.findUnique({
      where: { id },
      include: { payments: { orderBy: { fecha: 'desc' } } },
    });
    this.ensureUser(d, userId);

    const { paid, saldoPend } = await this.calcPaidAndBalance(d!.id, d!.principal);
    return { ...d!, pagado: paid, saldoPend, pagos: d!.payments };
  }

  // ------- Crear -------
  async create(userId: number, dto: CreateDebtDto) {
    if (!dto.title || !dto.principal || !dto.startDate) {
      throw new BadRequestException('Faltan campos obligatorios (title, principal, startDate).');
    }
    if (dto.principal <= 0) {
      throw new BadRequestException('El monto total (principal) debe ser mayor a 0.');
    }

    // Si el usuario pasó "installmentsCount", lo usamos SOLO para calcular installmentAmount
    let installmentAmount: number | null = null;
    const down = Number(dto.downPayment || 0);
    if (dto.hasInstallments && dto.installmentsCount && dto.installmentsCount > 0) {
      const base = Math.max(0, Number(dto.principal) - down);
      installmentAmount = Number((base / dto.installmentsCount).toFixed(2));
    }

    // Crear la deuda base (respetando TU schema: NO hay installmentsCount en DB)
    const debt = await this.prisma.debt.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description ?? null,
        principal: dto.principal,
        interestRate: dto.interestRate ?? null,
        startDate: new Date(dto.startDate),
        frequency: dto.frequency ?? null,        // 'semanal' | 'bisemanal' | 'mensual'
        installmentAmount: installmentAmount ?? dto.installmentAmount ?? null,
        initialDownPayment: dto.downPayment ?? 0,
        firstDueDate: dto.firstDueDate ? new Date(dto.firstDueDate) : null, // 👈
        status: 'ACTIVA',
      },
      include: { payments: true },
    });

    // Si hay pago inicial: registrar un DebtPayment
    if (down > 0) {
      // Validación simple de ahorro si vino ahorroId
      if (dto.downSource === 'SAVINGS' && !dto.downSavings) {
        throw new BadRequestException('Selecciona el fondo de ahorro para el pago inicial.');
      }
      await this.prisma.debtPayment.create({
        data: {
          debtId: debt.id,
          monto: down,
          fecha: dto.startDate ? new Date(dto.startDate) : new Date(),
          ahorroId: dto.downSource === 'SAVINGS' ? dto.downSavings ?? null : null,
        },
      });
    }

    // Recalcular pagado y saldo
    const { paid, saldoPend } = await this.calcPaidAndBalance(debt.id, debt.principal);
    return {
      ...debt,
      pagado: paid,
      saldoPend,
      pagos: debt.payments,
    };
  }

  // ------- Actualizar -------
  async patch(userId: number, id: number, dto: UpdateDebtDto) {
    const current = await this.prisma.debt.findUnique({ where: { id } });
    this.ensureUser(current, userId);

    const debt = await this.prisma.debt.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        principal: typeof dto.principal === 'number' ? dto.principal : undefined,
        interestRate: dto.interestRate === null ? null : dto.interestRate ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDay: dto.dueDay ?? undefined,
        frequency: dto.frequency === undefined ? undefined : dto.frequency,
        installmentAmount:
          dto.installmentAmount === null ? null :
          typeof dto.installmentAmount === 'number' ? dto.installmentAmount : undefined,
        status: dto.status ?? undefined,
      },
      include: { payments: { orderBy: { fecha: 'desc' } } },
    });

    const { paid, saldoPend } = await this.calcPaidAndBalance(debt.id, debt.principal);
    return { ...debt, pagado: paid, saldoPend, pagos: debt.payments };
  }

  // ------- Eliminar -------
  async remove(userId: number, id: number) {
    const d = await this.prisma.debt.findUnique({ where: { id } });
    this.ensureUser(d, userId);

    await this.prisma.debtPayment.deleteMany({ where: { debtId: id } });
    await this.prisma.debt.delete({ where: { id } });
    return { ok: true };
  }

  // ------- Pagos -------
  async addPayment(userId: number, debtId: number, dto: AddPaymentDto) {
    if (!dto || typeof dto.amount !== 'number' || dto.amount <= 0) {
      throw new BadRequestException('Monto de pago inválido.');
    }
    const deuda = await this.prisma.debt.findUnique({ where: { id: debtId } });
    this.ensureUser(deuda, userId);

    // Crear pago
    await this.prisma.debtPayment.create({
      data: {
        debtId,
        monto: dto.amount,
        fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
        // si se paga desde ahorros:
        ahorroId: dto.source === 'SAVINGS' ? (dto.ahorroId ?? null) : null,
      },
    });

    // Recalcular y actualizar estado
    const { paid, saldoPend } = await this.calcPaidAndBalance(debtId, deuda!.principal);
    await this.prisma.debt.update({
      where: { id: debtId },
      data: { status: saldoPend > 0 ? 'ACTIVA' : 'INACTIVA' },
    });

    const withPayments = await this.prisma.debt.findUnique({
      where: { id: debtId },
      include: { payments: { orderBy: { fecha: 'desc' } } },
    });

    return { ...withPayments!, pagado: paid, saldoPend, pagos: withPayments!.payments };
  }

  async removePayment(userId: number, debtId: number, paymentId: number) {
    const deuda = await this.prisma.debt.findUnique({ where: { id: debtId } });
    this.ensureUser(deuda, userId);

    const pay = await this.prisma.debtPayment.findUnique({ where: { id: paymentId } });
    if (!pay || pay.debtId !== debtId) throw new NotFoundException('Pago no encontrado');

    await this.prisma.debtPayment.delete({ where: { id: paymentId } });

    const { paid, saldoPend } = await this.calcPaidAndBalance(debtId, deuda!.principal);
    await this.prisma.debt.update({
      where: { id: debtId },
      data: { status: saldoPend > 0 ? 'ACTIVA' : 'INACTIVA' },
    });

    const withPayments = await this.prisma.debt.findUnique({
      where: { id: debtId },
      include: { payments: { orderBy: { fecha: 'desc' } } },
    });

    return { ...withPayments!, pagado: paid, saldoPend, pagos: withPayments!.payments };
  }
}
