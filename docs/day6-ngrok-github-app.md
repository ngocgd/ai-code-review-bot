# 📘 Day 6: Webhook Testing + ngrok + GitHub App

## Mục tiêu
Kết nối bot với GitHub thật — tạo GitHub App, dùng ngrok expose localhost, test real webhook khi tạo PR.

---

## 1. ngrok — Expose localhost ra internet

### Vấn đề
Bot chạy ở `localhost:3015` — GitHub không thể gửi webhook đến localhost.

```
GitHub ──POST──> localhost:3015   ❌ Không được!
GitHub ──POST──> https://abc123.ngrok.io ──> localhost:3015  ✅ OK!
```

### ngrok là gì?
ngrok tạo 1 URL public (tunnel) trỏ về localhost. GitHub gửi webhook đến URL này → ngrok forward về máy bạn.

### Install ngrok
```bash
# macOS
brew install ngrok

# Hoặc download từ https://ngrok.com/download
```

### Đăng ký + auth (miễn phí)
1. Tạo account tại https://ngrok.com
2. Lấy authtoken tại Dashboard → Your Authtoken
3. Config:
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### Chạy ngrok
```bash
# Expose port 3015
ngrok http 3015
```

Output:
```
Forwarding  https://a1b2c3d4.ngrok-free.app → http://localhost:3015
```

**Giữ terminal này mở** — copy URL `https://a1b2c3d4.ngrok-free.app` để dùng cho GitHub App.

### ngrok Dashboard
Truy cập `http://localhost:4040` → xem tất cả requests đi qua ngrok (rất hữu ích để debug webhook).

---

## 2. Tạo GitHub App

### Tại sao GitHub App chứ không phải Personal Access Token?
| | GitHub App | Personal Token |
|---|---|---|
| Quyền | Fine-grained, per-repo | Truy cập tất cả repos |
| Bảo mật | Webhook signature verify | Không có |
| Rate limit | Cao hơn (5000/h per install) | 5000/h total |
| Production-ready | ✅ | ❌ |

### Các bước tạo

**Bước 1:** Vào https://github.com/settings/apps → **New GitHub App**

**Bước 2:** Điền thông tin:
```
GitHub App name:        ai-code-review-bot-dev  (phải unique)
Homepage URL:           http://localhost:3015
Webhook URL:            https://a1b2c3d4.ngrok-free.app/webhook/github
Webhook secret:         dev-webhook-secret-change-in-production
                        (giống GITHUB_WEBHOOK_SECRET trong .env)
```

**Bước 3:** Permissions — set quyền cần thiết:
```
Repository permissions:
  ✅ Pull requests:     Read & Write  (đọc PR + post comments)
  ✅ Contents:          Read-only     (đọc code/diff)
  ✅ Metadata:          Read-only     (bắt buộc)

Subscribe to events:
  ✅ Pull request       (nhận webhook khi có PR)
```

**Bước 4:** Where can this app be installed?
→ Chọn **Only on this account** (dev mode)

**Bước 5:** Click **Create GitHub App**

### Sau khi tạo — lưu lại thông tin

```
App ID:              123456        → GITHUB_APP_ID trong .env
```

**Generate Private Key:**
- Scroll xuống → **Generate a private key** → download file `.pem`
- Lưu file vào project: `secrets/github-app.pem`
- Thêm vào `.gitignore`: `secrets/`

### Install App vào repo test

1. Vào GitHub App settings → **Install App** (menu bên trái)
2. Chọn account của bạn
3. Chọn **Only select repositories** → chọn 1 repo test
4. Click **Install**

Sau khi install → ghi lại **Installation ID** (trong URL: `/installations/XXXXXX`)

### Update .env
```bash
GITHUB_APP_ID=123456
GITHUB_WEBHOOK_SECRET=dev-webhook-secret-change-in-production
# GITHUB_PRIVATE_KEY_PATH=./secrets/github-app.pem  (Day 7)
# GITHUB_INSTALLATION_ID=789012                      (Day 7)
```

---

## 3. Test Real Webhook!

### Chuẩn bị
1. Terminal 1: `npm run start:dev` (bot đang chạy)
2. Terminal 2: `ngrok http 3015` (tunnel đang mở)
3. ngrok URL đã set trong GitHub App webhook settings
4. `.env` có `GITHUB_WEBHOOK_SECRET` khớp với GitHub App

### Test 1: Ping event (tự động)
Khi bạn vừa tạo/install GitHub App → GitHub tự gửi 1 ping event.

Kiểm tra:
- Terminal bot: log `Received ping from GitHub — webhook connected!`
- ngrok dashboard (`localhost:4040`): thấy POST request 200

### Test 2: Tạo PR thật
1. Vào repo test đã install app
2. Tạo branch mới:
```bash
git checkout -b test/webhook-day6
echo "// test webhook" > test-file.ts
git add . && git commit -m "test: webhook day 6"
git push origin test/webhook-day6
```
3. Tạo Pull Request trên GitHub

**Expect trong terminal bot:**
```
PR #1 [opened] on yourname/test-repo: "test: webhook day 6" by @yourname
```

### Test 3: Push thêm commit vào PR
```bash
echo "// another change" >> test-file.ts
git add . && git commit -m "test: synchronize event"
git push
```

**Expect:** Log với action `synchronize`

### Test 4: Close PR
Close PR trên GitHub → bot log `Ignoring PR action: closed`

### Kiểm tra trên ngrok Dashboard
Vào `http://localhost:4040`:
- Xem từng request GitHub gửi
- Xem headers (X-GitHub-Event, X-Hub-Signature-256)
- Xem body (payload đầy đủ)
- Xem response bot trả về

---

## 4. Troubleshooting

### Webhook không nhận được?
```bash
# Check ngrok đang chạy
curl https://your-ngrok-url.ngrok-free.app/webhook/github \
  -X POST -H "X-GitHub-Event: ping" -d '{}'

# Nếu 502 → bot chưa chạy hoặc sai port
# Nếu timeout → ngrok chưa chạy
```

### Nhận 401 Unauthorized?
- Kiểm tra `GITHUB_WEBHOOK_SECRET` trong `.env` khớp với GitHub App settings
- Restart bot sau khi sửa `.env`

### GitHub báo webhook delivery failed?
1. Vào GitHub App → **Advanced** → **Recent Deliveries**
2. Xem request/response chi tiết
3. Click **Redeliver** để gửi lại

### ngrok URL thay đổi mỗi lần restart?
Free plan ngrok đổi URL mỗi lần restart. Phải update lại trong GitHub App settings.
**Tip:** Dùng `ngrok http 3015 --domain=your-name.ngrok-free.app` (free plan cho 1 static domain).

---

## 5. Viết Integration Test (E2E)

Test full HTTP flow: gửi webhook request → verify response.

### Tạo `test/webhook.e2e-spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';

describe('Webhook (e2e)', () => {
  let app: INestApplication;
  const WEBHOOK_SECRET = 'test-e2e-secret';

  beforeAll(async () => {
    // Override env cho test
    process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper: tạo valid signature
  function sign(body: string): string {
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    return 'sha256=' + hmac.update(body).digest('hex');
  }

  describe('POST /webhook/github', () => {
    it('should return 401 for invalid signature', () => {
      return request(app.getHttpServer())
        .post('/webhook/github')
        .set('X-GitHub-Event', 'ping')
        .set('X-Hub-Signature-256', 'sha256=invalid')
        .send({ zen: 'test' })
        .expect(401);
    });

    it('should return pong for ping event', () => {
      const body = JSON.stringify({ zen: 'Keep it logically awesome.' });

      return request(app.getHttpServer())
        .post('/webhook/github')
        .set('Content-Type', 'application/json')
        .set('X-GitHub-Event', 'ping')
        .set('X-Hub-Signature-256', sign(body))
        .send(body)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('pong');
        });
    });

    it('should ignore push events', () => {
      const body = JSON.stringify({ ref: 'refs/heads/main' });

      return request(app.getHttpServer())
        .post('/webhook/github')
        .set('Content-Type', 'application/json')
        .set('X-GitHub-Event', 'push')
        .set('X-Hub-Signature-256', sign(body))
        .send(body)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ ignored: true, event: 'push' });
        });
    });

    it('should ignore closed PR', () => {
      const body = JSON.stringify({ action: 'closed' });

      return request(app.getHttpServer())
        .post('/webhook/github')
        .set('Content-Type', 'application/json')
        .set('X-GitHub-Event', 'pull_request')
        .set('X-Hub-Signature-256', sign(body))
        .send(body)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            ignored: true,
            event: 'pull_request',
            action: 'closed',
          });
        });
    });

    it('should process opened PR', () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 1,
          title: 'Test PR',
          user: { login: 'testuser' },
          head: { sha: 'abc123', ref: 'feature/test' },
          base: { ref: 'main' },
        },
        repository: {
          name: 'test-repo',
          full_name: 'testuser/test-repo',
          owner: { login: 'testuser' },
        },
      };
      const body = JSON.stringify(payload);

      return request(app.getHttpServer())
        .post('/webhook/github')
        .set('Content-Type', 'application/json')
        .set('X-GitHub-Event', 'pull_request')
        .set('X-Hub-Signature-256', sign(body))
        .send(body)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            received: true,
            pr: 1,
            action: 'opened',
          });
        });
    });
  });
});
```

### Chạy e2e test:
```bash
npm run test:e2e
```

**Lưu ý:** E2E test cần database connection. Nếu chưa chạy Docker:
```bash
docker compose up -d   # start PostgreSQL + Redis
npx prisma migrate dev # apply migrations
npm run test:e2e
```

---

## 6. Checklist hoàn thành Day 6

- [ ] Install + config ngrok
- [ ] Chạy `ngrok http 3015` — có URL public
- [ ] Tạo GitHub App với đúng permissions
- [ ] Generate private key → lưu `secrets/github-app.pem`
- [ ] Install GitHub App vào 1 repo test
- [ ] Nhận ping event thành công
- [ ] Tạo PR → bot log PR info ✅
- [ ] Push thêm commit → bot log synchronize ✅
- [ ] Close PR → bot log ignored ✅
- [ ] Kiểm tra ngrok dashboard (`localhost:4040`)
- [ ] Viết e2e test → `npm run test:e2e` pass ✅
- [ ] Lưu App ID + Installation ID vào `.env`

---

## 📚 Khái niệm đã học

| Concept | Giải thích |
|---|---|
| **ngrok** | Tunnel tool — expose localhost ra internet để nhận webhook |
| **GitHub App** | Ứng dụng GitHub với fine-grained permissions, production-ready |
| **Installation** | Khi user install app vào repo → GitHub cấp installation ID |
| **Private Key** | RSA key để authenticate GitHub App (JWT → installation token) |
| **Webhook Delivery** | GitHub gửi HTTP POST + retry 3 lần nếu thất bại |
| **E2E Test** | Test full HTTP flow: request → controller → service → response |
| **supertest** | Library gửi HTTP request đến NestJS app trong test |

---

## 📚 Tham khảo
- [ngrok Quickstart](https://ngrok.com/docs/getting-started/)
- [Creating a GitHub App](https://docs.github.com/en/apps/creating-github-apps)
- [GitHub App Permissions](https://docs.github.com/en/apps/creating-github-apps/setting-up-a-github-app/choosing-permissions-for-a-github-app)
- [Testing Webhooks with Deliveries](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks)
- [NestJS E2E Testing](https://docs.nestjs.com/fundamentals/testing#end-to-end-testing)

---

## ⏭️ Day 7 Preview
Ngày mai: **GitHub API — Read PR Data**
- Authenticate GitHub App (JWT → installation access token)
- `getPullRequestDiff()` — fetch diff content
- `getPullRequestFiles()` — list changed files
- Dùng Octokit SDK
