import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { Queue, QueueEvents } from "bullmq";
import { getQueueToken } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  // Lấy queue từ DI container
  const queue = app.get<Queue>(getQueueToken("review-pr"));
  const configService = app.get<ConfigService>(ConfigService);

  console.log("\n=== Queue Status ===");
  const counts = await queue.getJobCounts();
  console.log("  Jobs:", counts);

  // Thêm 1 job test
  console.log("\n=== Adding test job ===");
  const job = await queue.add(
    "review",
    {
      owner: "ngocgd",
      repo: "ai-code-review-bot",
      prNumber: 1,
      prTitle: "Test PR from queue script",
      prAuthor: "ngocgd",
      headSha: "abc123",
      baseBranch: "main",
      headBranch: "feature/test",
      action: "opened",
    },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    },
  );

  console.log(`  Job ID: ${job.id}`);
  console.log(`  State: ${await job.getState()}`);

  // Chờ job xử lý xong
  console.log("\n=== Waiting for job to complete... ===");

  // Create QueueEvents to listen for job completion
  const queueEvents = new QueueEvents("review-pr", {
    connection: {
      host: configService.get("REDIS_HOST", "localhost"),
      port: configService.get<number>("REDIS_PORT", 6379),
    },
  });

  try {
    const result = await job.waitUntilFinished(queueEvents, 30000);
    console.log("  Result:", JSON.stringify(result, null, 2));
  } finally {
    await queueEvents.close();
  }

  // Check queue stats lại
  const finalCounts = await queue.getJobCounts();
  console.log("\n=== Final Queue Status ===");
  console.log("  Jobs:", finalCounts);

  await app.close();
}

main().catch(console.error);
