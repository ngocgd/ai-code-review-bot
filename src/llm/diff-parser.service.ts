import { Injectable } from '@nestjs/common';

export interface DiffChunk {
  filePath: string;
  language: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  startLine: number;
  endLine: number;
  content: string;
  addedLines: string[];
  removedLines: string[];
}

const IGNORE_PATTERNS = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.min\.(js|css)$/,
  /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/,
  /\.map$/,
  /node_modules\//,
  /dist\//,
  /\.DS_Store$/,
];

const LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  java: 'java',
  go: 'go',
  rs: 'rust',
  rb: 'ruby',
  php: 'php',
  cs: 'csharp',
  cpp: 'cpp',
  c: 'c',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  sql: 'sql',
  sh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  json: 'json',
  md: 'markdown',
  html: 'html',
  css: 'css',
  scss: 'scss',
  vue: 'vue',
  svelte: 'svelte',
};

@Injectable()
export class DiffParserService {
  /**
   * Parse a full PR diff into reviewable chunks
   */
  parseDiff(rawDiff: string): DiffChunk[] {
    const fileDiffs = this.splitByFile(rawDiff);
    const chunks: DiffChunk[] = [];

    for (const fileDiff of fileDiffs) {
      const filePath = this.extractFilePath(fileDiff);
      if (!filePath) continue;
      if (!this.shouldReview(filePath)) continue;

      const hunks = this.parseHunks(fileDiff);
      if (hunks.length === 0) continue;

      chunks.push({
        filePath,
        language: this.detectLanguage(filePath),
        hunks,
      });
    }

    return chunks;
  }

  /**
   * Split raw diff by file boundaries
   */
  private splitByFile(rawDiff: string): string[] {
    const parts = rawDiff.split(/^diff --git /m);
    return parts.filter((p) => p.trim().length > 0).map((p) => 'diff --git ' + p);
  }

  /**
   * Extract file path from diff header
   */
  private extractFilePath(fileDiff: string): string | null {
    // Match: +++ b/src/file.ts
    const match = fileDiff.match(/^\+\+\+ b\/(.+)$/m);
    if (match) return match[1];

    // Deleted file: --- a/src/file.ts (no +++ line)
    const deleteMatch = fileDiff.match(/^--- a\/(.+)$/m);
    return deleteMatch ? deleteMatch[1] : null;
  }

  /**
   * Parse hunks from a file diff
   */
  private parseHunks(fileDiff: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@(.*)$/gm;

    let match: RegExpExecArray | null;
    const matches: { index: number; startLine: number; header: string }[] = [];

    while ((match = hunkRegex.exec(fileDiff)) !== null) {
      matches.push({
        index: match.index,
        startLine: parseInt(match[1], 10),
        header: match[0],
      });
    }

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index + matches[i].header.length + 1;
      const end = i + 1 < matches.length ? matches[i + 1].index : fileDiff.length;
      const content = fileDiff.substring(start, end).trimEnd();

      const lines = content.split('\n');
      const addedLines: string[] = [];
      const removedLines: string[] = [];
      let currentLine = matches[i].startLine;
      let endLine = currentLine;

      for (const line of lines) {
        if (line.startsWith('+')) {
          addedLines.push(line.substring(1));
          endLine = currentLine;
          currentLine++;
        } else if (line.startsWith('-')) {
          removedLines.push(line.substring(1));
        } else if (line.startsWith(' ') || line === '') {
          currentLine++;
          endLine = currentLine;
        }
      }

      hunks.push({
        startLine: matches[i].startLine,
        endLine,
        content,
        addedLines,
        removedLines,
      });
    }

    return hunks;
  }

  /**
   * Detect programming language from file extension
   */
  detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    return LANG_MAP[ext || ''] || 'unknown';
  }

  /**
   * Check if a file should be reviewed
   */
  shouldReview(filePath: string): boolean {
    return !IGNORE_PATTERNS.some((pattern) => pattern.test(filePath));
  }
}
