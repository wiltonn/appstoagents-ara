-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'SCORED', 'REPORT_READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'FUNCTION');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousId" TEXT,
    "status" "AuditStatus" NOT NULL DEFAULT 'DRAFT',
    "score" DECIMAL(5,2),
    "scoringData" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pdfJobId" TEXT,
    "pdfUrl" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),

    CONSTRAINT "audit_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_answers" (
    "id" TEXT NOT NULL,
    "auditSessionId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "auditSessionId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_jobs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "JobPriority" NOT NULL DEFAULT 'NORMAL',
    "templateData" JSONB NOT NULL,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "r2Key" TEXT,
    "signedUrl" TEXT,
    "urlExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "pdf_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_configs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "version" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "scoring_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");

-- CreateIndex
CREATE INDEX "users_clerkId_idx" ON "users"("clerkId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "audit_sessions_userId_idx" ON "audit_sessions"("userId");

-- CreateIndex
CREATE INDEX "audit_sessions_anonymousId_idx" ON "audit_sessions"("anonymousId");

-- CreateIndex
CREATE INDEX "audit_sessions_status_idx" ON "audit_sessions"("status");

-- CreateIndex
CREATE INDEX "audit_sessions_startedAt_idx" ON "audit_sessions"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "unique_anonymous_session" ON "audit_sessions"("anonymousId");

-- CreateIndex
CREATE INDEX "audit_answers_auditSessionId_idx" ON "audit_answers"("auditSessionId");

-- CreateIndex
CREATE INDEX "audit_answers_questionKey_idx" ON "audit_answers"("questionKey");

-- CreateIndex
CREATE INDEX "audit_answers_stepId_idx" ON "audit_answers"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_session_question" ON "audit_answers"("auditSessionId", "questionKey");

-- CreateIndex
CREATE INDEX "chat_messages_auditSessionId_createdAt_idx" ON "chat_messages"("auditSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_role_idx" ON "chat_messages"("role");

-- CreateIndex
CREATE INDEX "chat_messages_createdAt_idx" ON "chat_messages"("createdAt");

-- CreateIndex for vector embeddings using ivfflat
CREATE INDEX "chat_messages_embedding_idx" ON "chat_messages" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- CreateIndex
CREATE INDEX "pdf_jobs_sessionId_idx" ON "pdf_jobs"("sessionId");

-- CreateIndex
CREATE INDEX "pdf_jobs_status_priority_idx" ON "pdf_jobs"("status", "priority");

-- CreateIndex
CREATE INDEX "pdf_jobs_createdAt_idx" ON "pdf_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "scoring_configs_isActive_idx" ON "scoring_configs"("isActive");

-- CreateIndex
CREATE INDEX "scoring_configs_version_idx" ON "scoring_configs"("version");

-- AddForeignKey
ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_answers" ADD CONSTRAINT "audit_answers_auditSessionId_fkey" FOREIGN KEY ("auditSessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_auditSessionId_fkey" FOREIGN KEY ("auditSessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;