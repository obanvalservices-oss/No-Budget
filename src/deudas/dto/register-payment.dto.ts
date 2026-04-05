// src/deudas/dto/register-payment.dto.ts
export type PaymentSource = 'MANUAL' | 'INGRESO' | 'SAVINGS';

export class RegisterPaymentDto {
  amount!: number;             // monto del pago
  date?: string;               // ISO date del pago
  source?: PaymentSource;      // MANUAL | INGRESO | SAVINGS
  ahorroId?: number;           // requerido si source = SAVINGS
}
