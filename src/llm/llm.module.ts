import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { PromptService } from './prompt.service';
import { DiffParserService } from './diff-parser.service';

// ============================================================
// DAY 9-11: LLM Integration Module
// ============================================================

@Module({
  providers: [LlmService, PromptService, DiffParserService],
  exports: [LlmService, DiffParserService],
})
export class LlmModule {}
