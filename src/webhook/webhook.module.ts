import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

// ============================================================
// DAY 5-6: GitHub Webhook Handler
// ============================================================

@Module({
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
