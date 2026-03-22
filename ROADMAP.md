# 🤖 AI Code Review Bot — Daily Roadmap

## Tổng quan
- **Thời gian:** 21 ngày (1-2 giờ/ngày)
- **Stack:** NestJS + TypeScript + PostgreSQL + Redis + BullMQ + LLM
- **Chi phí:** $0 (local dev)

---

## Phase 1: Foundation (Day 1-4) — NestJS + TypeScript + PostgreSQL

### Day 1: Project Setup + TypeScript Basics
- [ ] Install: `npm i -g @nestjs/cli && nest new ai-code-review-bot`
- [ ] Hoặc dùng skeleton có sẵn, install deps
- [ ] Run `npm run start:dev`, test `GET /health`
- [ ] Đọc hiểu: `main.ts`, `app.module.ts`, `health.controller.ts`
- [ ] **Viết test:** `health.controller.spec.ts`
- **Học:** NestJS modules/controllers/providers, TypeScript basics, decorators

### Day 2: Docker + Database Setup
- [ ] Install Docker Desktop (nếu chưa có)
- [ ] Run `docker-compose up -d` (PostgreSQL + Redis)
- [ ] `npm install prisma @prisma/client`
- [ ] `npx prisma migrate dev --name init`
- [ ] `npx prisma studio` → xem DB trong browser
- [ ] Implement `PrismaService` (connect/disconnect)
- [ ] Update HealthController: check DB connection
- **Học:** Docker Compose, Prisma ORM, database migrations

### Day 3: Database Models + CRUD
- [ ] Đọc hiểu `prisma/schema.prisma` (models, relations, enums)
- [ ] Tạo Repository module (hoặc dùng Prisma trực tiếp)
- [ ] Implement CRUD cho Repository model
- [ ] Implement CRUD cho Review model
- [ ] **Viết test:** test create/read/update/delete
- **Học:** Prisma Client API, relations, transactions

### Day 4: Testing Foundation
- [ ] Setup Jest config cho NestJS
- [ ] Viết unit tests cho HealthController
- [ ] Viết unit tests cho Database CRUD
- [ ] Viết first integration test (HTTP request → DB)
- [ ] Chạy `npm run test:cov` → xem coverage report
- **Học:** Jest, mocking, NestJS testing utilities, TDD mindset

---

## Phase 2: GitHub Integration (Day 5-8) — Webhooks + API

### Day 5: Webhook Receiver
- [ ] Implement `WebhookController.handleGithubWebhook()`
- [ ] Implement `WebhookService.verifySignature()` (HMAC SHA-256)
- [ ] Parse event type, filter PR events only
- [ ] **Test:** gửi fake webhook payload, verify handling
- **Học:** Webhooks, HMAC security, NestJS Guards

### Day 6: Webhook Testing + ngrok
- [ ] Install ngrok: `npm install -g ngrok`
- [ ] Tạo GitHub App (Settings → Developer Settings → GitHub Apps)
- [ ] Set webhook URL → ngrok URL
- [ ] Test real webhook: tạo PR trên test repo → xem log
- [ ] Viết integration tests cho webhook flow
- **Học:** GitHub Apps, ngrok tunneling, real webhook testing

### Day 7: GitHub API - Read PR Data
- [ ] `npm install @octokit/rest @octokit/auth-app`
- [ ] Implement GitHub App authentication (JWT → installation token)
- [ ] `getPullRequestDiff()` — fetch diff
- [ ] `getPullRequestFiles()` — list changed files
- [ ] **Test:** mock Octokit, verify API calls
- **Học:** GitHub REST API, App authentication, Octokit

### Day 8: GitHub API - Post Comments
- [ ] `createReviewComment()` — inline comment on file/line
- [ ] `submitReview()` — APPROVE / REQUEST_CHANGES / COMMENT
- [ ] Test on real PR: bot posts a test comment
- [ ] Viết tests cho all GitHub methods
- **Học:** GitHub Review API, markdown formatting

---

## Phase 3: AI Review Engine (Day 9-13) — LLM + Queue

### Day 9: Diff Parser
- [ ] Implement `DiffParserService.parseDiff()` — parse unified diff
- [ ] Handle: file boundaries, hunk headers, added/removed lines
- [ ] Implement `shouldReview()` — filter lockfiles, images, etc.
- [ ] Implement `detectLanguage()` — file extension → language
- [ ] **Test:** parse sample diffs, verify output structure
- **Học:** Unified diff format, regex parsing, chunking strategies

### Day 10: Prompt Engineering
- [ ] Craft `buildSystemPrompt()` — reviewer persona
- [ ] Craft `buildReviewPrompt()` — diff + instructions
- [ ] Define JSON output schema cho ReviewResult
- [ ] Implement `parseResponse()` — handle malformed JSON
- [ ] **Test:** various LLM outputs (valid, partial, garbage)
- **Học:** Prompt engineering, structured output, JSON schema

### Day 11: LLM Integration
- [ ] Implement Gemini provider (free tier)
- [ ] Implement Ollama provider (local, free)
- [ ] `reviewChunk()` — single file review
- [ ] `reviewAllChunks()` — parallel review + merge results
- [ ] Handle: rate limits, timeouts, retries
- [ ] **Test:** mock LLM, test retry logic
- **Học:** Provider pattern, streaming, error handling, retry

### Day 12: Queue System (BullMQ)
- [ ] `npm install @nestjs/bullmq bullmq`
- [ ] Configure BullMQ with Redis
- [ ] Create `ReviewProcessor` (job consumer)
- [ ] WebhookService → add job to queue
- [ ] Implement retry (3x, exponential backoff)
- [ ] **Test:** enqueue job → verify processing
- **Học:** Message queue, BullMQ, job lifecycle, concurrency

### Day 13: Review Orchestrator (Wire Everything Together!)
- [ ] Implement `ReviewService.reviewPullRequest()` — full flow
- [ ] Wire: webhook → queue → github → diffParser → llm → github
- [ ] Implement idempotency (same PR + commit = skip)
- [ ] Save review + comments to database
- [ ] **End-to-end test:** create PR → bot reviews → comments appear
- **Học:** Orchestrator pattern, error handling, idempotency

---

## Phase 4: RAG + Polish (Day 14-18)

### Day 14: pgvector Setup
- [ ] Enable pgvector extension in PostgreSQL
- [ ] Add embedding column to KnowledgeChunk model
- [ ] Implement embedding generation (Gemini/OpenAI embedding API)
- [ ] Implement vector similarity search
- **Học:** Vector databases, embeddings, cosine similarity

### Day 15: RAG - Knowledge Base
- [ ] Import coding conventions (ESLint rules, project README)
- [ ] Import past review comments as knowledge
- [ ] Retrieve relevant knowledge before LLM call
- [ ] Enhance review prompt with RAG context
- [ ] **Test:** review quality with vs without RAG
- **Học:** RAG pattern, chunking, retrieval strategies

### Day 16: Dashboard API
- [ ] `GET /api/reviews` — list reviews with pagination
- [ ] `GET /api/reviews/:id` — review detail with comments
- [ ] `GET /api/stats` — total reviews, issues found, top categories
- [ ] **Test:** API endpoints
- **Học:** REST API design, pagination, aggregation queries

### Day 17: Error Handling + Logging
- [ ] Global exception filter (NestJS)
- [ ] Structured logging (winston or pino)
- [ ] Request ID tracking
- [ ] Health check: DB + Redis + LLM connectivity
- **Học:** Production error handling, observability

### Day 18: CI/CD
- [ ] Create `.github/workflows/ci.yml`
- [ ] Run tests on every push
- [ ] Build Docker image
- [ ] Lint + type check
- **Học:** GitHub Actions, CI pipeline, Docker build

---

## Phase 5: Deploy + Demo (Day 19-21)

### Day 19: Dockerize App
- [ ] Create `Dockerfile` (multi-stage build)
- [ ] Update `docker-compose.yml` with app service
- [ ] Test full stack in Docker
- **Học:** Multi-stage Docker builds, production optimization

### Day 20: Deploy
- [ ] Deploy to Railway / Render / Fly.io (free tier)
- [ ] Set environment variables
- [ ] Update GitHub App webhook URL
- [ ] Test on real repository
- **Học:** Cloud deployment, environment management

### Day 21: Documentation + Portfolio
- [ ] Write README.md (project overview, setup, architecture)
- [ ] Create architecture diagram
- [ ] Record demo video or screenshots
- [ ] Push to GitHub (public repo)
- [ ] Update CV with this project!
- **Học:** Technical writing, project presentation

---

## 🎯 Completion Checklist

By the end, you should have:
- [ ] A working bot that auto-reviews GitHub PRs
- [ ] TypeScript + NestJS proficiency
- [ ] PostgreSQL + Prisma experience
- [ ] Docker + Docker Compose skills
- [ ] LLM integration (Gemini/Ollama)
- [ ] Queue system (BullMQ + Redis)
- [ ] RAG with vector search
- [ ] CI/CD pipeline
- [ ] Test coverage > 70%
- [ ] A deployable Docker image
- [ ] A public GitHub repo for portfolio

---

## 📁 Project Structure

```
ai-code-review-bot/
├── prisma/
│   └── schema.prisma          # Database models
├── src/
│   ├── main.ts                # Entry point
│   ├── app.module.ts          # Root module
│   ├── database/
│   │   ├── database.module.ts
│   │   └── prisma.service.ts  # Day 2
│   ├── health/
│   │   └── health.controller.ts  # Day 1
│   ├── webhook/
│   │   ├── webhook.controller.ts # Day 5
│   │   └── webhook.service.ts    # Day 5-6
│   ├── github/
│   │   └── github.service.ts     # Day 7-8
│   ├── llm/
│   │   ├── diff-parser.service.ts  # Day 9
│   │   ├── prompt.service.ts       # Day 10
│   │   └── llm.service.ts          # Day 11
│   ├── queue/
│   │   └── queue.module.ts         # Day 12
│   └── review/
│       └── review.service.ts       # Day 13
├── test/                      # E2E tests
├── docker-compose.yml         # PostgreSQL + Redis
├── Dockerfile                 # Day 19
├── .env.example
├── ROADMAP.md                 # This file!
└── package.json
```
