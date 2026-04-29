import { PromptService } from './prompt.service';

describe('PromptService', () => {
  let service: PromptService;

  beforeEach(() => {
    service = new PromptService();
  });

  describe('buildSystemPrompt', () => {
    it('should include key instructions', () => {
      const prompt = service.buildSystemPrompt();

      expect(prompt).toContain('senior software engineer');
      expect(prompt).toContain('Security');
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('CRITICAL');
      expect(prompt).toContain('APPROVE');
    });
  });

  describe('buildReviewPrompt', () => {
    it('should include file path and diff content', () => {
      const prompt = service.buildReviewPrompt({
        filePath: 'src/app.ts',
        language: 'typescript',
        hunks: [{ startLine: 1, endLine: 5, content: '+new line', addedLines: ['new line'], removedLines: [] }],
      });

      expect(prompt).toContain('src/app.ts');
      expect(prompt).toContain('typescript');
      expect(prompt).toContain('+new line');
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response', () => {
      const json = JSON.stringify({
        summary: 'Looks good',
        issues: [
          {
            filePath: 'src/app.ts',
            line: 10,
            severity: 'WARNING',
            category: 'bug',
            title: 'Possible null',
            description: 'Could be null',
          },
        ],
        overallSeverity: 'COMMENT',
      });

      const result = service.parseResponse(json);

      expect(result.summary).toBe('Looks good');
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('WARNING');
      expect(result.overallSeverity).toBe('COMMENT');
    });

    it('should handle markdown-wrapped JSON', () => {
      const wrapped = '```json\n{"summary":"test","issues":[],"overallSeverity":"APPROVE"}\n```';

      const result = service.parseResponse(wrapped);
      expect(result.summary).toBe('test');
      expect(result.overallSeverity).toBe('APPROVE');
    });

    it('should handle malformed JSON gracefully', () => {
      const result = service.parseResponse('This is not JSON at all');

      expect(result.issues).toHaveLength(0);
      expect(result.overallSeverity).toBe('COMMENT');
      expect(result.summary).toContain('This is not JSON');
    });

    it('should normalize invalid severity values', () => {
      const json = JSON.stringify({
        summary: 'test',
        issues: [{ title: 'test', severity: 'INVALID', category: 'bug', description: 'x' }],
        overallSeverity: 'INVALID',
      });

      const result = service.parseResponse(json);
      expect(result.issues[0].severity).toBe('INFO');
      expect(result.overallSeverity).toBe('COMMENT');
    });
  });
});
