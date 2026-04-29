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

      expect(service.verifySignature(body, undefined as any)).toBe(false);
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
