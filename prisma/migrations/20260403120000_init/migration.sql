-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."RelacionTipo" AS ENUM ('PAREJA', 'AMIGO', 'SOCIO', 'FAMILIAR', 'OTRO');

-- CreateEnum
CREATE TYPE "public"."ModuloTipo" AS ENUM ('INGRESOS', 'GASTOS', 'AHORROS', 'INVERSIONES');

-- CreateEnum
CREATE TYPE "public"."VisibilidadNivel" AS ENUM ('NADA', 'PARCIAL', 'TOTAL');

-- CreateEnum
CREATE TYPE "public"."AsociacionEstado" AS ENUM ('PENDIENTE', 'ACTIVA', 'REVOCADA', 'RECHAZADA', 'BLOQUEADA');

-- CreateEnum
CREATE TYPE "public"."PaySource" AS ENUM ('INCOME', 'SAVINGS');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserSettings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "weekStartDay" INTEGER NOT NULL DEFAULT 1,
    "weekEndDay" INTEGER NOT NULL DEFAULT 7,
    "currency" TEXT DEFAULT 'USD',
    "timezone" TEXT DEFAULT 'UTC',
    "notifications" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Categoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ingreso" (
    "id" SERIAL NOT NULL,
    "fuente" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "frecuencia" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "fijo" BOOLEAN NOT NULL,
    "categoria" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "sharedId" TEXT,
    "colorTag" TEXT,

    CONSTRAINT "Ingreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Gasto" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "origen" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "fijo" BOOLEAN NOT NULL,
    "frecuencia" TEXT,
    "categoriaId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "sharedId" TEXT,
    "colorTag" TEXT,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ahorro" (
    "id" SERIAL NOT NULL,
    "objetivo" TEXT NOT NULL DEFAULT '',
    "monto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "categoria" TEXT NOT NULL DEFAULT '',
    "fecha" TIMESTAMP(3) NOT NULL,
    "recurrente" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "sharedId" TEXT,
    "colorTag" TEXT,
    "descripcion" TEXT,
    "tasaAnualPct" DOUBLE PRECISION,

    CONSTRAINT "Ahorro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FondoInversion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "FondoInversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Inversion" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "activo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION,
    "precioCompra" DOUBLE PRECISION,
    "precioActual" DOUBLE PRECISION,
    "descripcion" TEXT,
    "simbolo" TEXT,
    "planAporteMonto" DOUBLE PRECISION,
    "planAporteFrecuencia" TEXT,
    "planAporteInicio" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fondoId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "sharedId" TEXT,
    "colorTag" TEXT,

    CONSTRAINT "Inversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketQuoteDaily" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "quoteDate" TEXT NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "previousClose" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketQuoteDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MovimientoAhorro" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT NOT NULL DEFAULT '',
    "monto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ahorroId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoAhorro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Asociacion" (
    "id" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "partnerUserId" INTEGER,
    "partnerEmail" TEXT NOT NULL,
    "partnerDisplayName" TEXT NOT NULL,
    "relacion" "public"."RelacionTipo" NOT NULL,
    "estado" "public"."AsociacionEstado" NOT NULL DEFAULT 'PENDIENTE',
    "aliasParaOwner" TEXT,
    "aliasParaPartner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asociacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AsociacionPermiso" (
    "id" TEXT NOT NULL,
    "asociacionId" TEXT NOT NULL,
    "modulo" "public"."ModuloTipo" NOT NULL,
    "visibilidad" "public"."VisibilidadNivel" NOT NULL,

    CONSTRAINT "AsociacionPermiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AsociacionOculto" (
    "id" TEXT NOT NULL,
    "asociacionId" TEXT NOT NULL,
    "modulo" "public"."ModuloTipo" NOT NULL,
    "recordId" TEXT NOT NULL,

    CONSTRAINT "AsociacionOculto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MovimientoCompartido" (
    "id" TEXT NOT NULL,
    "asociacionId" TEXT NOT NULL,
    "modulo" "public"."ModuloTipo" NOT NULL,
    "concepto" TEXT NOT NULL,
    "montoTotal" DOUBLE PRECISION NOT NULL,
    "aporteOwner" DOUBLE PRECISION NOT NULL,
    "aportePartner" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "createdByUserId" INTEGER,

    CONSTRAINT "MovimientoCompartido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Debt" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "principal" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueDay" INTEGER,
    "frequency" TEXT,
    "installmentAmount" DOUBLE PRECISION,
    "initialDownPayment" DOUBLE PRECISION DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVA',
    "firstDueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DebtPayment" (
    "id" SERIAL NOT NULL,
    "debtId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "paySource" "public"."PaySource" NOT NULL DEFAULT 'INCOME',
    "ahorroId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "public"."UserSettings"("userId");

-- CreateIndex
CREATE INDEX "Ingreso_sharedId_idx" ON "public"."Ingreso"("sharedId");

-- CreateIndex
CREATE INDEX "Ahorro_sharedId_idx" ON "public"."Ahorro"("sharedId");

-- CreateIndex
CREATE INDEX "Inversion_sharedId_idx" ON "public"."Inversion"("sharedId");

-- CreateIndex
CREATE INDEX "MarketQuoteDaily_symbol_idx" ON "public"."MarketQuoteDaily"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "MarketQuoteDaily_symbol_quoteDate_key" ON "public"."MarketQuoteDaily"("symbol", "quoteDate");

-- CreateIndex
CREATE INDEX "Asociacion_ownerId_partnerUserId_idx" ON "public"."Asociacion"("ownerId", "partnerUserId");

-- CreateIndex
CREATE INDEX "Asociacion_ownerId_idx" ON "public"."Asociacion"("ownerId");

-- CreateIndex
CREATE INDEX "Asociacion_partnerUserId_idx" ON "public"."Asociacion"("partnerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Asociacion_ownerId_partnerEmail_key" ON "public"."Asociacion"("ownerId", "partnerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "AsociacionPermiso_asociacionId_modulo_key" ON "public"."AsociacionPermiso"("asociacionId", "modulo");

-- CreateIndex
CREATE INDEX "AsociacionOculto_asociacionId_modulo_idx" ON "public"."AsociacionOculto"("asociacionId", "modulo");

-- CreateIndex
CREATE INDEX "MovimientoCompartido_asociacionId_idx" ON "public"."MovimientoCompartido"("asociacionId");

-- CreateIndex
CREATE INDEX "MovimientoCompartido_createdByUserId_idx" ON "public"."MovimientoCompartido"("createdByUserId");

-- AddForeignKey
ALTER TABLE "public"."UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ingreso" ADD CONSTRAINT "Ingreso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Gasto" ADD CONSTRAINT "Gasto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Gasto" ADD CONSTRAINT "Gasto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ahorro" ADD CONSTRAINT "Ahorro_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FondoInversion" ADD CONSTRAINT "FondoInversion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inversion" ADD CONSTRAINT "Inversion_fondoId_fkey" FOREIGN KEY ("fondoId") REFERENCES "public"."FondoInversion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inversion" ADD CONSTRAINT "Inversion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MovimientoAhorro" ADD CONSTRAINT "MovimientoAhorro_ahorroId_fkey" FOREIGN KEY ("ahorroId") REFERENCES "public"."Ahorro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asociacion" ADD CONSTRAINT "Asociacion_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asociacion" ADD CONSTRAINT "Asociacion_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AsociacionPermiso" ADD CONSTRAINT "AsociacionPermiso_asociacionId_fkey" FOREIGN KEY ("asociacionId") REFERENCES "public"."Asociacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AsociacionOculto" ADD CONSTRAINT "AsociacionOculto_asociacionId_fkey" FOREIGN KEY ("asociacionId") REFERENCES "public"."Asociacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MovimientoCompartido" ADD CONSTRAINT "MovimientoCompartido_asociacionId_fkey" FOREIGN KEY ("asociacionId") REFERENCES "public"."Asociacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MovimientoCompartido" ADD CONSTRAINT "MovimientoCompartido_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Debt" ADD CONSTRAINT "Debt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DebtPayment" ADD CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "public"."Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DebtPayment" ADD CONSTRAINT "DebtPayment_ahorroId_fkey" FOREIGN KEY ("ahorroId") REFERENCES "public"."Ahorro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
