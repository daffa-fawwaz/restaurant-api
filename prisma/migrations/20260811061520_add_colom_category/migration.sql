-- CreateEnum
CREATE TYPE "Category" AS ENUM ('Main', 'Snack', 'Drink');

-- AlterTable
ALTER TABLE "Menu" ADD COLUMN     "category" "Category" NOT NULL DEFAULT 'Main';
