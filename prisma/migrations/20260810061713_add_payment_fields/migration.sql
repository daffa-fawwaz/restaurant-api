-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "amountReceived" DECIMAL(10,2),
ADD COLUMN     "changeAmount" DECIMAL(10,2),
ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3);
