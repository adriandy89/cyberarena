-- CreateTable
CREATE TABLE "CatalogPath" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CatalogPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogModule" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "catalogPathId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CatalogModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "catalogModuleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "tags" TEXT[],
    "lab" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "hint" TEXT,
    "kind" TEXT NOT NULL,
    "options" JSONB,
    "index" INTEGER NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "questionId" TEXT NOT NULL,
    "answerHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("questionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogPath_slug_key" ON "CatalogPath"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogModule_slug_key" ON "CatalogModule"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Room_slug_key" ON "Room"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Task_roomId_index_key" ON "Task"("roomId", "index");

-- AddForeignKey
ALTER TABLE "CatalogModule" ADD CONSTRAINT "CatalogModule_catalogPathId_fkey" FOREIGN KEY ("catalogPathId") REFERENCES "CatalogPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_catalogModuleId_fkey" FOREIGN KEY ("catalogModuleId") REFERENCES "CatalogModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
