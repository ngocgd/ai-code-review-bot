import { DiffParserService } from './diff-parser.service';

describe('DiffParserService', () => {
  let service: DiffParserService;

  beforeEach(() => {
    service = new DiffParserService();
  });

  describe('detectLanguage', () => {
    it('should detect typescript', () => {
      expect(service.detectLanguage('src/app.ts')).toBe('typescript');
      expect(service.detectLanguage('src/App.tsx')).toBe('typescript');
    });

    it('should detect javascript', () => {
      expect(service.detectLanguage('index.js')).toBe('javascript');
    });

    it('should return unknown for unrecognized', () => {
      expect(service.detectLanguage('Dockerfile')).toBe('unknown');
    });
  });

  describe('shouldReview', () => {
    it('should review source files', () => {
      expect(service.shouldReview('src/app.ts')).toBe(true);
      expect(service.shouldReview('src/service.py')).toBe(true);
    });

    it('should skip lock files', () => {
      expect(service.shouldReview('package-lock.json')).toBe(false);
      expect(service.shouldReview('yarn.lock')).toBe(false);
    });

    it('should skip images', () => {
      expect(service.shouldReview('logo.png')).toBe(false);
      expect(service.shouldReview('icon.svg')).toBe(false);
    });

    it('should skip source maps', () => {
      expect(service.shouldReview('bundle.js.map')).toBe(false);
    });

    it('should skip minified files', () => {
      expect(service.shouldReview('app.min.js')).toBe(false);
    });
  });

  describe('parseDiff', () => {
    it('should parse a simple diff', () => {
      const diff = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,5 @@
 import { Module } from '@nestjs/common';
+import { Logger } from '@nestjs/common';
 
 @Module({})
+export class AppModule {}`;

      const chunks = service.parseDiff(diff);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].filePath).toBe('src/app.ts');
      expect(chunks[0].language).toBe('typescript');
      expect(chunks[0].hunks).toHaveLength(1);
      expect(chunks[0].hunks[0].addedLines).toHaveLength(2);
    });

    it('should parse multi-file diff', () => {
      const diff = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 line1
+added
diff --git a/src/b.ts b/src/b.ts
--- a/src/b.ts
+++ b/src/b.ts
@@ -1,2 +1,3 @@
 line1
+added2`;

      const chunks = service.parseDiff(diff);
      expect(chunks).toHaveLength(2);
      expect(chunks[0].filePath).toBe('src/a.ts');
      expect(chunks[1].filePath).toBe('src/b.ts');
    });

    it('should skip ignored files', () => {
      const diff = `diff --git a/package-lock.json b/package-lock.json
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,2 +1,3 @@
 {}
+added`;

      const chunks = service.parseDiff(diff);
      expect(chunks).toHaveLength(0);
    });

    it('should handle empty diff', () => {
      expect(service.parseDiff('')).toHaveLength(0);
    });
  });
});
