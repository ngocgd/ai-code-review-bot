# Day 13: Wire Everything Together — Full Review Pipeline

## Mục tiêu

Kết nối tất cả modules thành pipeline hoàn chỉnh:

```
GitHub Webhook → Queue → Processor → GitHub API + Diff Parser + LLM → Post Review
```

Sau Day 13, khi ai đó mở PR → bot tự động review và comment trên GitHub. Không cần chạy script tay nữa.

---

## Kiến thức nền

### Dependency Injection xuyên Modules

Hiện tại các module đang tách rời:
- `GithubModule` export `GithubService`
- `LlmModule` export `LlmService`, `DiffParserService`
- `QueueModule` chứa `ReviewProcessor`

**Vấn đề:** `ReviewProcessor` cần gọi `GithubService`, `DiffParserService`, `LlmService` — nhưng chưa inject được vì chưa import modules tương ứng.

**Giải pháp:** Import `GithubModule` và `LlmModule` vào `QueueModule` → NestJS tự inject dependencies vào Processor.

### Flow chi tiết

```
1. GitHub gửi webhook (PR opened)
         ↓
2. WebhookController nhận, verify signature
         ↓
3. WebhookService.handlePullRequest()
   → Thêm job vào queue 'review-pr'
   → Trả 200 cho GitHub ngay (< 1s)
         ↓
4. ReviewProcessor.process(job) — chạy async
   │
   ├─ 4a. GithubService.getPullRequestDiff(owner, repo, prNumber)
   │       → Lấy raw unified diff từ GitHub API
   │
   ├─ 4b. DiffParserService.parseDiff(rawDiff)
   │       → Parse thành DiffChunk[] (file + hunks + lines)
   │
   ├─ 4c. LlmService.reviewAllChunks(chunks)
   │       → Gọi Claude CLI → parse JSON → ReviewResult
   │
   ├─ 4d. GithubService.submitReview(...)
   │       → Post review comment lên GitHub PR
   │
   └─ 4e. ReviewService.create(...)  [optional]
          → Lưu kết quả vào database
```

---

## Bắt tay làm

### Bước 1: Import modules vào QueueModule

Mở `src/queue/queue.module.ts`:

**Hiện tại:**
```typescript
@Module({
  imports: [
    BullModule.forRootAsync({ ... }),
    BullModule.registerQueue({ name: 'review-pr' }),
  ],
  providers: [ReviewProcessor],
  exports: [BullModule],
})
```

**Cần thêm:**
```typescript
import { GithubModule } from '../github/github.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [
    BullModule.forRootAsync({ ... }),    // giữ nguyên
    BullModule.registerQueue({ name: 'review-pr' }),
    GithubModule,    // ← thêm: để inject GithubService
    LlmModule,       // ← thêm: để inject LlmService + DiffParserService
  ],
  providers: [ReviewProcessor],
  exports: [BullModule],
})
```

**Tại sao?** NestJS DI chỉ inject được service từ module đã import. Không import → `Nest can't resolve dependencies`.

### Bước 2: Inject services vào ReviewProcessor

Đây là bước quan trọng nhất — biến processor từ "log placeholder" thành pipeline thật.

Mở `src/queue/review.processor.ts`, sửa lại:

```typescript
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GithubService } from '../github/github.service';
import { DiffParserService } from '../llm/diff-parser.service';
import { LlmService } from '../llm/llm.service';

export interface ReviewJobData {
  owner: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  headSha: string;
  baseBranch: string;
  headBranch: string;
  action: string;
  installationId?: number;
}

@Processor('review-pr')
export class ReviewProcessor extends WorkerHost {
  private readonly logger = new Logger(ReviewProcessor.name);

  constructor(
    private readonly githubService: GithubService,
    private readonly diffParser: DiffParserService,
    private readonly llmService: LlmService,
  ) {
    super();  // WorkerHost yêu cầu gọi super()
  }

  async process(job: Job<ReviewJobData>): Promise<any> {
    const { owner, repo, prNumber, prTitle, headSha } = job.data;
    this.logger.log(`🔍 Reviewing PR #${prNumber}: "${prTitle}"`);
    const startTime = Date.now();

    try {
      // ── Step 1: Fetch diff từ GitHub ──
      await job.updateProgress(10);
      this.logger.log('  📥 Fetching PR diff...');
      const rawDiff = await this.githubService.getPullRequestDiff(owner, repo, prNumber);
      this.logger.debug(`  Raw diff: ${rawDiff.length} chars`);

      // ── Step 2: Parse diff thành chunks ──
      await job.updateProgress(25);
      this.logger.log('  🔎 Parsing diff...');
      const chunks = this.diffParser.parseDiff(rawDiff);
      this.logger.log(`  Found ${chunks.length} reviewable file(s)`);

      if (chunks.length === 0) {
        this.logger.log('  ⏭️ No reviewable changes — skipping');
        await this.githubService.submitReview(
          owner, repo, prNumber, headSha,
          '✅ No reviewable code changes found in this PR.',
          'COMMENT',
        );
        return { status: 'skipped', reason: 'no reviewable changes' };
      }

      // ── Step 3: LLM review ──
      await job.updateProgress(40);
      this.logger.log('  🤖 Running LLM review...');
      const result = await this.llmService.reviewAllChunks(chunks);
      this.logger.log(`  Found ${result.issues.length} issue(s), severity: ${result.overallSeverity}`);

      // ── Step 4: Format review body ──
      await job.updateProgress(75);
      const reviewBody = this.formatReviewBody(result, chunks, Date.now() - startTime);

      // ── Step 5: Post review lên GitHub ──
      await job.updateProgress(90);
      this.logger.log('  📝 Posting review to GitHub...');

      // Map severity → GitHub review event
      const eventMap: Record<string, 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'> = {
        APPROVE: 'APPROVE',
        REQUEST_CHANGES: 'REQUEST_CHANGES',
        COMMENT: 'COMMENT',
      };

      await this.githubService.submitReview(
        owner,
        repo,
        prNumber,
        headSha,
        reviewBody,
        eventMap[result.overallSeverity] || 'COMMENT',
      );

      await job.updateProgress(100);
      const duration = Date.now() - startTime;
      this.logger.log(`  ✅ Review posted in ${(duration / 1000).toFixed(1)}s`);

      return {
        status: 'completed',
        pr: `${owner}/${repo}#${prNumber}`,
        filesReviewed: chunks.length,
        issuesFound: result.issues.length,
        severity: result.overallSeverity,
        tokensUsed: result.tokensUsed,
        model: result.model,
        durationMs: duration,
      };
    } catch (error) {
      this.logger.error(`Failed to review PR #${prNumber}: ${(error as Error).message}`);
      throw error; // Re-throw để BullMQ retry
    }
  }

  /**
   * Format review result thành GitHub review body (Markdown)
   */
  private formatReviewBody(
    result: { summary: string; issues: any[]; overallSeverity: string },
    chunks: any[],
    durationMs: number,
  ): string {
    const severityEmoji: Record<string, string> = {
      APPROVE: '✅',
      COMMENT: '💬',
      REQUEST_CHANGES: '🔴',
    };
    const issueEmoji: Record<string, string> = {
      CRITICAL: '🔴',
      WARNING: '⚠️',
      INFO: 'ℹ️',
    };

    let body = `## ${severityEmoji[result.overallSeverity] || '🤖'} AI Code Review\n\n`;
    body += `**Summary:** ${result.summary}\n\n`;

    if (result.issues.length > 0) {
      body += `### Issues Found (${result.issues.length})\n\n`;

      for (const issue of result.issues) {
        const emoji = issueEmoji[issue.severity] || '📝';
        body += `#### ${emoji} [${issue.severity}] ${issue.title}\n`;
        if (issue.filePath) {
          body += `📁 \`${issue.filePath}${issue.line ? `:${issue.line}` : ''}\`\n`;
        }
        body += `${issue.description}\n`;
        if (issue.suggestion) {
          body += `\n💡 **Suggestion:** ${issue.suggestion}\n`;
        }
        body += '\n---\n\n';
      }
    } else {
      body += '✨ No issues found — code looks good!\n\n';
    }

    body += `<details><summary>📊 Review Stats</summary>\n\n`;
    body += `- Files reviewed: ${chunks.length}\n`;
    body += `- Issues found: ${result.issues.length}\n`;
    body += `- Duration: ${(durationMs / 1000).toFixed(1)}s\n`;
    body += `- Verdict: ${result.overallSeverity}\n`;
    body += `</details>\n`;

    return body;
  }

  // ── Lifecycle Events ──

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`⏳ Job ${job.id} started: PR #${job.data.prNumber}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: any) {
    this.logger.log(`✅ Job ${job.id} done: ${result.issuesFound ?? 0} issues in ${result.durationMs ?? 0}ms`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts?.attempts ?? 3}): ${error.message}`);
  }
}
```

**Điểm quan trọng cần hiểu:**

| Phần | Giải thích |
|------|-----------|
| `constructor` inject 3 services | NestJS tự tạo instance và truyền vào nhờ DI |
| `super()` | Bắt buộc khi extend class — gọi constructor của WorkerHost |
| `try/catch + throw error` | Catch để log, rồi re-throw để BullMQ biết job fail → retry |
| `formatReviewBody()` | Tạo Markdown đẹp cho GitHub review comment |
| `job.updateProgress()` | Cập nhật tiến độ — hữu ích khi monitor queue |

### Bước 3: Enable QueueModule trong AppModule

Mở `src/app.module.ts`, uncomment QueueModule (nếu chưa):

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    HealthModule,
    RepositoryModule,
    ReviewModule,
    WebhookModule,
    GithubModule,
    LlmModule,
    QueueModule,      // ← phải được uncomment
  ],
})
export class AppModule {}
```

### Bước 4: Test pipeline bằng script

Tạo `scripts/test-pipeline.ts` — simulate full flow không cần webhook:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';

async function main() {
  console.log('=== Starting app ===');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const queue = app.get<Queue>(getQueueToken('review-pr'));

  // Xem queue stats
  const counts = await queue.getJobCounts();
  console.log('Queue stats:', counts);

  // Thêm job test — dùng PR thật của bạn
  console.log('\n=== Adding review job ===');
  const job = await queue.add('review', {
    owner: 'ngocgd',
    repo: 'ai-code-review-bot',
    prNumber: 1,                    // ← đổi thành PR number thật
    prTitle: 'Test full pipeline',
    prAuthor: 'ngocgd',
    headSha: 'HEAD',                // ← sẽ cần SHA thật, xem note bên dưới
    baseBranch: 'main',
    headBranch: 'feature/test',
    action: 'opened',
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });

  console.log(`Job ${job.id} added. Waiting for completion...`);

  // Chờ job xong
  try {
    const result = await job.waitUntilFinished(queue.events, 120000); // timeout 2 min
    console.log('\n=== Review Result ===');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n❌ Job failed:', (error as Error).message);
    // Xem chi tiết job
    const failedJob = await queue.getJob(job.id!);
    console.log('Failed reason:', failedJob?.failedReason);
    console.log('Stack:', failedJob?.stacktrace?.[0]);
  }

  // Stats cuối
  const finalCounts = await queue.getJobCounts();
  console.log('\nFinal queue stats:', finalCounts);

  await app.close();
}

main().catch(console.error);
```

**Lưu ý về `headSha`:** GitHub API `submitReview` yêu cầu commit SHA chính xác. Có 2 cách:

**Cách A** — Lấy SHA từ `getPullRequestInfo` (thêm vào processor):
```typescript
// Trong process(), trước khi fetch diff:
const prInfo = await this.githubService.getPullRequestInfo(owner, repo, prNumber);
const commitSha = prInfo.headSha;  // SHA chính xác
```

**Cách B** — Truyền SHA từ webhook payload (đã có sẵn trong `job.data.headSha`).

→ **Recommend cách A** — vì khi PR có push mới giữa lúc job chờ trong queue, SHA từ webhook có thể outdated.

### Bước 5: Cập nhật Processor lấy SHA chính xác

Trong `process()`, thêm trước Step 1:

```typescript
// Lấy SHA mới nhất (PR có thể push thêm commits trong lúc job chờ queue)
const prInfo = await this.githubService.getPullRequestInfo(owner, repo, prNumber);
const commitSha = prInfo.headSha;
this.logger.debug(`  Using commit SHA: ${commitSha}`);
```

Rồi thay tất cả `headSha` thành `commitSha` trong submitReview.

### Bước 6: Chạy test

```bash
# 1. Chắc chắn Docker đang chạy (PostgreSQL + Redis)
docker compose up -d

# 2. Start app (để processor listen queue)
npm run start:dev

# 3. Ở terminal khác, chạy test script
npx ts-node -r tsconfig-paths/register scripts/test-pipeline.ts
```

**Kỳ vọng:**
```
=== Adding review job ===
Job 1 added. Waiting for completion...
[ReviewProcessor] ⏳ Job 1 started: PR #1
[ReviewProcessor] 🔍 Reviewing PR #1: "Test full pipeline"
[ReviewProcessor]   📥 Fetching PR diff...
[ReviewProcessor]   🔎 Parsing diff...
[ReviewProcessor]   Found 10 reviewable file(s)
[ReviewProcessor]   🤖 Running LLM review...
[ReviewProcessor]   Found 18 issue(s), severity: REQUEST_CHANGES
[ReviewProcessor]   📝 Posting review to GitHub...
[ReviewProcessor]   ✅ Review posted in 45.2s
[ReviewProcessor] ✅ Job 1 done: 18 issues in 45200ms

=== Review Result ===
{
  "status": "completed",
  "pr": "ngocgd/ai-code-review-bot#1",
  "filesReviewed": 10,
  "issuesFound": 18,
  "severity": "REQUEST_CHANGES",
  "durationMs": 45200
}
```

### Bước 7: Test với webhook thật

1. Start app + ngrok:
```bash
npm run start:dev
ngrok http 3015
```

2. Cập nhật GitHub App webhook URL → ngrok URL
3. Tạo PR mới hoặc push commit lên PR có sẵn
4. Xem log → bot tự review và post comment

---

## Viết Tests

### Test cho ReviewProcessor

Tạo/cập nhật `src/queue/review.processor.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ReviewProcessor, ReviewJobData } from './review.processor';
import { GithubService } from '../github/github.service';
import { DiffParserService } from '../llm/diff-parser.service';
import { LlmService } from '../llm/llm.service';
import { Job } from 'bullmq';

describe('ReviewProcessor', () => {
  let processor: ReviewProcessor;
  let githubService: jest.Mocked<GithubService>;
  let diffParser: jest.Mocked<DiffParserService>;
  let llmService: jest.Mocked<LlmService>;

  const mockGithubService = {
    getPullRequestInfo: jest.fn(),
    getPullRequestDiff: jest.fn(),
    submitReview: jest.fn(),
  };

  const mockDiffParser = {
    parseDiff: jest.fn(),
  };

  const mockLlmService = {
    reviewAllChunks: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewProcessor,
        { provide: GithubService, useValue: mockGithubService },
        { provide: DiffParserService, useValue: mockDiffParser },
        { provide: LlmService, useValue: mockLlmService },
      ],
    }).compile();

    processor = module.get(ReviewProcessor);
    githubService = module.get(GithubService);
    diffParser = module.get(DiffParserService);
    llmService = module.get(LlmService);

    jest.clearAllMocks();
  });

  const createMockJob = (data?: Partial<ReviewJobData>) => ({
    id: 'test-job-1',
    data: {
      owner: 'ngocgd',
      repo: 'test-repo',
      prNumber: 1,
      prTitle: 'Test PR',
      prAuthor: 'ngocgd',
      headSha: 'abc123',
      baseBranch: 'main',
      headBranch: 'feature/test',
      action: 'opened',
      ...data,
    },
    updateProgress: jest.fn(),
    opts: { attempts: 3 },
  } as unknown as Job<ReviewJobData>);

  it('should complete full review pipeline', async () => {
    // Arrange
    const mockDiff = 'diff --git a/file.ts b/file.ts\n...';
    const mockChunks = [{ filePath: 'file.ts', language: 'typescript', hunks: [{ addedLines: ['const x = 1;'] }] }];
    const mockResult = {
      summary: 'Looks good',
      issues: [],
      overallSeverity: 'APPROVE' as const,
      tokensUsed: 100,
      model: 'claude-sonnet-4-6',
    };

    mockGithubService.getPullRequestInfo.mockResolvedValue({ headSha: 'abc123' });
    mockGithubService.getPullRequestDiff.mockResolvedValue(mockDiff);
    mockDiffParser.parseDiff.mockReturnValue(mockChunks);
    mockLlmService.reviewAllChunks.mockResolvedValue(mockResult);
    mockGithubService.submitReview.mockResolvedValue(undefined);

    // Act
    const job = createMockJob();
    const result = await processor.process(job);

    // Assert
    expect(result.status).toBe('completed');
    expect(result.issuesFound).toBe(0);
    expect(result.severity).toBe('APPROVE');
    expect(mockGithubService.submitReview).toHaveBeenCalledWith(
      'ngocgd', 'test-repo', 1, 'abc123',
      expect.stringContaining('AI Code Review'),
      'APPROVE',
    );
  });

  it('should skip review when no reviewable changes', async () => {
    mockGithubService.getPullRequestInfo.mockResolvedValue({ headSha: 'abc123' });
    mockGithubService.getPullRequestDiff.mockResolvedValue('diff...');
    mockDiffParser.parseDiff.mockReturnValue([]); // no chunks

    const result = await processor.process(createMockJob());

    expect(result.status).toBe('skipped');
    expect(mockLlmService.reviewAllChunks).not.toHaveBeenCalled();
  });

  it('should throw on GitHub API failure (triggers retry)', async () => {
    mockGithubService.getPullRequestInfo.mockRejectedValue(new Error('API rate limited'));

    await expect(processor.process(createMockJob())).rejects.toThrow('API rate limited');
  });
});
```

Chạy test:
```bash
npm test -- --testPathPattern=review.processor
```

---

## Fix test cũ bị fail

Sau khi thêm DI vào processor, test cũ của webhook có thể fail. Check:

### `webhook.service.spec.ts`

Nếu fail vì thiếu queue:
```typescript
const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

// Trong providers:
{ provide: 'BullQueue_review-pr', useValue: mockQueue },
```

### `review.processor.spec.ts` cũ

Nếu có test cũ không có mock services → xóa và thay bằng file mới ở trên.

---

## Checklist hoàn thành Day 13

- [ ] Import `GithubModule` + `LlmModule` vào `QueueModule`
- [ ] Inject `GithubService`, `DiffParserService`, `LlmService` vào `ReviewProcessor`
- [ ] Implement `process()` — full pipeline: fetch diff → parse → LLM → post review
- [ ] Implement `formatReviewBody()` — Markdown đẹp cho GitHub
- [ ] Lấy SHA mới nhất từ `getPullRequestInfo` (tránh stale SHA)
- [ ] `try/catch + throw` — error bubbles up cho BullMQ retry
- [ ] QueueModule uncommented trong AppModule
- [ ] Test script `test-pipeline.ts` chạy OK
- [ ] Unit test cho ReviewProcessor pass (3 cases)
- [ ] Test webhook thật: tạo PR → bot tự review → comment xuất hiện trên GitHub
- [ ] `npm test` — tất cả test cũ vẫn pass

---

## Diagram tổng kết

```
┌────────────┐   webhook    ┌──────────────┐   add job   ┌─────────┐
│   GitHub   │─────────────▶│  Webhook     │────────────▶│  Redis  │
│            │   POST       │  Controller  │             │  Queue  │
└────────────┘              │  + Service   │             └────┬────┘
      ▲                     └──────────────┘                  │
      │                                                       │ consume
      │  submitReview                                         ▼
      │                                            ┌──────────────────┐
      │                                            │ ReviewProcessor  │
      │                                            │                  │
      │    ┌───────────────────────────────────────│  1. getPRDiff()  │
      │    │                                       │  2. parseDiff()  │
      │    │                                       │  3. reviewLLM()  │
      └────┤                                       │  4. postReview() │
           │                                       └──────────────────┘
           │                                              │   │   │
           ▼                                              ▼   ▼   ▼
    ┌──────────────┐                            GitHub  Diff  LLM
    │ GitHub API   │                            Service Parser Service
    │ (Octokit)    │
    └──────────────┘
```

Sau Day 13, bot hoạt động end-to-end. Day 14+ sẽ là polish: dashboard UI, rate limiting, caching, metrics.
