import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';

// ============================================================
// DAY 13: Review Module - Orchestrator
// ============================================================

@Module({
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
