/*
  Warnings:

  - A unique constraint covering the columns `[midtransOrderId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `midtransOrderId` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "midtransOrderId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_midtransOrderId_key" ON "Payment"("midtransOrderId");
