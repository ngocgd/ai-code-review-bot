import { Injectable } from '@nestjs/common';
import { DiffChunk } from './diff-parser.service';

// ============================================================
// DAY 10: Prompt Engineering
// ============================================================
// TODO [Day 10]:
// 1. Build system prompt for code reviewer persona
// 2. Build review prompt with diff context
// 3. Define structured output format (JSON schema)
// 4. Handle large diffs (chunk & merge reviews)
// 5. Test different prompts, compare quality
//
// Learn:
// - System prompts vs user prompts
// - Structured output (JSON mode)
// - Few-shot examples for consistent output
// - Token estimation and context window management
// ============================================================

export interface ReviewIssue {
  filePath: string;
  line: number | null;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  category: string; // security, performance, bug, style, suggestion
  title: string;
  description: string;
  suggestion?: string; // suggested fix
}

export interface ReviewResult {
  summary: string;
  issues: ReviewIssue[];
  overallSeverity: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
}

@Injectable()
export class PromptService {
  /**
   * Build the system prompt for the AI reviewer
   */
  buildSystemPrompt(): string {
    // TODO [Day 10]: Craft system prompt
    //
    // Should include:
    // - Role: "You are a senior code reviewer"
    // - Focus areas: security, bugs, performance, readability
    // - Output format: JSON with specific schema
    // - Rules: be constructive, explain why, suggest fixes
    // - Don't: nitpick formatting (leave that to linters)
    //
    // Example:
    // return `You are a senior software engineer performing a code review.
    //   Focus on: security vulnerabilities, bugs, performance issues,
    //   and significant code quality problems.
    //   Do NOT comment on: formatting, naming conventions (handled by linters),
    //   or trivial style preferences.
    //   Respond in JSON format: { summary, issues: [...], overallSeverity }`;
    return '';
  }

  /**
   * Build the review prompt for a diff chunk
   */
  buildReviewPrompt(chunk: DiffChunk): string {
    // TODO [Day 10]: Build user prompt with diff
    //
    // Should include:
    // - File path and language
    // - The diff content
    // - Instructions for this specific file type
    //
    // Example:
    // return `Review the following ${chunk.language} code changes
    //   in file "${chunk.filePath}":
    //   \`\`\`diff
    //   ${chunk.hunks.map(h => h.content).join('\n')}
    //   \`\`\`
    //   Return JSON with issues found.`;
    return '';
  }

  /**
   * Parse LLM response into structured ReviewResult
   */
  parseResponse(llmOutput: string): ReviewResult {
    // TODO [Day 10]: Parse JSON output from LLM
    // Handle: malformed JSON, missing fields, unexpected format
    //
    // try {
    //   const parsed = JSON.parse(llmOutput);
    //   return this.validateAndNormalize(parsed);
    // } catch {
    //   return { summary: llmOutput, issues: [], overallSeverity: 'COMMENT' };
    // }
    return { summary: '', issues: [], overallSeverity: 'COMMENT' };
  }
}
