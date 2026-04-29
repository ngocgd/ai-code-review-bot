import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
export interface ReviewJobData {
  owner: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  headSha: string;
  baseBranch: string;
  headBranch: string;
  action: string;
  installationId?: number;
}

@Processor("review-pr")
export class ReviewProcessor extends WorkerHost {
  private readonly logger = new Logger(ReviewProcessor.name);

  async process(job: Job<ReviewJobData>): Promise<any> {
    const { owner, repo, prNumber, prTitle } = job.data;
    this.logger.debug(`Processing job ${job.id} for PR #${job.data.prNumber}`);
    await job.updateProgress(10);
    this.logger.log(`  Step 1: Fetching PR diff...`);
    // const diff = await this.githubService.getPullRequestDiff(owner, repo, prNumber);

    await job.updateProgress(30);
    this.logger.log(`  Step 2: Parsing diff...`);
    // const chunks = this.diffParser.parseDiff(diff);

    await job.updateProgress(50);
    this.logger.log(`  Step 3: LLM reviewing...`);
    // const result = await this.llmService.reviewAllChunks(chunks);

    await job.updateProgress(80);
    this.logger.log(`  Step 4: Posting review to GitHub...`);
    // await this.githubService.submitReview(...)

    await job.updateProgress(100);

    // Trả về result — BullMQ lưu vào Redis
    return {
      status: "completed",
      pr: `${owner}/${repo}#${prNumber}`,
      // issuesFound: result.issues.length,
      // severity: result.overallSeverity,
      processedAt: new Date().toISOString(),
    };
  }
  @OnWorkerEvent("active")
  onActive(job: Job) {
    this.logger.log(`Job ${job.id} started: PR #${job.data.prNumber}`);
  }
  @OnWorkerEvent("completed")
  onCompleted(job: Job, result: any) {
    this.logger.log(`✅ Job ${job.id} completed: ${JSON.stringify(result)}`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `❌ Job ${job.id} failed (attempt ${job.attemptsMade}): ${error.message}`,
    );
  }

  @OnWorkerEvent("progress")
  onProgress(job: Job, progress: number | object) {
    this.logger.debug(`Job ${job.id} progress: ${progress}%`);
  }
}
