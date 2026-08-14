/*
  Warnings:

  - You are about to drop the column `orderCode` on the `Order` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Order_orderCode_key";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "orderCode";
