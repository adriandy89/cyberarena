-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "altHashes" TEXT[] DEFAULT ARRAY[]::TEXT[];
