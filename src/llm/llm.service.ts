import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PromptService, ReviewResult } from './prompt.service';
import { DiffChunk } from './diff-parser.service';

// ============================================================
// DAY 11: LLM Service - Multi-Provider with Fallback
// ============================================================
// TODO [Day 11]:
// 1. npm install @anthropic-ai/sdk @google/generative-ai
// 2. Implement 3 providers: Claude, Gemini, Ollama
// 3. Provider selection via LLM_PROVIDER env var
// 4. Auto-fallback: Claude → Gemini → Ollama
// 5. Token usage tracking per provider
//
// Learn:
// - Strategy/Provider pattern
// - Interface-based programming
// - Fallback chains for reliability
// - Each provider's API differences
// ============================================================

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
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private providers: LlmProvider[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly promptService: PromptService,
  ) {
    // TODO [Day 11]: Initialize providers based on config
    // Order = priority (first available wins)
    this.initProviders();
  }

  private initProviders() {
    const primary = this.config.get<string>('LLM_PROVIDER', 'claude');

    // TODO [Day 11]: Register providers in priority order
    //
    // --- Claude (best quality, needs API key) ---
    // if (this.config.get('ANTHROPIC_API_KEY')) {
    //   const Anthropic = require('@anthropic-ai/sdk');
    //   const client = new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') });
    //   this.providers.push({
    //     name: 'claude',
    //     isAvailable: () => true,
    //     chat: async (system, user) => {
    //       const start = Date.now();
    //       const response = await client.messages.create({
    //         model: 'claude-sonnet-4-20250514',
    //         max_tokens: 4096,
    //         system: system,
    //         messages: [{ role: 'user', content: user }],
    //       });
    //       return {
    //         content: response.content[0].text,
    //         tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    //         model: 'claude-sonnet-4-20250514',
    //         provider: 'claude',
    //         latencyMs: Date.now() - start,
    //       };
    //     },
    //   });
    // }
    //
    // --- Gemini (free tier, good fallback) ---
    // if (this.config.get('GEMINI_API_KEY')) {
    //   const { GoogleGenerativeAI } = require('@google/generative-ai');
    //   const genAI = new GoogleGenerativeAI(this.config.get('GEMINI_API_KEY'));
    //   const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    //   this.providers.push({
    //     name: 'gemini',
    //     isAvailable: () => true,
    //     chat: async (system, user) => {
    //       const start = Date.now();
    //       const result = await model.generateContent({
    //         systemInstruction: system,
    //         contents: [{ role: 'user', parts: [{ text: user }] }],
    //       });
    //       return {
    //         content: result.response.text(),
    //         tokensUsed: result.response.usageMetadata?.totalTokenCount || 0,
    //         model: 'gemini-2.0-flash',
    //         provider: 'gemini',
    //         latencyMs: Date.now() - start,
    //       };
    //     },
    //   });
    // }
    //
    // --- Ollama (local, free, always available) ---
    // const ollamaUrl = this.config.get('OLLAMA_BASE_URL', 'http://localhost:11434');
    // this.providers.push({
    //   name: 'ollama',
    //   isAvailable: () => true, // TODO: ping health endpoint
    //   chat: async (system, user) => {
    //     const start = Date.now();
    //     const resp = await fetch(`${ollamaUrl}/api/chat`, {
    //       method: 'POST',
    //       headers: { 'Content-Type': 'application/json' },
    //       body: JSON.stringify({
    //         model: 'qwen3:8b',  // hoặc deepseek-coder-v2
    //         stream: false,
    //         messages: [
    //           { role: 'system', content: system },
    //           { role: 'user', content: user },
    //         ],
    //       }),
    //     });
    //     const data = await resp.json();
    //     return {
    //       content: data.message.content,
    //       tokensUsed: (data.eval_count || 0) + (data.prompt_eval_count || 0),
    //       model: 'qwen3:8b',
    //       provider: 'ollama',
    //       latencyMs: Date.now() - start,
    //     };
    //   },
    // });

    // Sort: put primary provider first
    // this.providers.sort((a, b) =>
    //   a.name === primary ? -1 : b.name === primary ? 1 : 0
    // );

    this.logger.log(
      `LLM providers: ${this.providers.map((p) => p.name).join(' → ') || 'none configured'}`,
    );
  }

  /**
   * Call LLM with automatic fallback
   * Tries primary → falls back to next available provider
   */
  private async callWithFallback(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<LlmResponse> {
    // TODO [Day 11]: Implement fallback chain
    //
    // for (const provider of this.providers) {
    //   if (!provider.isAvailable()) continue;
    //   try {
    //     this.logger.debug(`Trying provider: ${provider.name}`);
    //     const response = await provider.chat(systemPrompt, userPrompt);
    //     this.logger.log(
    //       `${provider.name}: ${response.tokensUsed} tokens, ${response.latencyMs}ms`
    //     );
    //     return response;
    //   } catch (error) {
    //     this.logger.warn(`Provider ${provider.name} failed: ${error.message}`);
    //     // Continue to next provider
    //   }
    // }
    // throw new Error('All LLM providers failed');

    throw new Error('No LLM providers configured');
  }

  /**
   * Review a single diff chunk
   */
  async reviewChunk(chunk: DiffChunk): Promise<ReviewResult & { meta: LlmResponse }> {
    // TODO [Day 11]:
    // 1. Build prompts
    // const systemPrompt = this.promptService.buildSystemPrompt();
    // const userPrompt = this.promptService.buildReviewPrompt(chunk);
    //
    // 2. Call LLM with fallback
    // const response = await this.callWithFallback(systemPrompt, userPrompt);
    //
    // 3. Parse response
    // const result = this.promptService.parseResponse(response.content);
    //
    // 4. Return result with metadata
    // return { ...result, meta: response };

    return {
      summary: '',
      issues: [],
      overallSeverity: 'COMMENT',
      meta: {
        content: '',
        tokensUsed: 0,
        model: 'none',
        provider: 'none',
        latencyMs: 0,
      },
    };
  }

  /**
   * Review all chunks and merge results
   */
  async reviewAllChunks(chunks: DiffChunk[]): Promise<ReviewResult> {
    // TODO [Day 11]: Review each chunk, merge, track total usage
    //
    // const results = [];
    // let totalTokens = 0;
    //
    // // Sequential to avoid rate limits (parallel later)
    // for (const chunk of chunks) {
    //   const result = await this.reviewChunk(chunk);
    //   results.push(result);
    //   totalTokens += result.meta.tokensUsed;
    // }
    //
    // const allIssues = results.flatMap(r => r.issues);
    // const hasCritical = allIssues.some(i => i.severity === 'CRITICAL');
    //
    // this.logger.log(`Review complete: ${allIssues.length} issues, ${totalTokens} tokens`);
    //
    // return {
    //   summary: `Found ${allIssues.length} issues (${totalTokens} tokens used)`,
    //   issues: allIssues,
    //   overallSeverity: hasCritical ? 'REQUEST_CHANGES' : allIssues.length > 0 ? 'COMMENT' : 'APPROVE',
    // };

    return { summary: '', issues: [], overallSeverity: 'COMMENT' };
  }
}
