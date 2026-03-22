import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

// ============================================================
// DAY 5-6: Webhook Service
// ============================================================
// TODO [Day 5]:
// 1. verifySignature() — HMAC SHA-256 verification
// 2. handlePullRequest() — extract PR info, add to queue
//
// TODO [Day 6]:
// 3. Write unit tests for verifySignature
// 4. Write integration test: webhook → queue → review
//
// Learn:
// - HMAC (Hash-based Message Authentication Code)
// - crypto module in Node.js
// - How GitHub signs webhook payloads
// ============================================================

@Injectable()
export class WebhookService {
  /**
   * Verify GitHub webhook signature
   * GitHub sends HMAC SHA-256 signature in X-Hub-Signature-256 header
   */
  verifySignature(payload: any, signature: string): boolean {
    // TODO [Day 5]: Implement HMAC verification
    // const secret = process.env.GITHUB_WEBHOOK_SECRET;
    // const hmac = crypto.createHmac('sha256', secret);
    // const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
    // return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    return true;
  }

  /**
   * Handle pull_request event
   * Extract PR info and queue for review
   */
  async handlePullRequest(payload: any) {
    // TODO [Day 5]: Extract PR info
    // const prInfo = {
    //   owner: payload.repository.owner.login,
    //   repo: payload.repository.name,
    //   prNumber: payload.pull_request.number,
    //   prTitle: payload.pull_request.title,
    //   prAuthor: payload.pull_request.user.login,
    //   headSha: payload.pull_request.head.sha,
    //   baseBranch: payload.pull_request.base.ref,
    //   headBranch: payload.pull_request.head.ref,
    // };
    //
    // TODO [Day 12]: Add to BullMQ queue instead of processing here
    // await this.reviewQueue.add('review-pr', prInfo);
  }
}
