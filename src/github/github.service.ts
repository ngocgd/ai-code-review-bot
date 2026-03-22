import { Injectable } from '@nestjs/common';

// ============================================================
// DAY 7: GitHub API Service - Read PR Data
// ============================================================
// TODO [Day 7]:
// 1. npm install @octokit/rest @octokit/auth-app
// 2. Initialize Octokit with GitHub App credentials
// 3. getPullRequestDiff() — fetch PR diff (changed files)
// 4. getPullRequestFiles() — list of changed files with patch
// 5. getPullRequestInfo() — PR metadata (title, description, author)
//
// TODO [Day 8]:
// 6. createReviewComment() — post inline comment on a file/line
// 7. createPRReview() — submit review (APPROVE / REQUEST_CHANGES / COMMENT)
// 8. Write tests with mocked Octokit
//
// Learn:
// - GitHub REST API vs GraphQL API
// - GitHub App authentication (JWT → Installation token)
// - PR diff format (unified diff parsing)
// - Rate limiting & pagination
// ============================================================

@Injectable()
export class GithubService {
  // private octokit: Octokit;

  /**
   * Get the diff of a pull request
   */
  async getPullRequestDiff(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<string> {
    // TODO [Day 7]: Fetch diff using Octokit
    // const { data } = await this.octokit.pulls.get({
    //   owner, repo, pull_number: prNumber,
    //   mediaType: { format: 'diff' }
    // });
    // return data as unknown as string;
    return '';
  }

  /**
   * Get list of changed files with patches
   */
  async getPullRequestFiles(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<any[]> {
    // TODO [Day 7]: Fetch changed files
    // const { data } = await this.octokit.pulls.listFiles({
    //   owner, repo, pull_number: prNumber
    // });
    // return data;
    //
    // Each file has: filename, status, additions, deletions, patch
    // 'patch' contains the unified diff for that file
    return [];
  }

  /**
   * Post a review comment on a specific line
   */
  async createReviewComment(
    owner: string,
    repo: string,
    prNumber: number,
    commitSha: string,
    filePath: string,
    line: number,
    body: string,
  ): Promise<void> {
    // TODO [Day 8]: Post inline comment
    // await this.octokit.pulls.createReviewComment({
    //   owner, repo, pull_number: prNumber,
    //   commit_id: commitSha,
    //   path: filePath,
    //   line: line,
    //   body: body,
    // });
  }

  /**
   * Submit a full review (summary + approve/request changes)
   */
  async submitReview(
    owner: string,
    repo: string,
    prNumber: number,
    commitSha: string,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
  ): Promise<void> {
    // TODO [Day 8]: Submit review
    // await this.octokit.pulls.createReview({
    //   owner, repo, pull_number: prNumber,
    //   commit_id: commitSha,
    //   body: body,
    //   event: event,
    // });
  }
}
