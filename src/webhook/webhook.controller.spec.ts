import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

describe('WebhookController', () => {
  let controller: WebhookController;

  const mockWebhookService = {
    verifySignature: jest.fn(),
    handlePullRequest: jest.fn(),
  };

  const mockReq = { rawBody: Buffer.from('{}') } as any;

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
      controller.handleGithubWebhook('pull_request', 'bad-sig', {}, mockReq),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should return pong for ping event', async () => {
    mockWebhookService.verifySignature.mockReturnValue(true);

    const result = await controller.handleGithubWebhook(
      'ping', 'valid-sig', { zen: 'test' }, mockReq,
    );

    expect(result).toEqual({ message: 'pong' });
  });

  it('should ignore non-PR events', async () => {
    mockWebhookService.verifySignature.mockReturnValue(true);

    const result = await controller.handleGithubWebhook(
      'push', 'valid-sig', {}, mockReq,
    );

    expect(result).toEqual({ ignored: true, event: 'push' });
  });

  it('should ignore non-reviewable PR actions', async () => {
    mockWebhookService.verifySignature.mockReturnValue(true);

    const result = await controller.handleGithubWebhook(
      'pull_request', 'valid-sig', { action: 'closed' }, mockReq,
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
      'pull_request', 'valid-sig', payload, mockReq,
    );

    expect(result).toEqual({ received: true, pr: 42, action: 'opened' });
    expect(mockWebhookService.handlePullRequest).toHaveBeenCalledWith(payload);
  });

  it('should process synchronize PR', async () => {
    mockWebhookService.verifySignature.mockReturnValue(true);
    mockWebhookService.handlePullRequest.mockResolvedValue({
      prNumber: 42,
      action: 'synchronize',
    });

    const payload = { action: 'synchronize', pull_request: {}, repository: {} };
    const result = await controller.handleGithubWebhook(
      'pull_request', 'valid-sig', payload, mockReq,
    );

    expect(result).toEqual({ received: true, pr: 42, action: 'synchronize' });
  });

  it('should process reopened PR', async () => {
    mockWebhookService.verifySignature.mockReturnValue(true);
    mockWebhookService.handlePullRequest.mockResolvedValue({
      prNumber: 7,
      action: 'reopened',
    });

    const payload = { action: 'reopened', pull_request: {}, repository: {} };
    const result = await controller.handleGithubWebhook(
      'pull_request', 'valid-sig', payload, mockReq,
    );

    expect(result).toEqual({ received: true, pr: 7, action: 'reopened' });
  });
});
