import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';

describe('Webhook (e2e)', () => {
  let app: INestApplication;
  const WEBHOOK_SECRET = 'test-e2e-secret';

  beforeAll(async () => {
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
