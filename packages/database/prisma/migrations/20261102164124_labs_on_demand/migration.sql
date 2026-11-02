-- CreateEnum
CREATE TYPE "LabEventType" AS ENUM ('START', 'STOP', 'SWITCH', 'EXTEND', 'EXPIRE_IDLE', 'EXPIRE_MAX', 'ADMIN_STOP', 'STOP_ALL', 'RUNNER_ERROR');

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "extraLabs" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "LabLease" (
    "userId" TEXT NOT NULL,
    "labSlug" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maxUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabLease_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "LabEvent" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "labSlug" TEXT NOT NULL,
    "userId" TEXT,
    "type" "LabEventType" NOT NULL,
    "detail" JSONB,

    CONSTRAINT "LabEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabLease_labSlug_idx" ON "LabLease"("labSlug");

-- CreateIndex
CREATE INDEX "LabEvent_at_idx" ON "LabEvent"("at");

-- CreateIndex
CREATE INDEX "LabEvent_labSlug_at_idx" ON "LabEvent"("labSlug", "at");
