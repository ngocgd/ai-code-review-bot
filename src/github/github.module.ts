import { Module } from '@nestjs/common';
import { GithubService } from './github.service';

// ============================================================
// DAY 7-8: GitHub API Integration
// ============================================================

@Module({
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
