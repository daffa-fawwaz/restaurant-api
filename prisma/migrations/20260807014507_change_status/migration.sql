/*
  Warnings:

  - You are about to drop the column `status` on the `Table` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[number]` on the table `Table` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Table" DROP COLUMN "status",
ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT false;

-- DropEnum
DROP TYPE "Status";

-- CreateIndex
CREATE UNIQUE INDEX "Table_number_key" ON "Table"("number");
