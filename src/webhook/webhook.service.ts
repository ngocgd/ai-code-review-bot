import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Verify GitHub webhook signature (HMAC SHA-256)
   * GitHub signs payload with shared secret → we verify to reject forgeries
   */
  verifySignature(rawBody: Buffer, signature: string): boolean {
    const secret = this.configService.get<string>('GITHUB_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('GITHUB_WEBHOOK_SECRET not set — skipping verification');
      return true;
    }

    if (!signature) {
      this.logger.warn('Missing X-Hub-Signature-256 header');
      return false;
    }

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

  /**
   * Extract PR info from webhook payload
   */
  async handlePullRequest(payload: any) {
    const pr = payload.pull_request;
    const repo = payload.repository;

    const prInfo = {
      owner: repo.owner.login,
      repo: repo.name,
      fullName: repo.full_name,
      prNumber: pr.number,
      prTitle: pr.title,
      prAuthor: pr.user.login,
      headSha: pr.head.sha,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
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
