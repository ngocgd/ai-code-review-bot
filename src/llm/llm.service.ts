import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PromptService, ReviewResult } from './prompt.service';
import { DiffChunk } from './diff-parser.service';

interface LlmResponse {
  content: string;
  tokensUsed: number;
  model: string;
  provider: string;
  latencyMs: number;
}

interface LlmProvider {
  name: string;
  isAvailable(): boolean;
  chat(systemPrompt: string, userPrompt: string): Promise<LlmResponse>;
}

@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);
  private providers: LlmProvider[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly promptService: PromptService,
  ) {}

  onModuleInit() {
    this.initProviders();
  }

  private initProviders() {
    const primary = this.config.get<string>('LLM_PROVIDER', 'claude');

    // Claude provider — via CLI (uses OAuth token from Claude Code)
    // Pipes prompt via stdin to avoid shell escaping issues with diffs
    this.providers.push({
      name: 'claude',
      isAvailable: () => true,
      chat: async (system: string, user: string) => {
        const { execSync, spawnSync } = require('child_process');
        const start = Date.now();

        const fullPrompt = `${system}\n\n---\n\n${user}`;

        // Use spawnSync to pipe prompt via stdin — safe for any content
        // Pass HOME explicitly so claude CLI finds ~/.claude/.credentials.json
        const proc = spawnSync('claude', ['-p', '--model', 'claude-sonnet-4-6'], {
          input: fullPrompt,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024, // 10MB
          timeout: 120000, // 2 min
          env: { ...process.env, HOME: process.env.HOME || '/app' },
        });

        if (proc.error) {
          throw proc.error;
        }
        if (proc.status !== 0) {
          throw new Error(`claude CLI exited with code ${proc.status}: ${proc.stderr || proc.stdout}`);
        }

        const result = proc.stdout;
        const content = result.trim();
        const tokensUsed = 0; // CLI doesn't report token usage in text mode
        const model = 'claude-sonnet-4-6';

        return {
          content,
          tokensUsed,
          model,
          provider: 'claude-cli',
          latencyMs: Date.now() - start,
        };
      },
    });

    // Gemini provider
    const geminiKey = this.config.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      this.providers.push({
        name: 'gemini',
        isAvailable: () => true,
        chat: async (system: string, user: string) => {
          const start = Date.now();
          const result = await model.generateContent({
            systemInstruction: system,
            contents: [{ role: 'user', parts: [{ text: user }] }],
          });
          return {
            content: result.response.text(),
            tokensUsed: result.response.usageMetadata?.totalTokenCount || 0,
            model: 'gemini-2.0-flash',
            provider: 'gemini',
            latencyMs: Date.now() - start,
          };
        },
      });
    }

    // Ollama provider (local)
    const ollamaUrl = this.config.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434');
    this.providers.push({
      name: 'ollama',
      isAvailable: () => true,
      chat: async (system: string, user: string) => {
        const start = Date.now();
        const resp = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'qwen3:8b',
            stream: false,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
        });
        const data = await resp.json();
        return {
          content: data.message.content,
          tokensUsed: (data.eval_count || 0) + (data.prompt_eval_count || 0),
          model: 'qwen3:8b',
          provider: 'ollama',
          latencyMs: Date.now() - start,
        };
      },
    });

    // Sort: primary provider first
    this.providers.sort((a, b) =>
      a.name === primary ? -1 : b.name === primary ? 1 : 0,
    );

    this.logger.log(
      `LLM providers: ${this.providers.map((p) => p.name).join(' → ')}`,
    );
  }

  /**
   * Call LLM with automatic fallback
   */
  private async callWithFallback(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<LlmResponse> {
    for (const provider of this.providers) {
      if (!provider.isAvailable()) continue;
      try {
        this.logger.debug(`Trying provider: ${provider.name}`);
        const response = await provider.chat(systemPrompt, userPrompt);
        this.logger.log(
          `${provider.name} (${response.model}): ${response.tokensUsed} tokens, ${response.latencyMs}ms`,
        );
        return response;
      } catch (error) {
        this.logger.warn(`Provider ${provider.name} failed: ${(error as Error).message}`);
      }
    }
    throw new Error('All LLM providers failed');
  }

  /**
   * Review a single diff chunk
   */
  async reviewChunk(
    chunk: DiffChunk,
  ): Promise<ReviewResult & { meta: LlmResponse }> {
    const systemPrompt = this.promptService.buildSystemPrompt();
    const userPrompt = this.promptService.buildReviewPrompt(chunk);

    const response = await this.callWithFallback(systemPrompt, userPrompt);
    const result = this.promptService.parseResponse(response.content);

    return { ...result, meta: response };
  }

  /**
   * Review all chunks — small PRs in one call, large PRs per-file
   */
  async reviewAllChunks(chunks: DiffChunk[]): Promise<ReviewResult & { tokensUsed: number; model: string }> {
    if (chunks.length === 0) {
      return {
        summary: 'No reviewable changes found.',
        issues: [],
        overallSeverity: 'APPROVE',
        tokensUsed: 0,
        model: 'none',
      };
    }

    // Small PR (≤5 files): review all at once for better context
    const totalLines = chunks.reduce(
      (sum, c) => sum + c.hunks.reduce((s, h) => s + h.addedLines.length, 0),
      0,
    );

    if (chunks.length <= 5 && totalLines <= 500) {
      const systemPrompt = this.promptService.buildSystemPrompt();
      const userPrompt = this.promptService.buildMultiFileReviewPrompt(chunks);
      const response = await this.callWithFallback(systemPrompt, userPrompt);
      const result = this.promptService.parseResponse(response.content);

      return {
        ...result,
        tokensUsed: response.tokensUsed,
        model: response.model,
      };
    }

    // Large PR: review per file, merge results
    const allIssues: ReviewResult['issues'] = [];
    let totalTokens = 0;
    let model = '';

    for (const chunk of chunks) {
      const result = await this.reviewChunk(chunk);
      allIssues.push(...result.issues);
      totalTokens += result.meta.tokensUsed;
      model = result.meta.model;
    }

    const hasCritical = allIssues.some((i) => i.severity === 'CRITICAL');
    const hasWarning = allIssues.some((i) => i.severity === 'WARNING');

    return {
      summary: `Reviewed ${chunks.length} files. Found ${allIssues.length} issue(s).`,
      issues: allIssues,
      overallSeverity: hasCritical
        ? 'REQUEST_CHANGES'
        : hasWarning
          ? 'COMMENT'
          : 'APPROVE',
      tokensUsed: totalTokens,
      model,
    };
  }
}
