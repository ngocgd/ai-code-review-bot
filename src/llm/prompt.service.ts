import { Injectable } from '@nestjs/common';
import { DiffChunk } from './diff-parser.service';

export interface ReviewIssue {
  filePath: string;
  line: number | null;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  category: string;
  title: string;
  description: string;
  suggestion?: string;
}

export interface ReviewResult {
  summary: string;
  issues: ReviewIssue[];
  overallSeverity: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
}

@Injectable()
export class PromptService {
  /**
   * System prompt — defines the AI reviewer persona
   */
  buildSystemPrompt(): string {
    return `You are a senior software engineer performing a code review on a pull request.

## Your Focus Areas (in priority order)
1. **Security** — vulnerabilities, injection, auth issues, secrets exposure
2. **Bugs** — logic errors, null/undefined risks, race conditions, edge cases
3. **Performance** — inefficient queries, unnecessary re-renders, memory leaks, O(n²) when O(n) is possible
4. **Error Handling** — unhandled promises, missing try/catch for external calls, silent failures
5. **Code Quality** — dead code, code duplication, overly complex logic

## Rules
- Be constructive — explain WHY something is an issue, not just WHAT
- Suggest a fix when possible
- Do NOT nitpick: formatting, naming conventions, import order (linters handle these)
- Do NOT comment on deleted lines (only review added/modified code)
- If the code looks good, say so — don't invent issues
- Be concise — developers read many reviews

## Output Format
Respond with ONLY valid JSON (no markdown code blocks, no extra text):

{
  "summary": "Brief 1-2 sentence summary of the changes and overall quality",
  "issues": [
    {
      "filePath": "src/example.ts",
      "line": 42,
      "severity": "CRITICAL | WARNING | INFO",
      "category": "security | bug | performance | error-handling | quality",
      "title": "Short issue title",
      "description": "What's wrong and why it matters",
      "suggestion": "How to fix it (optional)"
    }
  ],
  "overallSeverity": "APPROVE | REQUEST_CHANGES | COMMENT"
}

## Severity Guide
- **CRITICAL**: Must fix before merge — security vulnerability, data loss risk, crash
- **WARNING**: Should fix — bugs, performance issues, missing error handling
- **INFO**: Nice to have — suggestions, minor improvements

## overallSeverity Rules
- APPROVE: No issues or only INFO-level suggestions
- COMMENT: Has WARNING issues but nothing blocking
- REQUEST_CHANGES: Has any CRITICAL issues`;
  }

  /**
   * Build review prompt for a specific diff chunk
   */
  buildReviewPrompt(chunk: DiffChunk): string {
    const diffContent = chunk.hunks.map((h) => h.content).join('\n');

    return `Review the following ${chunk.language} code changes in file "${chunk.filePath}":

\`\`\`diff
${diffContent}
\`\`\`

Lines starting with + are added, lines starting with - are removed, lines starting with space are context.
Focus on the added/modified code. Return your review as JSON.`;
  }

  /**
   * Build review prompt for multiple files at once
   */
  buildMultiFileReviewPrompt(chunks: DiffChunk[]): string {
    const filesSection = chunks
      .map((chunk) => {
        const diffContent = chunk.hunks.map((h) => h.content).join('\n');
        return `### File: ${chunk.filePath} (${chunk.language})
\`\`\`diff
${diffContent}
\`\`\``;
      })
      .join('\n\n');

    return `Review the following code changes across ${chunks.length} file(s):

${filesSection}

Lines starting with + are added, lines starting with - are removed, lines starting with space are context.
Focus on the added/modified code. Return your review as JSON.`;
  }

  /**
   * Parse LLM response into structured ReviewResult
   */
  parseResponse(llmOutput: string): ReviewResult {
    try {
      // Strip markdown code blocks if present
      let cleaned = llmOutput.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleaned);
      return this.validateAndNormalize(parsed);
    } catch {
      // If JSON parsing fails, return raw output as summary
      return {
        summary: llmOutput.substring(0, 500),
        issues: [],
        overallSeverity: 'COMMENT',
      };
    }
  }

  /**
   * Validate and normalize parsed response
   */
  private validateAndNormalize(parsed: any): ReviewResult {
    const validSeverities = ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'];
    const validIssueSeverities = ['CRITICAL', 'WARNING', 'INFO'];

    const issues: ReviewIssue[] = (parsed.issues || [])
      .filter((i: any) => i && i.title)
      .map((i: any) => ({
        filePath: i.filePath || '',
        line: typeof i.line === 'number' ? i.line : null,
        severity: validIssueSeverities.includes(i.severity) ? i.severity : 'INFO',
        category: i.category || 'quality',
        title: i.title || '',
        description: i.description || '',
        suggestion: i.suggestion || undefined,
      }));

    return {
      summary: parsed.summary || 'No summary provided',
      issues,
      overallSeverity: validSeverities.includes(parsed.overallSeverity)
        ? parsed.overallSeverity
        : 'COMMENT',
    };
  }
}
