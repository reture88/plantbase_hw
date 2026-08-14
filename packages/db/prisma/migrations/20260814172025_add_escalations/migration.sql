-- DropIndex
DROP INDEX "knowledge_chunks_embedding_hnsw_idx";

-- CreateTable
CREATE TABLE "escalations" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "contextSnapshot" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);
