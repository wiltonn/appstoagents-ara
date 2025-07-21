# ADR-002: Database Schema Design

## Status
Accepted

## Context
The ARA System requires a flexible, scalable database schema that can handle:
- Both guest and authenticated user sessions
- Dynamic wizard responses with varying data types
- Real-time scoring calculations
- Chat messages with vector embeddings for semantic search
- PDF generation job tracking
- Hot-reloadable scoring configurations

The schema must support:
- Efficient querying for real-time operations
- Data integrity across user flows
- Flexible JSON storage for varying question types
- Vector similarity search for chat functionality
- Audit trails and analytics capabilities

## Decision
We have designed a PostgreSQL schema with the following core entities:

### Core Tables

#### Users
```sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY,           -- Clerk user ID
  email VARCHAR UNIQUE NOT NULL,
  first_name VARCHAR,
  last_name VARCHAR,
  image_url VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### AuditSessions
```sql
CREATE TABLE audit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id),    -- NULL for guest sessions
  is_guest BOOLEAN NOT NULL DEFAULT true,
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 8,
  responses JSONB DEFAULT '{}',             -- Flexible response storage
  score DECIMAL(5,2),                       -- Calculated score (0-100)
  status VARCHAR(20) DEFAULT 'DRAFT',       -- DRAFT, SUBMITTED, COMPLETED
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_audit_sessions_user_id (user_id),
  INDEX idx_audit_sessions_is_guest (is_guest),
  INDEX idx_audit_sessions_status (status),
  INDEX idx_audit_sessions_created_at (created_at)
);
```

#### AuditAnswers
```sql
CREATE TABLE audit_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_session_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  question_key VARCHAR(100) NOT NULL,
  step_id VARCHAR(50) NOT NULL,
  value JSONB NOT NULL,                     -- Flexible value storage
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint for session + question
  UNIQUE CONSTRAINT unique_session_question (audit_session_id, question_key),
  
  -- Indexes for performance
  INDEX idx_audit_answers_session_id (audit_session_id),
  INDEX idx_audit_answers_question_key (question_key),
  INDEX idx_audit_answers_step_id (step_id)
);
```

#### ChatMessages
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL,        -- Links to audit session
  message TEXT NOT NULL,
  response TEXT,
  tokens INTEGER DEFAULT 0,
  embedding VECTOR(1536),                  -- OpenAI embedding dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for performance and vector search
  INDEX idx_chat_messages_session_id (session_id),
  INDEX idx_chat_messages_created_at (created_at),
  INDEX idx_chat_messages_embedding USING ivfflat (embedding vector_cosine_ops)
);
```

#### ReportGenerations
```sql
CREATE TABLE report_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES audit_sessions(id),
  format VARCHAR(20) DEFAULT 'pdf',
  status VARCHAR(20) DEFAULT 'pending',     -- pending, processing, completed, failed
  file_url VARCHAR,
  file_size INTEGER,
  page_count INTEGER,
  customizations JSONB DEFAULT '{}',
  error_message TEXT,
  generated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_report_generations_session_id (session_id),
  INDEX idx_report_generations_status (status)
);
```

#### ScoringConfigs
```sql
CREATE TABLE scoring_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL,
  config JSONB NOT NULL,                    -- Flexible scoring configuration
  is_active BOOLEAN DEFAULT false,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE CONSTRAINT unique_config_version (name, version),
  INDEX idx_scoring_configs_active (is_active),
  INDEX idx_scoring_configs_name (name)
);
```

## Rationale

### JSONB for Flexible Data Storage
- **Flexibility**: Wizard responses vary significantly in structure (strings, numbers, arrays, objects)
- **Performance**: JSONB provides efficient querying with GIN indexes
- **Schema Evolution**: Can add new question types without schema migrations
- **Type Preservation**: Maintains data types better than TEXT serialization

### UUID Primary Keys
- **Uniqueness**: Globally unique identifiers prevent conflicts
- **Security**: Non-sequential IDs provide security through obscurity
- **Distribution**: Better for distributed systems and replication
- **External Integration**: Safe to expose in APIs

### Separate Answers Table
- **Normalization**: Reduces data duplication and ensures consistency
- **Auditability**: Each answer change creates a new record
- **Querying**: Efficient queries for specific questions across sessions
- **Analytics**: Better support for question-level analytics

### Vector Embeddings for Chat
- **Semantic Search**: Enable finding similar conversations and responses
- **Context Retrieval**: Improve AI responses with relevant historical context
- **Performance**: pgvector provides efficient vector similarity search
- **Scalability**: Indexes support large-scale vector operations

### Guest Session Strategy
- **User Experience**: Allow full functionality without registration
- **Data Migration**: Guest data can be converted to user accounts
- **Privacy**: Guest sessions can be cleaned up automatically
- **Flexibility**: Supports both anonymous and authenticated workflows

## Alternatives Considered

### Schema Design Alternatives

1. **Single Table with JSONB**
   - Pros: Simpler structure, fewer joins
   - Cons: Poor normalization, difficult analytics, no referential integrity

2. **Strict Relational Schema**
   - Pros: Strong typing, referential integrity
   - Cons: Difficult to evolve, rigid question structure

3. **Document Database (MongoDB)**
   - Pros: Natural JSON storage, flexible schema
   - Cons: Weaker consistency guarantees, no vector support

4. **Graph Database (Neo4j)**
   - Pros: Natural relationship modeling
   - Cons: Overkill for our use case, additional complexity

### Vector Storage Alternatives

1. **Separate Vector Database (Pinecone/Weaviate)**
   - Pros: Specialized vector operations
   - Cons: Additional infrastructure, data synchronization issues

2. **Elasticsearch with Vector Support**
   - Pros: Good search capabilities
   - Cons: Additional infrastructure, less SQL integration

3. **In-Memory Vector Search**
   - Pros: Fast searching
   - Cons: Limited scalability, data persistence issues

## Consequences

### Positive Consequences
- **Flexibility**: Schema supports current requirements and future evolution
- **Performance**: Proper indexing ensures efficient queries
- **Data Integrity**: Foreign keys and constraints maintain consistency
- **Scalability**: Design supports horizontal scaling and partitioning
- **Analytics**: Schema enables comprehensive analytics and reporting
- **Guest Experience**: Seamless guest-to-user conversion workflow

### Negative Consequences
- **Complexity**: JSONB queries require PostgreSQL-specific knowledge
- **Storage Overhead**: Vector embeddings require significant storage space
- **Migration Complexity**: Schema changes in production require careful planning
- **Query Optimization**: Complex JSONB queries may require query tuning

### Performance Considerations
- **Indexing Strategy**: Comprehensive indexing for common query patterns
- **JSONB Optimization**: GIN indexes for efficient JSONB queries
- **Vector Search**: IVFFlat indexes for efficient similarity search
- **Partitioning**: Future partitioning strategy for large datasets

### Security Measures
- **Data Encryption**: Sensitive data encrypted at rest
- **Access Control**: Row-level security for multi-tenant data
- **Audit Logging**: Change tracking for compliance requirements
- **Data Retention**: Automated cleanup of guest sessions and old data

## Related Decisions
- [ADR-001: Technology Stack Selection](001-technology-stack-selection.md)
- [ADR-003: Authentication Strategy](003-authentication-strategy.md)
- [ADR-004: AI Integration Approach](004-ai-integration-approach.md)

## References
- [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html)
- [pgvector Extension](https://github.com/pgvector/pgvector)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [PostgreSQL Indexing Strategies](https://www.postgresql.org/docs/current/indexes.html)