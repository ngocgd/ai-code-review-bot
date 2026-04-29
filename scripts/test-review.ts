/**
 * Test script: Full review flow (GitHub → DiffParser → Claude → Result)
 * Run: npx ts-node -r tsconfig-paths/register scripts/test-review.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GithubService } from '../src/github/github.service';
import { DiffParserService } from '../src/llm/diff-parser.service';
import { LlmService } from '../src/llm/llm.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const github = app.get(GithubService);
  const diffParser = app.get(DiffParserService);
  const llm = app.get(LlmService);

  const owner = 'ngocgd';
  const repo = 'ai-code-review-bot';
  const prNumber = 1;

  // 1. Fetch diff from GitHub
  console.log('\n=== 1. Fetching PR diff ===');
  const rawDiff = await github.getPullRequestDiff(owner, repo, prNumber);
  console.log(`  Raw diff: ${rawDiff.length} chars`);

  // 2. Parse diff
  console.log('\n=== 2. Parsing diff ===');
  const chunks = diffParser.parseDiff(rawDiff);
  console.log(`  Reviewable files: ${chunks.length}`);
  chunks.forEach((c) => {
    const addedLines = c.hunks.reduce((sum, h) => sum + h.addedLines.length, 0);
    console.log(`    ${c.filePath} (${c.language}) — +${addedLines} lines`);
  });

  // 3. Review with Claude
  console.log('\n=== 3. Reviewing with LLM ===');
  const result = await llm.reviewAllChunks(chunks);

  console.log('\n=== 4. Review Result ===');
  console.log(`  Summary: ${result.summary}`);
  console.log(`  Overall: ${result.overallSeverity}`);
  console.log(`  Tokens: ${result.tokensUsed}`);
  console.log(`  Model: ${result.model}`);
  console.log(`  Issues: ${result.issues.length}`);

  result.issues.forEach((issue, i) => {
    console.log(`\n  --- Issue ${i + 1} ---`);
    console.log(`  [${issue.severity}] ${issue.title}`);
    console.log(`  File: ${issue.filePath}${issue.line ? ':' + issue.line : ''}`);
    console.log(`  Category: ${issue.category}`);
    console.log(`  ${issue.description}`);
    if (issue.suggestion) {
      console.log(`  💡 ${issue.suggestion}`);
    }
  });

  await app.close();
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
