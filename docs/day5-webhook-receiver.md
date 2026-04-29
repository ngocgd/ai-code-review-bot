# 📘 Day 5: Webhook Receiver — Nhận events từ GitHub

## Mục tiêu
Implement webhook endpoint nhận events từ GitHub, verify signature bảo mật, và xử lý PR events.

---

## 1. Webhook là gì?

### Khái niệm
Webhook = "reverse API". Thay vì bạn gọi GitHub liên tục hỏi "có PR mới chưa?" (polling), GitHub **chủ động gửi** HTTP POST đến server bạn khi có event.

```
Polling (❌ lãng phí):
  Bot → GitHub: "có PR mới không?"  (mỗi 30s)
  Bot → GitHub: "có PR mới không?"
  Bot → GitHub: "có PR mới không?"
  GitHub → Bot: "có! PR #42"

Webhook (✅ hiệu quả):
  [im lặng chờ...]
  GitHub → Bot: POST /webhook/github  { "action": "opened", "pull_request": {...} }
```

### Flow trong project này:
```
Developer tạo PR trên GitHub
       ↓
GitHub gửi POST /webhook/github đến bot
       ↓
Bot verify signature (bảo mật)
       ↓
Bot parse event type (pull_request? push? issue?)
       ↓
Nếu là PR → extract info → queue for review
```

---

## 2. Bảo mật Webhook — HMAC SHA-256

### Tại sao cần verify?
Endpoint `/webhook/github` là public — ai cũng có thể gửi POST request giả mạo GitHub. Nếu không verify → attacker có thể trigger fake reviews, inject malicious data.

### HMAC là gì?
**HMAC** = Hash-based Message Authentication Code
- GitHub và bot chia sẻ 1 **secret key** (GITHUB_WEBHOOK_SECRET)
- Khi gửi webhook, GitHub dùng secret để tạo **chữ ký** (signature) từ payload
- Bot nhận payload + signature → tự tính lại signature → so sánh
- Khớp → payload thật từ GitHub. Không khớp → giả mạo.

### Cách hoạt động:
```
GitHub:
  signature = HMAC-SHA256(secret, payload_body)
  → Gửi kèm header: X-Hub-Signature-256: sha256=abc123...

Bot:
  expected = HMAC-SHA256(secret, payload_body)
  → So sánh expected === signature từ header
  → Khớp? ✅ Xử lý. Không khớp? ❌ Reject 401.
```

### Lưu ý quan trọng — timingSafeEqual:
```typescript
// ❌ SAI — dễ bị timing attack
if (expected === signature) { ... }

// ✅ ĐÚNG — constant-time comparison
crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
```
**Timing attack:** Nếu dùng `===`, attacker đo thời gian response → đoán từng ký tự signature. `timingSafeEqual` luôn mất cùng thời gian dù đúng hay sai.

---

## 3. GitHub Event Types

### Header: X-GitHub-Event
GitHub gửi loại event qua header, không phải body:

| Event | Khi nào | Bot cần xử lý? |
|---|---|---|
| `pull_request` | PR opened/closed/merged/updated | ✅ **Có** |
| `push` | Code pushed to branch | ❌ Bỏ qua |
| `issues` | Issue created/updated | ❌ Bỏ qua |
| `issue_comment` | Comment on issue/PR | ❌ (tạm thời) |
| `ping` | Webhook vừa được setup | ✅ Trả 200 |

### Pull Request Actions
Trong event `pull_request`, field `action` cho biết cụ thể:

| Action | Nghĩa | Bot nên review? |
|---|---|---|
| `opened` | PR mới tạo | ✅ Review |
| `synchronize` | Push thêm commit vào PR | ✅ Re-review |
| `reopened` | PR bị close rồi mở lại | ✅ Review |
| `closed` | PR bị close/merge | ❌ Bỏ qua |
| `edited` | Sửa title/description | ❌ Bỏ qua |

---

## 4. Implementation — Step by Step

### Step 1: Thêm GITHUB_WEBHOOK_SECRET vào .env
```bash
# .env
GITHUB_WEBHOOK_SECRET=my-super-secret-key-12345
```

### Step 2: Implement verifySignature()

Mở `src/webhook/webhook.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Verify GitHub webhook signature (HMAC SHA-256)
   *
   * Cách hoạt động:
   * 1. Lấy secret từ env
   * 2. Tạo HMAC từ payload + secret
   * 3. So sánh với signature GitHub gửi (constant-time)
   */
  verifySignature(payload: any, signature: string): boolean {
    // 1. Lấy secret — nếu chưa config thì skip verify (dev mode)
    const secret = this.configService.get<string>('GITHUB_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('GITHUB_WEBHOOK_SECRET not set — skipping verification');
      return true;
    }

    // 2. Không có signature header → reject
    if (!signature) {
      this.logger.warn('Missing X-Hub-Signature-256 header');
      return false;
    }

    // 3. Tạo expected signature
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');

    // 4. So sánh constant-time (chống timing attack)
    try {
      return crypto.timingSafeEqual(
        Buffer.from(digest),
        Buffer.from(signature),
      );
    } catch {
      // Buffer lengths khác nhau → không khớp
      return false;
    }
  }

  /**
   * Handle pull_request event
   * Extract PR info cần thiết cho review
   */
  async handlePullRequest(payload: any) {
    const pr = payload.pull_request;
    const repo = payload.repository;

    const prInfo = {
      owner: repo.owner.login,
      repo: repo.name,
      fullName: repo.full_name,         // "owner/repo"
      prNumber: pr.number,
      prTitle: pr.title,
      prAuthor: pr.user.login,
      headSha: pr.head.sha,             // commit mới nhất
      baseBranch: pr.base.ref,          // merge vào branch nào
      headBranch: pr.head.ref,          // branch của PR
      action: payload.action,
    };

    this.logger.log(
      `PR #${prInfo.prNumber} [${prInfo.action}] on ${prInfo.fullName}: "${prInfo.prTitle}" by @${prInfo.prAuthor}`,
    );

    // TODO [Day 12]: Add to BullMQ queue
    // await this.reviewQueue.add('review-pr', prInfo);

    return prInfo;
  }
}
```

### Step 3: Implement WebhookController

Mở `src/webhook/webhook.controller.ts`:

```typescript
import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  // Actions mà bot sẽ trigger review
  private readonly REVIEWABLE_ACTIONS = ['opened', 'synchronize', 'reopened'];

  constructor(private readonly webhookService: WebhookService) {}

  @Post('github')
  @HttpCode(200)
  async handleGithubWebhook(
    @Headers('x-github-event') event: string,
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: any,
  ) {
    // 1. Verify signature — reject nếu giả mạo
    const isValid = this.webhookService.verifySignature(payload, signature);
    if (!isValid) {
      this.logger.warn('Invalid webhook signature — rejecting');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // 2. Handle ping event (GitHub gửi khi setup webhook)
    if (event === 'ping') {
      this.logger.log('Received ping from GitHub — webhook connected!');
      return { message: 'pong' };
    }

    // 3. Chỉ xử lý pull_request events
    if (event !== 'pull_request') {
      this.logger.debug(`Ignoring event: ${event}`);
      return { ignored: true, event };
    }

    // 4. Chỉ review khi PR opened/updated/reopened
    const action = payload.action;
    if (!this.REVIEWABLE_ACTIONS.includes(action)) {
      this.logger.debug(`Ignoring PR action: ${action}`);
      return { ignored: true, event, action };
    }

    // 5. Process PR
    const prInfo = await this.webhookService.handlePullRequest(payload);

    return {
      received: true,
      pr: prInfo.prNumber,
      action: prInfo.action,
    };
  }
}
```

### Step 4: Wire WebhookModule vào AppModule

Mở `src/app.module.ts`, uncomment WebhookModule:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    HealthModule,
    RepositoryModule,
    ReviewModule,
    WebhookModule,    // ← Uncomment dòng này
    // GithubModule,
    // LlmModule,
    // QueueModule,
  ],
})
export class AppModule {}
```

---

## 5. Raw Body — Vấn đề thực tế

### Vấn đề:
GitHub tính signature từ **raw body** (chuỗi bytes gốc), nhưng NestJS tự động parse body thành object. Khi `JSON.stringify()` lại → có thể khác raw body (thứ tự key, spacing).

### Giải pháp: Lưu raw body

Mở `src/main.ts`, thêm raw body config:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Giữ raw body để verify webhook signature
    rawBody: true,
  });

  const port = process.env.PORT || 3015;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
}
bootstrap();
```

Cập nhật controller để dùng raw body:
```typescript
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';

// Trong handleGithubWebhook(), thêm @Req():
async handleGithubWebhook(
  @Headers('x-github-event') event: string,
  @Headers('x-hub-signature-256') signature: string,
  @Body() payload: any,
  @Req() req: RawBodyRequest<Request>,  // ← thêm
) {
  // Dùng req.rawBody thay vì JSON.stringify(payload) trong verifySignature
  const isValid = this.webhookService.verifySignature(req.rawBody, signature);
  // ...
}
```

Cập nhật `verifySignature` nhận Buffer:
```typescript
verifySignature(rawBody: Buffer, signature: string): boolean {
  const secret = this.configService.get<string>('GITHUB_WEBHOOK_SECRET');
  if (!secret) return true;
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}
```

---

## 6. Test thủ công với curl

### Start server:
```bash
npm run start:dev
```

### Test ping event:
```bash
curl -X POST http://localhost:3015/webhook/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -d '{"zen": "Keep it logically awesome."}'
```
Expected: `{"message":"pong"}`

### Test PR event:
```bash
curl -X POST http://localhost:3015/webhook/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -d '{
    "action": "opened",
    "pull_request": {
      "number": 42,
      "title": "Add login feature",
      "user": {"login": "ngocngo12a"},
      "head": {"sha": "abc123", "ref": "feature/login"},
      "base": {"ref": "main"}
    },
    "repository": {
      "name": "my-app",
      "full_name": "ngocngo12a/my-app",
      "owner": {"login": "ngocngo12a"}
    }
  }'
```
Expected: `{"received":true,"pr":42,"action":"opened"}`

### Test ignored event (push):
```bash
curl -X POST http://localhost:3015/webhook/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{"ref": "refs/heads/main"}'
```
Expected: `{"ignored":true,"event":"push"}`

---

## 7. Viết Tests

### Unit test: `webhook.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhookService } from './webhook.service';
import * as crypto from 'crypto';

describe('WebhookService', () => {
  let service: WebhookService;
  let configService: ConfigService;

  const TEST_SECRET = 'test-webhook-secret';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(TEST_SECRET),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('verifySignature', () => {
    // Helper: tạo signature hợp lệ
    function createValidSignature(body: Buffer): string {
      const hmac = crypto.createHmac('sha256', TEST_SECRET);
      return 'sha256=' + hmac.update(body).digest('hex');
    }

    it('should return true for valid signature', () => {
      const body = Buffer.from('{"test": true}');
      const signature = createValidSignature(body);

      expect(service.verifySignature(body, signature)).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const body = Buffer.from('{"test": true}');

      expect(service.verifySignature(body, 'sha256=invalid')).toBe(false);
    });

    it('should return false when signature header is missing', () => {
      const body = Buffer.from('{"test": true}');

      expect(service.verifySignature(body, undefined)).toBe(false);
    });

    it('should return true when secret is not configured (dev mode)', () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);
      const body = Buffer.from('anything');

      expect(service.verifySignature(body, 'whatever')).toBe(true);
    });
  });

  describe('handlePullRequest', () => {
    it('should extract PR info correctly', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 42,
          title: 'Add login',
          user: { login: 'dev1' },
          head: { sha: 'abc123', ref: 'feature/login' },
          base: { ref: 'main' },
        },
        repository: {
          name: 'my-app',
          full_name: 'org/my-app',
          owner: { login: 'org' },
        },
      };

      const result = await service.handlePullRequest(payload);

      expect(result).toEqual({
        owner: 'org',
        repo: 'my-app',
        fullName: 'org/my-app',
        prNumber: 42,
        prTitle: 'Add login',
        prAuthor: 'dev1',
        headSha: 'abc123',
        baseBranch: 'main',
        headBranch: 'feature/login',
        action: 'opened',
      });
    });
  });
});
```

### Unit test: `webhook.controller.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: WebhookService;

  const mockWebhookService = {
    verifySignature: jest.fn(),
    handlePullRequest: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: WebhookService, useValue: mockWebhookService },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    jest.clearAllMocks();
  });

  it('should reject invalid signature with 401', async () => {
    mockWebhookService.verifySignature.mockReturnValue(false);

    await expect(
      controller.handleGithubWebhook('pull_request', 'bad-sig', {}, { rawBody: Buffer.from('') } as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should return pong for ping event', async () => {
    mockWebhookService.verifySignature.mockReturnValue(true);

    const result = await controller.handleGithubWebhook(
      'ping', 'valid-sig', { zen: 'test' }, { rawBody: Buffer.from('') } as any,
    );

    expect(result).toEqual({ message: 'pong' });
  });

  it('should ignore non-PR events', async () => {
    mockWebhookService.verifySignature.mockReturnValue(true);

    const result = await controller.handleGithubWebhook(
      'push', 'valid-sig', {}, { rawBody: Buffer.from('') } as any,
    );

    expect(result).toEqual({ ignored: true, event: 'push' });
  });

  it('should ignore non-reviewable PR actions', async () => {
    mockWebhookService.verifySignature.mockReturnValue(true);

    const result = await controller.handleGithubWebhook(
      'pull_request', 'valid-sig', { action: 'closed' }, { rawBody: Buffer.from('') } as any,
    );

    expect(result).toEqual({ ignored: true, event: 'pull_request', action: 'closed' });
  });

  it('should process opened PR', async () => {
    mockWebhookService.verifySignature.mockReturnValue(true);
    mockWebhookService.handlePullRequest.mockResolvedValue({
      prNumber: 42,
      action: 'opened',
    });

    const payload = { action: 'opened', pull_request: {}, repository: {} };
    const result = await controller.handleGithubWebhook(
      'pull_request', 'valid-sig', payload, { rawBody: Buffer.from('') } as any,
    );

    expect(result).toEqual({ received: true, pr: 42, action: 'opened' });
    expect(mockWebhookService.handlePullRequest).toHaveBeenCalledWith(payload);
  });
});
```

---

## 8. Checklist hoàn thành Day 5

- [ ] Thêm `GITHUB_WEBHOOK_SECRET` vào `.env`
- [ ] Implement `verifySignature()` với HMAC SHA-256
- [ ] Implement `handlePullRequest()` — extract PR info
- [ ] Update `WebhookController` — verify → route → handle
- [ ] Enable `rawBody: true` trong `main.ts`
- [ ] Uncomment `WebhookModule` trong `app.module.ts`
- [ ] Test bằng curl: ping, PR opened, push (ignored), invalid signature
- [ ] Viết unit tests cho `WebhookService` (4 tests)
- [ ] Viết unit tests cho `WebhookController` (5 tests)
- [ ] Chạy `npm run test` — all pass ✅

---

## 📚 Khái niệm đã học

| Concept | Giải thích |
|---|---|
| **Webhook** | Server-to-server notification — GitHub POST đến bot khi có event |
| **HMAC SHA-256** | Hash-based MAC — chứng minh payload đến từ GitHub, không bị giả mạo |
| **timingSafeEqual** | So sánh constant-time — chống timing attack |
| **Raw Body** | Body gốc dạng bytes, cần cho HMAC chính xác |
| **NestJS Guards** | Middleware bảo vệ route (dùng ở Day 6 nếu muốn tách logic verify) |
| **Event-driven** | Xử lý theo event type thay vì polling |

---

## 📚 Tham khảo
- [GitHub Webhooks Documentation](https://docs.github.com/en/webhooks)
- [Securing Webhooks](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [GitHub Webhook Events](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- [NestJS Raw Body](https://docs.nestjs.com/faq/raw-body)
- [Node.js crypto — HMAC](https://nodejs.org/api/crypto.html#cryptocreatehmacsalgorithm-key-options)
- [Timing Attacks Explained](https://codahale.com/a-lesson-in-timing-attacks/)

---

## ⏭️ Day 6 Preview
Ngày mai: **Webhook Testing + ngrok**
- Install ngrok → expose localhost ra internet
- Tạo GitHub App (Settings → Developer Settings)
- Test real webhook: tạo PR trên test repo → bot nhận event
- Viết integration tests (supertest → full HTTP flow)
