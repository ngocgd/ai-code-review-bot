# Day 12: Queue System — Async Processing với BullMQ

## Tại sao cần Queue?

Khi GitHub gửi webhook, bot phải trả về HTTP 200 trong **10 giây** — nếu không GitHub sẽ coi là timeout và retry.

Nhưng review 1 PR mất **30-60 giây** (fetch diff → parse → gọi LLM → post comment). Nếu xử lý đồng bộ trong webhook handler → timeout → GitHub retry → review chạy trùng lặp.

**Giải pháp: Message Queue**

```
Webhook nhận PR event (< 1s)
    → Tạo job, đẩy vào queue
    → Trả 200 ngay cho GitHub ✅
    
Queue processor chạy ngầm
    → Lấy job ra
    → Fetch diff → Parse → LLM review → Post comment
    → Đánh dấu done (hoặc retry nếu fail)
```

## Kiến thức nền

### BullMQ là gì?

BullMQ là thư viện message queue cho Node.js, dùng **Redis** làm storage. Nó giải quyết:

- **Async processing**: tách "nhận request" và "xử lý request" thành 2 bước
- **Retry**: job fail → tự chạy lại (có giới hạn)
- **Concurrency**: xử lý nhiều job song song
- **Persistence**: job lưu trong Redis, restart app không mất

### Các khái niệm chính

```
┌─────────┐     ┌─────────┐     ┌────────────┐
│ Producer │────▶│  Queue   │────▶│  Consumer  │
│          │     │ (Redis)  │     │ (Processor)│
└─────────┘     └─────────┘     └────────────┘
```

| Khái niệm | Giải thích |
|-----------|-----------|
| **Producer** | Code tạo job và đẩy vào queue (WebhookService) |
| **Queue** | Hàng đợi lưu trong Redis, FIFO (first in first out) |
| **Consumer/Processor** | Code lấy job ra và xử lý (ReviewProcessor) |
| **Job** | 1 đơn vị công việc — chứa data + trạng thái |

### Job Lifecycle (vòng đời 1 job)

```
waiting → active → completed ✅
                 → failed ❌ → waiting (retry)
                              → failed (hết retry) → dead letter
```

- **waiting**: đang chờ trong queue
- **active**: đang được processor xử lý
- **completed**: xong, thành công
- **failed**: lỗi — BullMQ tự retry theo config
- **dead letter**: fail quá nhiều lần, bỏ qua

### Retry Strategies

```
Fixed delay:        5s → 5s → 5s           (đơn giản)
Exponential:        2s → 4s → 8s → 16s     (tốt hơn — tránh spam khi service down)
```

Bot của mình dùng **exponential backoff** — mỗi lần retry chờ lâu hơn.

---

## Bắt tay làm

### Bước 1: Cài dependencies

```bash
npm install @nestjs/bullmq bullmq
```

**Giải thích:**
- `bullmq` — thư viện queue core
- `@nestjs/bullmq` — NestJS wrapper, tích hợp dependency injection

> 💡 Redis đã có sẵn trong docker-compose.yml (port 6379). Chạy `docker compose up -d` nếu chưa start.

### Bước 2: Cấu hình QueueModule

Mở file `src/queue/queue.module.ts` — bạn sẽ thấy TODO sẵn.

**Việc cần làm:**

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    // 1. Kết nối Redis — dùng forRootAsync để đọc config từ .env
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),

    // 2. Đăng ký queue tên 'review-pr'
    BullModule.registerQueue({
      name: 'review-pr',
    }),
  ],
  exports: [BullModule], // Export để module khác inject được queue
})
export class QueueModule {}
```

**Tự hỏi & trả lời:**
- *Sao dùng `forRootAsync` mà không phải `forRoot`?* → Vì cần đọc config từ ConfigService (env vars), không hardcode.
- *`exports: [BullModule]` để làm gì?* → Cho phép module khác (WebhookModule) inject queue để tạo job.

### Bước 3: Tạo ReviewProcessor (Consumer)

Tạo file mới: `src/queue/review.processor.ts`

**Đây là phần quan trọng nhất** — processor nhận job từ queue và thực hiện review.

```typescript
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

// Định nghĩa type cho job data
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

@Processor('review-pr')  // Tên phải khớp với registerQueue
export class ReviewProcessor extends WorkerHost {
  private readonly logger = new Logger(ReviewProcessor.name);

  // ĐÂY là method chính — BullMQ gọi khi có job
  async process(job: Job<ReviewJobData>): Promise<any> {
    const { owner, repo, prNumber, prTitle } = job.data;
    this.logger.log(`🔍 Processing review: ${owner}/${repo}#${prNumber} "${prTitle}"`);

    // TODO: Implement full review pipeline ở Day 13
    // Tạm thời log ra để test queue hoạt động
    
    // Bước 1: Update progress
    await job.updateProgress(10);
    this.logger.log(`  Step 1: Fetching PR diff...`);
    // const diff = await this.githubService.getPullRequestDiff(owner, repo, prNumber);
    
    await job.updateProgress(30);
    this.logger.log(`  Step 2: Parsing diff...`);
    // const chunks = this.diffParser.parseDiff(diff);
    
    await job.updateProgress(50);
    this.logger.log(`  Step 3: LLM reviewing...`);
    // const result = await this.llmService.reviewAllChunks(chunks);
    
    await job.updateProgress(80);
    this.logger.log(`  Step 4: Posting review to GitHub...`);
    // await this.githubService.submitReview(...)
    
    await job.updateProgress(100);
    
    // Trả về result — BullMQ lưu vào Redis
    return {
      status: 'completed',
      pr: `${owner}/${repo}#${prNumber}`,
      // issuesFound: result.issues.length,
      // severity: result.overallSeverity,
      processedAt: new Date().toISOString(),
    };
  }

  // === Event handlers — log vòng đời job ===

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Job ${job.id} started: PR #${job.data.prNumber}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: any) {
    this.logger.log(`✅ Job ${job.id} completed: ${JSON.stringify(result)}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Job ${job.id} failed (attempt ${job.attemptsMade}): ${error.message}`);
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number | object) {
    this.logger.debug(`Job ${job.id} progress: ${progress}%`);
  }
}
```

**Điểm cần hiểu:**

1. `@Processor('review-pr')` — decorator nói "class này xử lý queue tên review-pr"
2. `extends WorkerHost` — base class của NestJS BullMQ, bắt buộc implement `process()`
3. `job.data` — data bạn truyền vào khi tạo job (PR info)
4. `job.updateProgress()` — cập nhật tiến độ (0-100), hữu ích cho monitoring
5. `@OnWorkerEvent` — hooks vào lifecycle events của job

### Bước 4: Register Processor vào QueueModule

Quay lại `queue.module.ts`, thêm processor:

```typescript
import { ReviewProcessor } from './review.processor';

@Module({
  imports: [
    BullModule.forRootAsync({ ... }),    // giữ nguyên
    BullModule.registerQueue({ name: 'review-pr' }),
  ],
  providers: [ReviewProcessor],  // ← thêm dòng này
  exports: [BullModule],
})
export class QueueModule {}
```

### Bước 5: Enable QueueModule trong AppModule

Mở `src/app.module.ts`, uncomment QueueModule:

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
    QueueModule,      // ← uncomment dòng này
  ],
})
export class AppModule {}
```

### Bước 6: WebhookService đẩy job vào queue (Producer)

Mở `src/webhook/webhook.service.ts` — sửa method `handlePullRequest`:

**Cần thêm:**

1. Import `InjectQueue` từ `@nestjs/bullmq` và `Queue` từ `bullmq`
2. Inject queue vào constructor
3. Thêm job vào queue thay vì TODO comment

```typescript
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private configService: ConfigService,
    @InjectQueue('review-pr') private reviewQueue: Queue,  // ← inject queue
  ) {}

  // ... verifySignature giữ nguyên ...

  async handlePullRequest(payload: any) {
    // ... extract prInfo giữ nguyên ...

    // Thêm job vào queue
    const job = await this.reviewQueue.add(
      'review',           // job name (dùng cho filtering/logging)
      prInfo,             // job data — chính là ReviewJobData
      {
        // Cấu hình retry
        attempts: 3,                    // retry tối đa 3 lần
        backoff: {
          type: 'exponential',          // exponential backoff
          delay: 5000,                  // bắt đầu 5s → 10s → 20s
        },
        removeOnComplete: {
          age: 24 * 3600,               // xóa job thành công sau 24h
          count: 100,                   // giữ tối đa 100 job gần nhất
        },
        removeOnFail: {
          age: 7 * 24 * 3600,           // giữ job fail 7 ngày (debug)
        },
      },
    );

    this.logger.log(`📋 Job ${job.id} added to queue for PR #${prInfo.prNumber}`);

    return { ...prInfo, jobId: job.id };
  }
}
```

**Giải thích config:**

| Option | Ý nghĩa |
|--------|---------|
| `attempts: 3` | Fail → retry tối đa 3 lần |
| `backoff.type: 'exponential'` | Mỗi lần chờ gấp đôi: 5s → 10s → 20s |
| `removeOnComplete` | Tự dọn job cũ, tránh Redis đầy |
| `removeOnFail.age` | Giữ job fail 7 ngày để debug |

### Bước 7: Update WebhookModule imports

WebhookService giờ inject `@InjectQueue('review-pr')`, nên WebhookModule cần import QueueModule:

Mở `src/webhook/webhook.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],    // ← thêm import
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
```

### Bước 8: Thêm env vars (nếu cần)

Trong `.env`, Redis đã config qua `REDIS_URL`. Nhưng BullMQ cần `host` và `port` riêng:

```env
# Redis (đã có)
REDIS_URL="redis://localhost:6379"

# BullMQ (thêm mới — hoặc parse từ REDIS_URL)
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Test thử

### Test 1: App khởi động thành công

```bash
npm run start:dev
```

Kỳ vọng log:
```
[QueueModule] BullMQ connected to Redis
[ReviewProcessor] Worker started for queue: review-pr
```

Nếu lỗi Redis connection → chắc chắn `docker compose up -d` đã chạy.

### Test 2: Tạo test script

Tạo file `scripts/test-queue.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  // Lấy queue từ DI container
  const queue = app.get<Queue>(getQueueToken('review-pr'));

  console.log('\n=== Queue Status ===');
  const counts = await queue.getJobCounts();
  console.log('  Jobs:', counts);

  // Thêm 1 job test
  console.log('\n=== Adding test job ===');
  const job = await queue.add('review', {
    owner: 'ngocgd',
    repo: 'ai-code-review-bot',
    prNumber: 1,
    prTitle: 'Test PR from queue script',
    prAuthor: 'ngocgd',
    headSha: 'abc123',
    baseBranch: 'main',
    headBranch: 'feature/test',
    action: 'opened',
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
  
  console.log(`  Job ID: ${job.id}`);
  console.log(`  State: ${await job.getState()}`);

  // Chờ job xử lý xong
  console.log('\n=== Waiting for job to complete... ===');
  const result = await job.waitUntilFinished(
    queue.events,  // listen events
    30000,         // timeout 30s
  );

  console.log('  Result:', JSON.stringify(result, null, 2));

  // Check queue stats lại
  const finalCounts = await queue.getJobCounts();
  console.log('\n=== Final Queue Status ===');
  console.log('  Jobs:', finalCounts);

  await app.close();
}

main().catch(console.error);
```

Chạy:
```bash
npx ts-node -r tsconfig-paths/register scripts/test-queue.ts
```

### Test 3: Gửi webhook thật qua ngrok

1. Start app: `npm run start:dev`
2. Start ngrok: `ngrok http 3015`
3. Tạo/update PR trên GitHub
4. Xem log — expect thấy:
   ```
   [WebhookService] 📋 Job xxx added to queue for PR #2
   [ReviewProcessor] 🔍 Processing review: ngocgd/ai-code-review-bot#2
   [ReviewProcessor] ✅ Job xxx completed
   ```

---

## Viết Tests

Tạo file `src/queue/review.processor.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ReviewProcessor, ReviewJobData } from './review.processor';
import { Job } from 'bullmq';

describe('ReviewProcessor', () => {
  let processor: ReviewProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReviewProcessor],
    }).compile();

    processor = module.get<ReviewProcessor>(ReviewProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should process a review job', async () => {
    // Tạo mock job
    const mockJob = {
      id: 'test-job-1',
      data: {
        owner: 'ngocgd',
        repo: 'ai-code-review-bot',
        prNumber: 1,
        prTitle: 'Test PR',
        prAuthor: 'ngocgd',
        headSha: 'abc123',
        baseBranch: 'main',
        headBranch: 'feature/test',
        action: 'opened',
      } as ReviewJobData,
      updateProgress: jest.fn(),    // mock method
      attemptsMade: 0,
    } as unknown as Job<ReviewJobData>;

    const result = await processor.process(mockJob);

    expect(result).toHaveProperty('status', 'completed');
    expect(result).toHaveProperty('pr', 'ngocgd/ai-code-review-bot#1');
    expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
  });
});
```

Chạy test:
```bash
npm test -- --testPathPattern=review.processor
```

---

## Checklist hoàn thành Day 12

- [ ] `npm install @nestjs/bullmq bullmq`
- [ ] `queue.module.ts` — cấu hình BullMQ + Redis connection
- [ ] `review.processor.ts` — tạo processor với lifecycle events
- [ ] Register processor trong QueueModule
- [ ] Uncomment QueueModule trong AppModule
- [ ] `webhook.service.ts` — inject queue + thêm job khi nhận PR event
- [ ] `webhook.module.ts` — import QueueModule
- [ ] Thêm `REDIS_HOST`, `REDIS_PORT` vào `.env`
- [ ] App start thành công, không lỗi
- [ ] Test script chạy OK — job vào queue → processor xử lý → completed
- [ ] Unit test cho ReviewProcessor pass
- [ ] `npm test` — tất cả test cũ vẫn pass

---

## Bonus: Monitoring Queue (optional)

Nếu muốn xem queue trực quan, cài **Bull Board**:

```bash
npm install @bull-board/api @bull-board/express @bull-board/nestjs
```

Rồi tạo route `/admin/queues` để xem dashboard. Nhưng cái này optional — Day 12 focus vào hiểu queue pattern trước.

---

## Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `ECONNREFUSED 127.0.0.1:6379` | Redis chưa chạy | `docker compose up -d` |
| `Missing processor for job` | Processor chưa register | Check `providers: [ReviewProcessor]` trong QueueModule |
| `Queue review-pr not found` | QueueModule chưa import | Check `imports: [QueueModule]` |
| Job stuck ở `waiting` | Processor không match queue name | `@Processor('review-pr')` phải khớp tên queue |
| Test cũ fail (webhook) | WebhookService giờ cần queue | Mock `@InjectQueue` trong test — xem note bên dưới |

### Fix test cũ bị fail

Sau khi thêm `@InjectQueue` vào WebhookService, test cũ của webhook sẽ fail vì thiếu queue provider. Sửa `webhook.service.spec.ts`:

```typescript
// Thêm mock queue
const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
};

// Trong TestingModule
providers: [
  WebhookService,
  { provide: 'BullQueue_review-pr', useValue: mockQueue },
  // ... other providers
],
```

Token name cho InjectQueue là `BullQueue_<queue-name>` → `BullQueue_review-pr`.

---

> **Day 13** sẽ wire tất cả lại: webhook → queue → GitHub API + Diff Parser + LLM → post review. Processor sẽ inject GithubService, DiffParserService, LlmService và chạy pipeline hoàn chỉnh.
