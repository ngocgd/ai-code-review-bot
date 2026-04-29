import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue, QueueEvents } from "bullmq";
import { AppModule } from "../src/app.module";

async function main() {
  console.log("=== Starting app ===");
  const app = await NestFactory.createApplicationContext(AppModule);

  const queue = app.get<Queue>(getQueueToken("review-pr"));
  const config = app.get(ConfigService);

  const queueEvents = new QueueEvents("review-pr", {
    connection: {
      host: config.get<string>("REDIS_HOST", "localhost"),
      port: config.get<number>("REDIS_PORT", 6379),
    },
  });
  await queueEvents.waitUntilReady();

  const counts = await queue.getJobCounts();
  console.log("Queue stats:", counts);

  console.log("\n=== Adding review job ===");
  const job = await queue.add(
    "review",
    {
      owner: "ngocgd",
      repo: "ai-code-review-bot",
      prNumber: 1,
      prTitle: "Test full pipeline",
      prAuthor: "ngocgd",
      headSha: "HEAD",
      baseBranch: "main",
      headBranch: "feature/test",
      action: "opened",
    },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    },
  );

  console.log(`Job ${job.id} added. Waiting for completion...`);

  try {
    const result = await job.waitUntilFinished(queueEvents, 120000);
    console.log("\n=== Review Result ===");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("\n❌ Job failed:", (error as Error).message);
    const failedJob = await queue.getJob(job.id!);
    console.log("Failed reason:", failedJob?.failedReason);
    console.log("Stack:", failedJob?.stacktrace?.[0]);
  }

  const finalCounts = await queue.getJobCounts();
  console.log("\nFinal queue stats:", finalCounts);

  await queueEvents.close();
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
