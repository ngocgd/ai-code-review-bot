import { Module } from '@nestjs/common';

// ============================================================
// DAY 12: Queue Module - Async Processing with BullMQ
// ============================================================
// TODO [Day 12]:
// 1. npm install @nestjs/bullmq bullmq
// 2. Configure BullMQ with Redis connection
// 3. Create review queue: 'review-pr'
// 4. Create ReviewProcessor (consumer)
// 5. Handle job lifecycle: active → completed / failed
// 6. Implement retry logic (max 3 retries, exponential backoff)
// 7. Add job events logging
//
// Learn:
// - Message Queue pattern (producer → queue → consumer)
// - Why async? Webhook must return 200 in <10s, review takes 30-60s
// - Job states: waiting → active → completed/failed
// - Retry strategies: fixed, exponential backoff
// - Dead letter queue (DLQ) for permanently failed jobs
// - Concurrency: how many jobs to process simultaneously
//
// Architecture:
//   WebhookController → adds job to queue
//                              ↓
//                    Redis (BullMQ storage)
//                              ↓
//                    ReviewProcessor (consumer)
//                              ↓
//                    GithubService.postReview()
// ============================================================

@Module({
  // TODO [Day 12]: Register BullMQ
  //
  // imports: [
  //   BullModule.forRoot({
  //     connection: { host: 'localhost', port: 6379 },
  //   }),
  //   BullModule.registerQueue({ name: 'review-pr' }),
  // ],
  // providers: [ReviewProcessor],
  // exports: [BullModule],
})
export class QueueModule {}
