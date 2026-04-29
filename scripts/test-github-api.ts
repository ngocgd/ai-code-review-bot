/**
 * Test script: verify GitHub API integration
 * Run: npx ts-node scripts/test-github-api.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GithubService } from '../src/github/github.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const github = app.get(GithubService);

  const owner = 'ngocgd';
  const repo = 'ai-code-review-bot';
  const prNumber = 1;

  console.log('\n=== 1. PR Info ===');
  const prInfo = await github.getPullRequestInfo(owner, repo, prNumber);
  console.log(prInfo);

  console.log('\n=== 2. Changed Files ===');
  const files = await github.getPullRequestFiles(owner, repo, prNumber);
  files.forEach((f) => {
    console.log(`  ${f.status.padEnd(10)} ${f.filename} (+${f.additions} -${f.deletions})`);
  });

  console.log('\n=== 3. Diff Preview ===');
  const diff = await github.getPullRequestDiff(owner, repo, prNumber);
  console.log(`  Total: ${diff.length} chars`);
  console.log(diff.substring(0, 500));

  console.log('\n=== 4. Post Test Review ===');
  await github.submitReview(
    owner,
    repo,
    prNumber,
    prInfo.headSha,
    '🤖 **AI Code Review Bot** — Connection test!\n\nBot successfully connected to GitHub API.',
    'COMMENT',
  );
  console.log('  ✅ Review posted! Check PR on GitHub.');

  await app.close();
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
