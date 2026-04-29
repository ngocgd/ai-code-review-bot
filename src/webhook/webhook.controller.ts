import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Req,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { RawBodyRequest } from "@nestjs/common/interfaces";
import { Request } from "express";
import { WebhookService } from "./webhook.service";

@Controller("webhook")
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  private readonly REVIEWABLE_ACTIONS = ["opened", "synchronize", "reopened"];

  constructor(private readonly webhookService: WebhookService) {}

  @Post("github")
  @HttpCode(200)
  async handleGithubWebhook(
    @Headers("x-github-event") event: string,
    @Headers("x-hub-signature-256") signature: string,
    @Body() payload: any,
    @Req() req: RawBodyRequest<Request>,
  ) {
    // 1. Verify signature
    const isValid = this.webhookService.verifySignature(req.rawBody ?? Buffer.from(''), signature);
    if (!isValid) {
      this.logger.warn("Invalid webhook signature — rejecting");
      throw new UnauthorizedException("Invalid webhook signature");
    }

    // 2. Ping event (GitHub sends on webhook setup)
    if (event === "ping") {
      this.logger.log("Received ping from GitHub — webhook connected!");
      return { message: "pong" };
    }

    // 3. Only handle pull_request events
    if (event !== "pull_request") {
      this.logger.debug(`Ignoring event: ${event}`);
      return { ignored: true, event };
    }

    // 4. Only review on open/update/reopen
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
