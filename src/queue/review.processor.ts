import { GithubService } from "@/github/github.service";
import { DiffParserService } from "@/llm/diff-parser.service";
import { LlmService } from "@/llm/llm.service";
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

@Processor("review-pr", {
  lockDuration: 600000,      // 10 min — LLM reviews take time
  stalledInterval: 300000,   // check stalled every 5 min (default 30s)
})
export class ReviewProcessor extends WorkerHost {
  private readonly logger = new Logger(ReviewProcessor.name);
  constructor(
    private readonly githubService: GithubService,
    private readonly diffParser: DiffParserService,
    private readonly llmService: LlmService,
  ) {
    super(); // WorkerHost yêu cầu gọi super()
  }
  async process(job: Job<ReviewJobData>): Promise<any> {
    const { owner, repo, prNumber, prTitle } = job.data;
    this.logger.log(`🔍 Reviewing PR #${prNumber}: "${prTitle}"`);
    const startTime = Date.now();

    try {
      // ── Step 0: Lấy SHA mới nhất từ GitHub ──
      // Job data có thể outdated nếu PR có push mới khi chờ trong queue.
      await job.updateProgress(5);
      const prInfo = await this.githubService.getPullRequestInfo(
        owner,
        repo,
        prNumber,
      );
      const headSha = prInfo.headSha;

      // ── Step 1: Fetch diff từ GitHub ──
      await job.updateProgress(10);
      this.logger.log("  📥 Fetching PR diff...");
      const rawDiff = await this.githubService.getPullRequestDiff(
        owner,
        repo,
        prNumber,
      );
      this.logger.debug(`  Raw diff: ${rawDiff.length} chars`);

      // ── Step 2: Parse diff thành chunks ──
      await job.updateProgress(25);
      this.logger.log("  🔎 Parsing diff...");
      const chunks = this.diffParser.parseDiff(rawDiff);
      this.logger.log(`  Found ${chunks.length} reviewable file(s)`);

      if (chunks.length === 0) {
        this.logger.log("  ⏭️ No reviewable changes — skipping");
        await this.githubService.submitReview(
          owner,
          repo,
          prNumber,
          headSha,
          "✅ No reviewable code changes found in this PR.",
          "COMMENT",
        );
        return { status: "skipped", reason: "no reviewable changes" };
      }

      // ── Step 3: LLM review ──
      await job.updateProgress(40);
      this.logger.log("  🤖 Running LLM review...");
      const result = await this.llmService.reviewAllChunks(chunks);
      this.logger.log(
        `  Found ${result.issues.length} issue(s), severity: ${result.overallSeverity}`,
      );

      // ── Step 4: Format review body ──
      await job.updateProgress(75);
      const reviewBody = this.formatReviewBody(
        result,
        chunks,
        Date.now() - startTime,
      );

      // ── Step 5: Post review lên GitHub ──
      await job.updateProgress(90);
      this.logger.log("  📝 Posting review to GitHub...");

      // Map severity → GitHub review event
      const eventMap: Record<
        string,
        "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
      > = {
        APPROVE: "APPROVE",
        REQUEST_CHANGES: "REQUEST_CHANGES",
        COMMENT: "COMMENT",
      };

      await this.githubService.submitReview(
        owner,
        repo,
        prNumber,
        headSha,
        reviewBody,
        eventMap[result.overallSeverity] || "COMMENT",
      );

      await job.updateProgress(100);
      const duration = Date.now() - startTime;
      this.logger.log(`  ✅ Review posted in ${(duration / 1000).toFixed(1)}s`);

      return {
        status: "completed",
        pr: `${owner}/${repo}#${prNumber}`,
        filesReviewed: chunks.length,
        issuesFound: result.issues.length,
        severity: result.overallSeverity,
        tokensUsed: result.tokensUsed,
        model: result.model,
        durationMs: duration,
      };
    } catch (error) {
      this.logger.error(
        `Failed to review PR #${prNumber}: ${(error as Error).message}`,
      );
      throw error; // Re-throw để BullMQ retry
    }
  }
  /**
   * Format review result thành GitHub review body (Markdown)
   */
  private formatReviewBody(
    result: { summary: string; issues: any[]; overallSeverity: string },
    chunks: any[],
    durationMs: number,
  ): string {
    const severityEmoji: Record<string, string> = {
      APPROVE: "✅",
      COMMENT: "💬",
      REQUEST_CHANGES: "🔴",
    };
    const issueEmoji: Record<string, string> = {
      CRITICAL: "🔴",
      WARNING: "⚠️",
      INFO: "ℹ️",
    };

    let body = `## ${severityEmoji[result.overallSeverity] || "🤖"} AI Code Review\n\n`;
    body += `**Summary:** ${result.summary}\n\n`;

    if (result.issues.length > 0) {
      body += `### Issues Found (${result.issues.length})\n\n`;

      for (const issue of result.issues) {
        const emoji = issueEmoji[issue.severity] || "📝";
        body += `#### ${emoji} [${issue.severity}] ${issue.title}\n`;
        if (issue.filePath) {
          body += `📁 \`${issue.filePath}${issue.line ? `:${issue.line}` : ""}\`\n`;
        }
        body += `${issue.description}\n`;
        if (issue.suggestion) {
          body += `\n💡 **Suggestion:** ${issue.suggestion}\n`;
        }
        body += "\n---\n\n";
      }
    } else {
      body += "✨ No issues found — code looks good!\n\n";
    }

    body += `<details><summary>📊 Review Stats</summary>\n\n`;
    body += `- Files reviewed: ${chunks.length}\n`;
    body += `- Issues found: ${result.issues.length}\n`;
    body += `- Duration: ${(durationMs / 1000).toFixed(1)}s\n`;
    body += `- Verdict: ${result.overallSeverity}\n`;
    body += `</details>\n`;

    return body;
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
