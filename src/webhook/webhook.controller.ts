import { Controller, Post, Body, Headers, HttpCode } from "@nestjs/common";
import { WebhookService } from "./webhook.service";

// ============================================================
// DAY 5: Webhook Controller - Receive GitHub Events
// ============================================================
// TODO [Day 5]:
// 1. Receive POST /webhook/github from GitHub
// 2. Verify webhook signature (HMAC SHA-256) for security
// 3. Parse event type from X-GitHub-Event header
// 4. Handle "pull_request" events (opened, synchronize)
// 5. Ignore other events (push, issues, etc.)
// 6. Return 200 quickly, process async via queue
//
// TODO [Day 6]:
// 7. Write tests:
//    - Valid signature → 200
//    - Invalid signature → 401
//    - PR opened event → triggers review
//    - Push event → ignored (200 but no action)
//    - Malformed body → 400
//
// Setup:
// - Create GitHub App: https://github.com/settings/apps
// - Set webhook URL: https://your-ngrok-url/webhook/github
// - Subscribe to: Pull Request events
// - Use ngrok for local testing: ngrok http 3015
//
// Learn:
// - Webhook security (HMAC verification)
// - GitHub event types & payloads
// - NestJS Guards for auth
// - Raw body access for signature verification
// ============================================================

@Controller("webhook")
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post("github")
  @HttpCode(200)
  async handleGithubWebhook(
    @Headers("x-github-event") event: string,
    @Headers("x-hub-signature-256") signature: string,
    @Body() payload: any,
  ) {
    // TODO [Day 5]: Verify signature
    // const isValid = this.webhookService.verifySignature(payload, signature);
    // if (!isValid) throw new UnauthorizedException('Invalid signature');

    // TODO [Day 5]: Route event to handler
    // if (event === 'pull_request') {
    //   const action = payload.action; // 'opened' | 'synchronize' | 'reopened'
    //   if (['opened', 'synchronize', 'reopened'].includes(action)) {
    //     await this.webhookService.handlePullRequest(payload);
    //   }
    // }

    return { received: true };
  }
}
