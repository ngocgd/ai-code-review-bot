import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import * as fs from 'fs';
import * as path from 'path';

export interface PullRequestInfo {
  number: number;
  title: string;
  body: string | null;
  author: string;
  headSha: string;
  baseBranch: string;
  headBranch: string;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface PullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

@Injectable()
export class GithubService implements OnModuleInit {
  private readonly logger = new Logger(GithubService.name);
  private octokit: Octokit;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const appId = this.configService.get<string>('GITHUB_APP_ID');
    const installationId = this.configService.get<string>('GITHUB_INSTALLATION_ID');
    const privateKeyPath = this.configService.get<string>(
      'GITHUB_PRIVATE_KEY_PATH',
      './secrets/github-app.pem',
    );

    if (!appId || !installationId) {
      this.logger.warn('GitHub App credentials not configured — API calls will fail');
      return;
    }

    let privateKey: string;
    try {
      privateKey = fs.readFileSync(path.resolve(privateKeyPath), 'utf-8');
    } catch {
      this.logger.warn(`Private key not found at ${privateKeyPath}`);
      return;
    }

    this.octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey,
        installationId: Number(installationId),
      },
    });

    this.logger.log('GitHub App authenticated successfully');
  }

  /**
   * Get PR metadata
   */
  async getPullRequestInfo(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<PullRequestInfo> {
    const { data } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    return {
      number: data.number,
      title: data.title,
      body: data.body,
      author: data.user.login,
      headSha: data.head.sha,
      baseBranch: data.base.ref,
      headBranch: data.head.ref,
      additions: data.additions,
      deletions: data.deletions,
      changedFiles: data.changed_files,
    };
  }

  /**
   * Get raw unified diff of a PR
   */
  async getPullRequestDiff(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<string> {
    const { data } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: { format: 'diff' },
    });

    return data as unknown as string;
  }

  /**
   * Get list of changed files with patches
   */
  async getPullRequestFiles(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<PullRequestFile[]> {
    const { data } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    return data.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
    }));
  }

  /**
   * Post inline comment on a specific line of a file
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
    await this.octokit.pulls.createReviewComment({
      owner,
      repo,
      pull_number: prNumber,
      commit_id: commitSha,
      path: filePath,
      line,
      body,
    });

    this.logger.debug(`Comment posted on ${filePath}:${line}`);
  }

  /**
   * Submit a full PR review (summary + verdict)
   */
  async submitReview(
    owner: string,
    repo: string,
    prNumber: number,
    commitSha: string,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
  ): Promise<void> {
    await this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      commit_id: commitSha,
      body,
      event,
    });

    this.logger.log(`Review submitted: ${event} on PR #${prNumber}`);
  }
}
