import { Injectable } from '@nestjs/common';

// ============================================================
// DAY 9: Diff Parser - Parse Git Unified Diff
// ============================================================
// TODO [Day 9]:
// 1. Parse unified diff format into structured data
// 2. Extract: file path, added lines, removed lines, context
// 3. Split large diffs into reviewable chunks (max ~500 lines each)
// 4. Filter out non-reviewable files (lockfiles, images, etc.)
//
// Learn:
// - Unified diff format (@@ -a,b +c,d @@)
// - How to map diff line numbers to actual file line numbers
// - Chunking strategies for LLM context window limits
//
// Example unified diff:
// --- a/src/user.ts
// +++ b/src/user.ts
// @@ -10,6 +10,8 @@ export class UserService {
//    existing line
// +  added line
// -  removed line
//    context line
// ============================================================

export interface DiffChunk {
  filePath: string;
  language: string; // detected from file extension
  hunks: DiffHunk[];
}

export interface DiffHunk {
  startLine: number;
  endLine: number;
  content: string; // raw diff content
  addedLines: string[];
  removedLines: string[];
}

const IGNORE_PATTERNS = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /\.min\.(js|css)$/,
  /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/,
  /\.map$/,
  /node_modules\//,
  /dist\//,
];

@Injectable()
export class DiffParserService {
  /**
   * Parse a full PR diff into reviewable chunks
   */
  parseDiff(rawDiff: string): DiffChunk[] {
    // TODO [Day 9]: Parse unified diff
    //
    // Steps:
    // 1. Split by file boundaries (diff --git a/... b/...)
    // 2. For each file:
    //    a. Extract file path
    //    b. Check against IGNORE_PATTERNS → skip if matched
    //    c. Detect language from extension
    //    d. Parse hunks (@@ markers)
    //    e. Extract added/removed lines
    // 3. Return structured DiffChunk[]
    return [];
  }

  /**
   * Detect programming language from file extension
   */
  detectLanguage(filePath: string): string {
    // TODO [Day 9]: Map file extensions to languages
    // const ext = filePath.split('.').pop()?.toLowerCase();
    // const langMap: Record<string, string> = {
    //   ts: 'typescript', js: 'javascript', py: 'python',
    //   java: 'java', go: 'go', rs: 'rust', rb: 'ruby',
    //   // ... more
    // };
    // return langMap[ext || ''] || 'unknown';
    return 'unknown';
  }

  /**
   * Check if a file should be reviewed
   */
  shouldReview(filePath: string): boolean {
    // TODO [Day 9]: Check against IGNORE_PATTERNS
    // return !IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
    return true;
  }
}
