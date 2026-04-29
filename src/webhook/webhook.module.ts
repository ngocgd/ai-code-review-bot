import { Module } from "@nestjs/common";
import { WebhookController } from "./webhook.controller";
import { WebhookService } from "./webhook.service";
import { QueueModule } from "@/queue/queue.module";

// ============================================================
// DAY 5-6: GitHub Webhook Handler
// ============================================================

@Module({
  imports: [QueueModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
