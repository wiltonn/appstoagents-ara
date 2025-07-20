# Technical Requirements Document (TRD)

## Product: Agent Readiness Audit – Wizard‑first with Embedded Mini‑Chat

### Version: 1.0

### Owner: Engineering @ AppstoAgents

### Last Updated: July 20, 2025

---

## 1 Purpose

Translate the PRD into concrete technical specifications for building, deploying, and operating the Agent Readiness Audit (ARA) application, covering **logged‑in and guest (non‑logged‑in)** user experiences managed by **Clerk**.

---

## 2 Scope

* Front‑end wizard + chat UI built in Astro/React.
* API layer, scoring engine, chat orchestration, PDF generator.
* Authentication/authorisation via Clerk.
* Data persistence in Postgres + pgvector.
* DevOps (CI/CD, IaC, monitoring, observability).
* Excludes marketing site, conversational‑only mode, CRM integration (future).

---

## 3 High‑Level Architecture

```mermaid
graph TD
  subgraph Client (Browser)
    A1[Wizard UI] -- REST/tRPC --> B[Edge API]
    A2[Mini‑Chat Drawer] -- WebSocket/HTTP --> C[Chat Svc]
  end
  subgraph Edge Platform (Vercel)
    B[Edge API] --> D[Scoring Svc]
    B --> E[PDF Svc]
    C --> F(OpenAI GPT‑4o-mini)
  end
  subgraph Data
    G[(Postgres + pgvector)]
    H[(S3/Cloudflare R2 – Reports)]
  end
  B -. Clerk JWT .-> I[Clerk Auth]
  C -. Clerk JWT .-> I
  D --> G
  C --> G
  E --> H
```

---

## 4 Authentication & Session Management (Clerk)

### 4.1 Guest vs Logged‑In Flow

| Stage               | Guest (Anonymous)                                                                               | Logged‑In                                          |
| ------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Start wizard**    | Session ID stored in `localStorage` under key `ara_anonymous_id`                                | JWT issued by Clerk; user id available client‑side |
| **Persist answers** | POST `/api/answers` with `anonymous_id` header                                                  | POST with `Authorization: Bearer <Clerk JWT>`      |
| **Invoke chat**     | Chat allowed; identity = "guest"                                                                | Chat allowed; identity = Clerk user id             |
| **Completion**      | "Generate Report" triggers Clerk sign‑up modal (magic link or OAuth) **before** scoring & email | Scoring & email happen immediately                 |
| **Linkage**         | On successful sign‑up, merge `anonymous_id` session rows to new `user_id`                       | N/A                                                |

### 4.2 Security Controls

* All API routes behind `withAuth()` Clerk middleware.
* Edge rate limiter (`upstash/redis`) keyed by Clerk user id or anonymous id.
* JWT expiry = 60 min; refresh via silent token renewal.

---

## 5 Front‑End Requirements

### 5.1 Tech Stack

* **Astro v4** with islands for Wizard & Chat (React 18).
* **Tailwind CSS** with DaisyUI plugin.
* **TanStack Query** for data fetching / optimistic updates.
* **Zustand** global store for wizard state (fallback to `localStorage`).
* Accessibility: WCAG 2.2 AA; keyboard navigation; aria‑live in chat.

### 5.2 Wizard Component

| Ref     | Requirement                                                     |
| ------- | --------------------------------------------------------------- |
| FE‑W‑01 | Progress bar shows step X/total + % complete                    |
| FE‑W‑02 | Max 8 steps; each ≤ 2 inputs; validation inline                 |
| FE‑W‑03 | Auto‑save after every field; debounce 300 ms                    |
| FE‑W‑04 | “Need help?” button opens Chat Drawer, passing `stepId` context |
| FE‑W‑05 | On mobile, steps render in full‑height swiper panels            |

### 5.3 Chat Drawer Component

| Ref     | Requirement                                                                         |
| ------- | ----------------------------------------------------------------------------------- |
| FE‑C‑01 | Opens as right‑side drawer (desktop) or bottom‑sheet (mobile)                       |
| FE‑C‑02 | Initial system prompt contextualised with current step, user role (guest vs logged) |
| FE‑C‑03 | Three canned prompts rendered as chips                                              |
| FE‑C‑04 | Displays “Suggested autofill → Accept?” when LLM returns structured field data      |
| FE‑C‑05 | WebSocket connection backs live streaming tokens                                    |

---

## 6 API / Back‑End Requirements

### 6.1 tRPC Router (Node 20 Edge runtime)

| Procedure     | Purpose                                                 | Auth               |
| ------------- | ------------------------------------------------------- | ------------------ |
| `saveAnswer`  | Upsert wizard field                                     | Optional (guest)   |
| `getProgress` | Fetch saved answers & score so far                      | Optional           |
| `finalSubmit` | Validate all answers, call Scoring Svc, enqueue PDF job | **Requires login** |
| `chatMessage` | Send/receive message stream                             | Optional           |
| `getReport`   | Signed URL to PDF                                       | Auth = owner only  |

### 6.2 Scoring Service

* Pure function receives JSON answers → returns per‑pillar + total score.
* Weight config in `/config/ara‑weights.json`; hot‑reload via Vercel KV.
* Complexity O(n) with n = fields.

### 6.3 Chat Service

* Serverless function with `@ai‑sdk/openai` streaming.
* System prompt restricts functions: `ask_clarifying_question`, `persist_answer`.
* All user content ≤ 2 k tokens; truncate history with token‑aware summariser.

### 6.4 PDF Service

* Queue job in **Vercel Cron + Blob**; worker uses **Puppeteer** to render HTML template -> PDF.
* Store in Cloudflare R2; Object key `reports/<auditSessionId>.pdf`.
* Pre‑signed URL valid 7 days.

---

## 7 Data Model (Postgres, managed by Prisma)

```prisma
model User {
  id           String   @id @default(uuid())
  clerkId      String   @unique
  email        String?
  createdAt    DateTime @default(now())
  auditSessions AuditSession[]
}

model AuditSession {
  id           String   @id @default(uuid())
  userId       String?  // null until guest converts
  anonymousId  String?  @unique
  status       AuditStatus @default(DRAFT)
  score        Decimal? // overall
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  answers      AuditAnswer[]
  chatMessages ChatMessage[]
}

enum AuditStatus { DRAFT SUBMITTED SCORED REPORT_READY }

model AuditAnswer {
  id           String   @id @default(uuid())
  auditSessionId String
  questionKey  String
  value        Json
  updatedAt    DateTime @updatedAt
}

model ChatMessage {
  id           String   @id @default(uuid())
  auditSessionId String
  role          String  // user | assistant | system
  content       Text
  tokens        Int
  createdAt     DateTime @default(now())
  vector        Vector? @db.Vector(1536) // via pgvector
}
```

---

## 8 DevOps & Environment

| Area                | Tooling                                                                         |
| ------------------- | ------------------------------------------------------------------------------- |
| **CI/CD**           | GitHub Actions → Vercel preview/production deployments                          |
| **IaC**             | Terraform: Vercel project, Cloudflare DNS, R2 bucket; Clerk config via Provider |
| **Env secrets**     | `.env` (git‑ignored) + Vercel Environments (preview/prod)                       |
| **Branch strategy** | trunk‑based w/ PR checks: lint, type‑check, unit tests                          |

---

## 9 Observability & Monitoring

* **OpenTelemetry** tracing via `@vercel/otel`.
* Structured logs to Vercel Log Drains (Datadog).
* **PostHog** events: step\_completed, chat\_invoked, report\_generated.
* Alerts: p95 latency > 2 s, error rate > 1 %, PDF queue backlog > 10 jobs.

---

## 10 Performance & Scalability Targets

| Metric                       | Target                |
| ---------------------------- | --------------------- |
| API p95 latency (Edge)       | < 250 ms              |
| Chat token stream first byte | < 1 s                 |
| Concurrency                  | 1 000 active sessions |
| PDF throughput               | ≥ 30 reports/min      |

---

## 11 Security & Compliance

* Encrypt all PII at rest (`pgcrypto`).
* SOC 2 Type II controls mapped to system; audit logs retained 1 year.
* Use **OWASP ASVS v4** L1 checklist for code reviews.
* Regular dependency scans via Snyk.

---

## 12 Testing Strategy

| Layer     | Tooling                  | Coverage                       |
| --------- | ------------------------ | ------------------------------ |
| Unit      | Vitest                   | ≥ 80 % critical paths          |
| Component | Playwright CT            | Wizard & Chat states           |
| API       | Supertest (tRPC client)  | All routes                     |
| E2E       | Playwright               | Guest → sign‑up → PDF download |
| Load      | K6 on `/api/finalSubmit` | 1 k RPS for 5 min              |

---

## 13 Deployment Plan

1. **Preview env** auto‑deploys on PR.
2. **Staging env** (vercel prod branch) behind password proxy.
3. Smoke tests run post‑deploy; if pass, promote DNS alias `app.appstoagents.com`.

---

## 14 Rollback & Migration

* Blue/green toggles via Vercel immutable deployments (10 min cut‑over).
* DB migrations via Prisma Migrate with `--create-only` + manual approval.
* Feature flags via **LaunchDarkly** for chat auto‑fill.

---

## 15 Risks & Mitigations

| Risk               | Likelihood | Impact           | Mitigation                                   |
| ------------------ | ---------- | ---------------- | -------------------------------------------- |
| Clerk outage       | Low        | Auth failure     | Offline mode allows read‑only guest progress |
| OpenAI rate limits | Medium     | Chat unavailable | Retry w/ back‑off, cache fallback FAQ        |
| PDF job spikes     | Medium     | SLA breach       | Autoscale workers, queue depth alert         |

---

## 16 Glossary

| Term                | Definition                                                    |
| ------------------- | ------------------------------------------------------------- |
| **ARA**             | Agent Readiness Audit                                         |
| **Guest/Anonymous** | User without Clerk account yet                                |
| **Mini‑Chat**       | Embedded LLM‑powered helper contextual to current wizard step |
| **Edge API**        | Serverless functions deployed geographically close to user    |

---

## 17 Out of Scope (TRD)

* CRM push (HubSpot)
* Enterprise SSO (Okta, Azure AD)
* Multi‑tenant self‑hosted offering
