import { Injectable } from '@nestjs/common';

// ============================================================
// DAY 13: Review Service - Orchestrate the Full Review Flow
// ============================================================
// TODO [Day 13]:
// This is the main service that ties everything together.
//
// Flow:
// 1. Receive PR info from queue (or webhook directly)
// 2. Fetch PR diff from GitHub (GithubService)
// 3. Parse diff into chunks (DiffParserService)
// 4. Send chunks to LLM for review (LlmService)
// 5. Save review & comments to database (PrismaService)
// 6. Post comments back to GitHub PR (GithubService)
// 7. Submit overall review (approve/request changes)
//
// Error handling:
// - GitHub API fails → retry 3x, then mark review as FAILED
// - LLM fails → fallback to different provider, or skip
// - Partial failure → post what we have, log failures
//
// Learn:
// - Orchestrator / Saga pattern
// - Error handling strategies for multi-step workflows
// - Idempotency: same PR + same commit = same review (don't duplicate)
// ============================================================

interface PullRequestInfo {
  owner: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  headSha: string;
}

@Injectable()
export class ReviewService {
  // constructor(
  //   private readonly github: GithubService,
  //   private readonly llm: LlmService,
  //   private readonly diffParser: DiffParserService,
  //   private readonly prisma: PrismaService,
  // ) {}

  /**
   * Main entry point: review a pull request
   */
  async reviewPullRequest(prInfo: PullRequestInfo): Promise<void> {
    // TODO [Day 13]: Implement full review flow
    //
    // Step 1: Check idempotency
    // const existing = await this.prisma.review.findUnique({
    //   where: {
    //     repositoryId_prNumber_commitSha: {
    //       repositoryId: repoId,
    //       prNumber: prInfo.prNumber,
    //       commitSha: prInfo.headSha,
    //     }
    //   }
    // });
    // if (existing?.status === 'COMPLETED') return; // already reviewed
    //
    // Step 2: Create review record (status: PROCESSING)
    // const review = await this.prisma.review.create({ ... });
    //
    // Step 3: Fetch diff
    // const diff = await this.github.getPullRequestDiff(
    //   prInfo.owner, prInfo.repo, prInfo.prNumber
    // );
    //
    // Step 4: Parse diff into chunks
    // const chunks = this.diffParser.parseDiff(diff);
    //
    // Step 5: Send to LLM
    // const result = await this.llm.reviewAllChunks(chunks);
    //
    // Step 6: Save comments to DB
    // for (const issue of result.issues) {
    //   await this.prisma.reviewComment.create({
    //     data: { reviewId: review.id, ...issue }
    //   });
    // }
    //
    // Step 7: Post to GitHub
    // for (const issue of result.issues) {
    //   if (issue.line) {
    //     await this.github.createReviewComment(
    //       prInfo.owner, prInfo.repo, prInfo.prNumber,
    //       prInfo.headSha, issue.filePath, issue.line,
    //       this.formatComment(issue)
    //     );
    //   }
    // }
    //
    // Step 8: Submit overall review
    // await this.github.submitReview(
    //   prInfo.owner, prInfo.repo, prInfo.prNumber,
    //   prInfo.headSha, result.summary, result.overallSeverity
    // );
    //
    // Step 9: Update review status
    // await this.prisma.review.update({
    //   where: { id: review.id },
    //   data: { status: 'COMPLETED', summary: result.summary }
    // });
  }

  /**
   * Format a review issue as GitHub comment markdown
   */
  private formatComment(issue: any): string {
    // TODO [Day 13]: Format issue as markdown
    // const emoji = { CRITICAL: '🔴', WARNING: '🟡', INFO: '💡' };
    // return `${emoji[issue.severity]} **${issue.category}**: ${issue.title}\n\n${issue.description}`;
    return '';
  }
}
