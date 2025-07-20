-- Performance optimization indexes
-- Based on ARA System Design specifications

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_sessions_user_status 
ON audit_sessions(userId, status) 
WHERE userId IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_sessions_anonymous_active 
ON audit_sessions(anonymousId, updatedAt) 
WHERE status IN ('DRAFT', 'SUBMITTED');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_session_recent 
ON chat_messages(auditSessionId, createdAt DESC) 
WHERE createdAt > NOW() - INTERVAL '30 days';

-- Partial indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pdf_jobs_pending 
ON pdf_jobs(createdAt) 
WHERE status = 'PENDING';

-- Additional composite indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_answers_session_step 
ON audit_answers(auditSessionId, stepId);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_role_timestamp 
ON chat_messages(role, createdAt DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scoring_configs_active_version 
ON scoring_configs(isActive, version) 
WHERE isActive = true;